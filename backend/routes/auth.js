const express = require('express');
const axios = require('axios');
const jwt = require('jsonwebtoken');
const router = express.Router();
const Usuario = require('../models/Usuario');

const { generarCodigo, hashCodigo, verificarCodigo } = require('../utils/magic');
const mailer = require('../utils/mailer');

// === ENV ===
const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI;
const JWT_SECRET = process.env.JWT_SECRET || 'secreto-temporal';
const APP_ORIGIN = process.env.FRONTEND_BASE_URL || 'http://localhost:3000';

// Rate limit para reenvío de código
const RESEND_WINDOW_MS = 60 * 1000;

// Helper discreto para no filtrar si existe/no existe el correo
function maskEmail(email = '') {
  const [u, d] = String(email).split('@');
  if (!d) return 'correo';
  return `${(u || '').slice(0, 2)}***@${d}`;
}

/* =========================
 *  GOOGLE OAUTH
 * =======================*/

// 1) Redirigir a Google
router.get('/google', (req, res) => {
  const scope = [
    'https://www.googleapis.com/auth/userinfo.email',
    'https://www.googleapis.com/auth/userinfo.profile'
  ].join(' ');

  const redirectUrl =
    `https://accounts.google.com/o/oauth2/v2/auth?response_type=code&client_id=${CLIENT_ID}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&scope=${encodeURIComponent(scope)}&access_type=offline&prompt=consent`;

  res.redirect(redirectUrl);
});

