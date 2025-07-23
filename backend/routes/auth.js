const express = require('express');
const axios = require('axios');
const jwt = require('jsonwebtoken');
const router = express.Router();
const Usuario = require('../models/Usuario'); // Ajusta si está en otra ruta

// Variables de entorno
const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI;
const JWT_SECRET = process.env.JWT_SECRET || 'secreto-temporal'; // Cambia esto por seguridad

// 1. Redirigir a Google
router.get('/google', (req, res) => {
  const scope = [
    'https://www.googleapis.com/auth/userinfo.email',
    'https://www.googleapis.com/auth/userinfo.profile'
  ].join(' ');

  const redirectUrl = 
    `https://accounts.google.com/o/oauth2/v2/auth?response_type=code&client_id=${CLIENT_ID}&redirect_uri=${REDIRECT_URI}&scope=${scope}&access_type=offline&prompt=consent`;

  res.redirect(redirectUrl);
});

// 2. Callback: Google redirige aquí con el código
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

    const { id_token, access_token } = tokenRes.data;

    // Obtener info del usuario con el access token
    const userRes = await axios.get(`https://www.googleapis.com/oauth2/v2/userinfo`, {
      headers: {
        Authorization: `Bearer ${access_token}`
      }
    });

    const { id, email, name, picture } = userRes.data;

    // Buscar o crear usuario en tu base de datos
    let usuario = await Usuario.findOne({ email });

    if (usuario) {
        if (!usuario.googleId) {
            // Ya existe un usuario con ese email pero fue registrado con contraseña
            return res.status(403).send('Este correo ya está registrado con contraseña. Usa el inicio de sesión tradicional.');
        }
        } else {
        // Crear nuevo usuario con Google
        usuario = new Usuario({
            googleId: id, 
            email,
            fullname: name,
            foto: picture,
            role: 'user'
        });
        await usuario.save();
        }

    // Crear token JWT propio
    const token = jwt.sign(
      { id: usuario._id, email: usuario.email, role: usuario.role },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    // Redirigir al frontend con el token en query string (puedes usar cookies luego)
    res.redirect(`http://localhost:3000?token=${token}`);
  } catch (error) {
    console.error('Error en login con Google:', error.message);
    res.status(500).send('Error en autenticación');
  }
});

module.exports = router;
