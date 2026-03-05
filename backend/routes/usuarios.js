const express = require('express');
const router = express.Router();
const Usuario = require('../models/Usuario');
const bcrypt = require('bcryptjs');

router.post('/registro', async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ success: false, message: 'Todos los campos son obligatorios' });
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