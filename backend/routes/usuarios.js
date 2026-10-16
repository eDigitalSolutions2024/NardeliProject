const express = require('express');
const router = express.Router();
const Usuario = require('../models/Usuario');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { requirePermission, ROLES_STAFF } = require('../utils/permisos');
const bitacora = require('../utils/bitacora');

// Código secreto para poder crear cuentas de administrador desde el formulario
// público de registro. Antes cualquiera en internet podía crear una cuenta admin
// sin restricción alguna; ahora hace falta conocer este código (configúralo en
// .env como ADMIN_SIGNUP_CODE y compártelo solo con el personal al que le crees
// su cuenta).
const ADMIN_SIGNUP_CODE = process.env.ADMIN_SIGNUP_CODE || null;

router.post('/registro', async (req, res) => {
  try {
    const { name, email, password, codigoInvitacion } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ success: false, message: 'Todos los campos son obligatorios' });
    }

    if (!ADMIN_SIGNUP_CODE) {
      console.error('ADMIN_SIGNUP_CODE no está configurado — se bloquea el registro por seguridad.');
      return res.status(503).json({ success: false, message: 'Registro no disponible por el momento' });
    }
    if (codigoInvitacion !== ADMIN_SIGNUP_CODE) {
      return res.status(403).json({ success: false, message: 'Código de invitación inválido' });
    }

    const usuarioExistente = await Usuario.findOne({ email: String(email).trim().toLowerCase() });
    if (usuarioExistente) {
      return res.status(409).json({ success: false, message: 'El usuario ya existe' });
    }

    const hash = await bcrypt.hash(password, 10);

    const nuevoUsuario = new Usuario({
      fullname: name,
      email: String(email).trim().toLowerCase(),
      password: hash,
      role: 'admin' // 👈 si este será el admin
    });

    await nuevoUsuario.save();

    res.status(201).json({ success: true, message: 'Usuario registrado correctamente' });
  } catch (error) {
    console.error('Error en registro:', error.message);
    res.status(500).json({ success: false, message: 'Error del servidor' });
  }
});

// =====================================================================
//  Administración de cuentas (solo admin — permiso 'usuarios.gestionar')
// =====================================================================
const soloAdmin = requirePermission('usuarios.gestionar');
const ROLES_ASIGNABLES = ROLES_STAFF; // admin, asistente, cotizador

// Contraseña temporal legible (sin 0/O/1/l/I). El usuario DEBE cambiarla al entrar.
function generarPasswordTemporal(len = 10) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
  return Array.from({ length: len }, () => chars[crypto.randomInt(chars.length)]).join('');
}

const vista = (u) => ({
  id: u._id,
  fullname: u.fullname || '',
  email: u.email,
  role: u.role,
  activo: u.activo !== false,
  mustChangePassword: !!u.mustChangePassword,
  tienePassword: !!u.password,
  lastLoginAt: u.lastLoginAt || null,
  createdAt: u.createdAt,
});

async function quedaOtroAdminActivo(excluirId) {
  const n = await Usuario.countDocuments({ _id: { $ne: excluirId }, role: 'admin', activo: { $ne: false } });
  return n > 0;
}

// Lista de cuentas de staff (los clientes con rol 'user' no se listan aquí).
router.get('/', soloAdmin, async (req, res) => {
  const incluirClientes = req.query.clientes === '1';
  const filtro = incluirClientes ? {} : { role: { $in: ROLES_ASIGNABLES } };
  const items = await Usuario.find(filtro).sort({ createdAt: -1 }).lean();
  res.json({ ok: true, items: items.map(vista) });
});

