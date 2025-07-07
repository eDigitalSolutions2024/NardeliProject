const express = require('express');
const router = express.Router();
const Usuario = require('../models/Usuario');

// Ruta POST para registrar un nuevo usuario
router.post('/registro', async (req, res) => {
  try {
    const { name, email, password } = req.body;

    // Validaciones básicas
    if (!name || !email || !password) {
      return res.status(400).json({ success: false, message: 'Todos los campos son obligatorios' });
    }

    // Verificar si el usuario ya existe
    const usuarioExistente = await Usuario.findOne({ email });
    if (usuarioExistente) {
      return res.status(409).json({ success: false, message: 'El usuario ya existe' });
    }

    // Crear y guardar el nuevo usuario
    const nuevoUsuario = new Usuario({ name, email, password }); // Más adelante agregaremos hash
    await nuevoUsuario.save();

    res.status(201).json({ success: true, message: 'Usuario registrado correctamente' });
  } catch (error) {
    console.error('Error en registro:', error.message);
    res.status(500).json({ success: false, message: 'Error del servidor' });
  }
});

module.exports = router;
