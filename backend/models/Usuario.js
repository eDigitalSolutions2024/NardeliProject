const mongoose = require('mongoose');

const UsuarioSchema = new mongoose.Schema({
  fullname: { type: String },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  password: { type: String },   // login tradicional (si lo usas)
  googleId: { type: String },   // login con Google
  foto: { type: String },
  role: { type: String, enum: ['admin', 'user'], default: 'user' },

  // Enlace mágico
  emailVerified: { type: Boolean, default: true },
  magicTokenHash: { type: String },  // sin default: null
  magicTokenExp: { type: Date },     // sin default: null

  // ¡ojo con la 't'!
  lastLoginAt: { type: Date }        // sin default: null
}, { timestamps: true });

//UsuarioSchema.index({ email: 1 }, { unique: true });

module.exports = mongoose.model('Usuario', UsuarioSchema);
