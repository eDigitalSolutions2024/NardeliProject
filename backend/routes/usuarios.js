const express = require('express');
const router = express.Router();
const Usuario = require('../models/Usuario');
const bcrypt = require('bcryptjs');

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

module.exports = router;