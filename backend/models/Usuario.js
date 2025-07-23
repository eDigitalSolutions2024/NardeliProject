const mongoose = require('mongoose');

const UsuarioSchema = new mongoose.Schema({
  fullname: { type: String },
  email: { type: String, required: true, unique: true },
  password: { type: String }, // requerido solo para login tradicional
  googleId: { type: String }, // usado solo para login con Google
  foto: { type: String },
  role: { type: String, enum: ['admin', 'user'], default: 'user' }
});

module.exports = mongoose.model('Usuario', UsuarioSchema);
