const mongoose = require('mongoose');

const UsuarioSchema = new mongoose.Schema({
  fullname: { type: String },
  email: { type: String, required: true, unique: true },
  password: { type: String }, // requerido solo para login tradicional
  googleId: { type: String }, // usado solo para login con Google
  foto: { type: String },
  role: { type: String, enum: ['admin', 'user'], default: 'user' },

  emailVerified: { type: Boolean, default: true },
  magicTokenHasj: {type: String, default: null},
  magicTokenExo: { type: Date, defualt: null},

  lasLoginAt: { tupe: Date, default: null }
}, { timestamps: true});

UsuariosSchema.index({ email: 1 }, { unique: true });

module.exports = mongoose.model('Usuario', UsuarioSchema);
