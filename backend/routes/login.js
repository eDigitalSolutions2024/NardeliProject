const Usuario = require('../models/Usuario');
const router = require('express').Router();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const JWT_SECRET = process.env.JWT_SECRET || 'clave-super-secreta';

router.post('/login', async (req, res) => {
  try {
    let { email, password } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Faltan email o password' });
    }

    email = String(email).trim().toLowerCase();
    const usuario = await Usuario.findOne({ email });

    if (!usuario) {
      return res.status(401).json({ success: false, message: 'Usuario inválidos' });
    }

    const passwordValida = await bcrypt.compare(password, usuario.password); // ← compara plain vs HASH
    if (!passwordValida) {
      return res.status(401).json({ success: false, message: ' contraseña inválidos' });
    }

    const token = jwt.sign(
      { id: usuario._id, email: usuario.email, role: usuario.role },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    return res.json({
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
    console.error('Error en login:', error);
    return res.status(500).json({ success: false, message: 'Error del servidor' });
  }
});

module.exports = router;