// 2) Callback desde Google
router.get('/google/callback', async (req, res) => {
  const code = req.query.code;

  try {
    // Intercambiar código por tokens
    const tokenRes = await axios.post('https://oauth2.googleapis.com/token', null, {
      params: {
        code,
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        redirect_uri: REDIRECT_URI,
        grant_type: 'authorization_code'
      }
    });

    const { access_token } = tokenRes.data;

    // Obtener info del usuario
    const userRes = await axios.get(`https://www.googleapis.com/oauth2/v2/userinfo`, {
      headers: { Authorization: `Bearer ${access_token}` }
    });

    const { id, email, name, picture } = userRes.data;

    // Buscar/crear usuario
    let usuario = await Usuario.findOne({ email });

    if (usuario) {
      if (!usuario.googleId && usuario.password) {
        // Existe con password tradicional: puedes permitir vinculación si quieres
        return res.status(403).send('Este correo ya está registrado con contraseña. Usa el inicio de sesión tradicional.');
      }
      // Vincula googleId si no estaba
      if (!usuario.googleId) {
        usuario.googleId = id;
        await usuario.save();
      }
    } else {
      usuario = new Usuario({
        googleId: id,
        email,
        fullname: name,
        foto: picture,
        role: 'user',
        emailVerified: true
      });
      await usuario.save();
    }

    // Crear token JWT de sesión
    const token = jwt.sign(
      { sub: String(usuario._id), email: usuario.email, role: usuario.role || 'user' },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    // Redirigir al frontend con token
    const redirectTo = `${APP_ORIGIN}?token=${encodeURIComponent(token)}`;
    res.redirect(redirectTo);
  } catch (error) {
    console.error('Error en login con Google:', error.message);
    res.status(500).send('Error en autenticación');
  }
});

/* =========================
 *  LOGIN POR CÓDIGO / MAGIC LINK
 * =======================*/

/**
 * POST /auth/start
 * Inicia el flujo: genera código, guarda hash+exp y envía correo con código y link opcional.
 * body: { correo, nombre?, telefono? }
 */
router.post('/start', async (req, res) => {
  try {
    //const { correo, nombre, telefono } = req.body || {};
    let { correo, nombre, telefono } = req.body || {};
    if (!correo) return res.status(400).json({ msg: 'Falta "correo"' });
    correo = String(correo).toLowerCase().trim();

    // Buscar o crear usuario
    let user = await Usuario.findOne({ email: correo });
    if (!user) {
      user = await Usuario.create({
        email: correo,
        fullname: nombre || '',
        telefono: telefono || '',
        role: 'user',
        emailVerified: true
      });
    } else {
      if (nombre && !user.fullname) user.fullname = nombre;
      if (telefono && !user.telefono) user.telefono = telefono;
    }

    // Rate limit por usuario
    const now = Date.now();
    if (user.magicTokenSentAt && now - user.magicTokenSentAt.getTime() < RESEND_WINDOW_MS) {
      const wait = Math.ceil((RESEND_WINDOW_MS - (now - user.magicTokenSentAt.getTime())) / 1000);
      return res.status(429).json({ msg: `Espera ${wait}s para solicitar un nuevo código.` });
    }

    // Generar código y guardar hash + expiración (usa .env MAGIC_LINK_EXPIRES_MIN)
    const code = generarCodigo(6);
    const hash = await hashCodigo(code);
    const EXPIRES_MIN = Number(process.env.MAGIC_LINK_EXPIRES_MIN || 15);
    const exp = new Date(now + EXPIRES_MIN * 60 * 1000);

    user.magicTokenHash = hash;
    user.magicTokenExp = exp;
    user.magicTokenSentAt = new Date();
    user.magicTokenAttempts = 0;
    await user.save();

    // Magic link opcional
    //const EXPIRES_MIN = Number(process.env.MAGIC_LINK_EXPIRES_MIN || 15);
    const magicPayload = { sub: String(user._id), email: user.email, typ: 'magic' };
    const magicToken = jwt.sign(magicPayload, JWT_SECRET, { expiresIn: `${EXPIRES_MIN}m` });
    const magicLink = `${APP_ORIGIN}/login?token=${encodeURIComponent(magicToken)}&email=${encodeURIComponent(user.email)}`;

    // Enviar correo
    try {
      await mailer.sendMagicCode({ to: user.email, code, link: magicLink, from: process.env.SMTP_FROM });
    } catch (err) {
      console.error('Mailer error:', err);
      // decide si devuelves 500 o continúas con mensaje genérico
      return res.status(500).json({ msg: 'No se pudo enviar el correo' });
    }

    return res.json({ ok: true, msg: `Te enviamos un código a ${maskEmail(correo)}.` });
  } catch (e) {
    console.error('auth/start error:', e);
    return res.status(500).json({ msg: 'Error al iniciar acceso' });
  }
});

/**
 * POST /auth/verify
 * Verifica el código y emite JWT de sesión.
 * body: { correo, code }
 */
router.post('/verify', async (req, res) => {
  try {
    let { correo, code } = req.body || {};
    if (!correo || !code) return res.status(400).json({ msg: 'Faltan "correo" y/o "code"' });
    correo = String(correo).toLowerCase().trim();

    const user = await Usuario.findOne({ email: correo });
    if (!user || !user.magicTokenHash || !user.magicTokenExp) {
      return res.status(400).json({ msg: 'Código inválido o expirado' });
    }
    if (user.magicTokenExp < new Date()) {
      return res.status(400).json({ msg: 'Código expirado' });
    }

    if (user.magicTokenAttempts >= 5) {
      return res.status(429).json({ msg: 'Demasiados intentos. Solicita un nuevo código.' });
    }

    const ok = await verificarCodigo(user.magicTokenHash, code);
    if (!ok) {
      user.magicTokenAttempts = (user.magicTokenAttempts || 0) + 1;
      await user.save();
      return res.status(400).json({ msg: 'Código inválido' });
    }

    // Limpiar para un solo uso y actualizar último acceso
    user.magicTokenHash = null;
    user.magicTokenExp = null;
    user.magicTokenAttempts = 0;
    user.lastLoginAt = new Date();
    await user.save();

    // Emitir JWT de sesión
    const token = jwt.sign(
      { sub: String(user._id), email: user.email, role: user.role || 'user' },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    return res.json({
      ok: true,
      token,
      user: { id: user._id, email: user.email, fullname: user.fullname, role: user.role }
    });
  } catch (e) {
    console.error('auth/verify error:', e);
    return res.status(500).json({ msg: 'Error al verificar código' });
  }
});

/**
 * GET /auth/magic
 * (Opcional) Validar magic link (token corto) y devolver JWT de sesión normal.
 * query: ?token=...
 */
router.get('/magic', async (req, res) => {
  try {
    const { token } = req.query || {};
    if (!token) return res.status(400).json({ msg: 'Falta token' });

    let payload;
    try {
      payload = jwt.verify(token, JWT_SECRET);
    } catch {
      return res.status(400).json({ msg: 'Token inválido o expirado' });
    }
    if (payload.typ !== 'magic') {
      return res.status(400).json({ msg: 'Token inválido' });
    }

    const user = await Usuario.findById(payload.sub);
    if (!user) return res.status(400).json({ msg: 'Usuario no encontrado' });

    // Emite sesión normal
    const session = jwt.sign(
      { sub: String(user._id), email: user.email, role: user.role || 'user' },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    user.lastLoginAt = new Date();
    await user.save();

    return res.json({
      ok: true,
      token: session,
      user: { id: user._id, email: user.email, fullname: user.fullname, role: user.role }
    });
  } catch (e) {
    console.error('auth/magic error:', e);
    return res.status(500).json({ msg: 'Error al validar magic link' });
  }
});

module.exports = router;