// Crear cuenta: la contraseña se genera sola y se devuelve UNA vez para entregarla.
router.post('/', soloAdmin, async (req, res) => {
  try {
    const fullname = String(req.body?.fullname || '').trim();
    const email = String(req.body?.email || '').trim().toLowerCase();
    const role = String(req.body?.role || '');

    if (!fullname || !email) return res.status(400).json({ ok: false, msg: 'Nombre y correo son obligatorios' });
    if (!/^\S+@\S+\.\S+$/.test(email)) return res.status(400).json({ ok: false, msg: 'Correo inválido' });
    if (!ROLES_ASIGNABLES.includes(role)) return res.status(400).json({ ok: false, msg: 'Rol inválido' });
    if (await Usuario.findOne({ email })) return res.status(409).json({ ok: false, msg: 'Ya existe una cuenta con ese correo' });

    const passwordTemporal = generarPasswordTemporal();
    const nuevo = await Usuario.create({
      fullname,
      email,
      role,
      password: await bcrypt.hash(passwordTemporal, 10),
      mustChangePassword: true,
      activo: true,
      emailVerified: true,
      creadoPor: req.user.sub,
    });

    await bitacora.registrar(req.user, 'usuario.crear', { email, role });
    res.status(201).json({ ok: true, usuario: vista(nuevo), passwordTemporal });
  } catch (e) {
    console.error('usuarios POST error:', e);
    res.status(500).json({ ok: false, msg: 'No se pudo crear el usuario' });
  }
});

// Editar nombre, rol o estado (activo).
router.put('/:id', soloAdmin, async (req, res) => {
  try {
    const u = await Usuario.findById(req.params.id);
    if (!u) return res.status(404).json({ ok: false, msg: 'Usuario no encontrado' });

    const esUnoMismo = String(u._id) === String(req.user.sub);
    const { fullname, role, activo } = req.body || {};
    const cambios = {};

    if (typeof fullname === 'string' && fullname.trim() && fullname.trim() !== u.fullname) {
      cambios.fullname = fullname.trim();
    }
    if (role !== undefined && role !== u.role) {
      if (!ROLES_ASIGNABLES.includes(role)) return res.status(400).json({ ok: false, msg: 'Rol inválido' });
      if (esUnoMismo) return res.status(400).json({ ok: false, msg: 'No puedes cambiar tu propio rol' });
      if (u.role === 'admin' && !(await quedaOtroAdminActivo(u._id))) {
        return res.status(400).json({ ok: false, msg: 'Debe quedar al menos un administrador activo' });
      }
      cambios.role = role;
    }
    if (activo !== undefined && Boolean(activo) !== (u.activo !== false)) {
      if (!activo) {
        if (esUnoMismo) return res.status(400).json({ ok: false, msg: 'No puedes desactivar tu propia cuenta' });
        if (u.role === 'admin' && !(await quedaOtroAdminActivo(u._id))) {
          return res.status(400).json({ ok: false, msg: 'Debe quedar al menos un administrador activo' });
        }
      }
      cambios.activo = Boolean(activo);
    }

    if (!Object.keys(cambios).length) return res.json({ ok: true, usuario: vista(u) });

    Object.assign(u, cambios);
    await u.save();
    await bitacora.registrar(req.user, 'usuario.editar', { email: u.email, cambios });
    res.json({ ok: true, usuario: vista(u) });
  } catch (e) {
    console.error('usuarios PUT error:', e);
    res.status(500).json({ ok: false, msg: 'No se pudo actualizar el usuario' });
  }
});

// Restablecer contraseña: genera otra temporal y vuelve a obligar el cambio.
router.post('/:id/reset-password', soloAdmin, async (req, res) => {
  try {
    const u = await Usuario.findById(req.params.id);
    if (!u) return res.status(404).json({ ok: false, msg: 'Usuario no encontrado' });
    if (String(u._id) === String(req.user.sub)) {
      return res.status(400).json({ ok: false, msg: 'Para tu propia cuenta usa "Cambiar contraseña"' });
    }
    const passwordTemporal = generarPasswordTemporal();
    u.password = await bcrypt.hash(passwordTemporal, 10);
    u.mustChangePassword = true;
    await u.save();
    await bitacora.registrar(req.user, 'usuario.reset_password', { email: u.email });
    res.json({ ok: true, usuario: vista(u), passwordTemporal });
  } catch (e) {
    console.error('usuarios reset error:', e);
    res.status(500).json({ ok: false, msg: 'No se pudo restablecer la contraseña' });
  }
});

module.exports = router;
