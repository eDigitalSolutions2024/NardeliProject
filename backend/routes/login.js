const Usuario = require('../models/Usuario');
const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const JWT_SECRET = process.env.JWT_SECRET || 'clave-super-secreta';

router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  try {
    const usuario = await Usuario.findOne({ email });

    if (!usuario) {
      return res.status(404).json({ success: false, message: 'Usuario no encontrado' });
    }

    const passwordValida = await bcrypt.compare(password, usuario.password);
    
    const hashedPassword = await bcrypt.hash(password, 10);


    // Si usas bcrypt, haz esto en vez de la línea anterior:
    // const passwordValida = await bcrypt.compare(password, usuario.password);

    if (!passwordValida) {
      return res.status(401).json({ success: false, message: 'Contraseña incorrecta' });
    }

    const token = jwt.sign(
      { id: usuario._id, email: usuario.email, role: usuario.role },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      success: true,
      token,
      user: {
        id: usuario._id,
        email: usuario.email,
        role: usuario.role,
        fullname: usuario.fullname
      }
    });

  } catch (error) {
    console.error('Error en login:', error.message);
    res.status(500).json({ success: false, message: 'Error del servidor' });
  }
});

module.exports = router;
