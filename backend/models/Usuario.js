// models/Usuario.js
const mongoose = require('mongoose');

const UsuarioSchema = new mongoose.Schema({
  fullname: { type: String, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  password: { type: String },   // Login tradicional (opcional): guarda aquí el HASH (bcrypt) si lo usas
  googleId: { type: String, index: true },  // Login con Google (opcional)
  foto: { type: String },
  role: { type: String, enum: ['admin', 'user','asistente'], default: 'user' },
  emailVerified: { type: Boolean, default: true },   // Estado del correo (si manejas verificación)

  // === Acceso por código/enlace mágico ===
  magicTokenHash: { type: String, default: null },
  magicTokenExp: { type: Date, default: null },
  magicTokenSentAt: { type: Date, default: null },
  magicTokenAttempts: { type: Number, default: 0 },

}, { timestamps: true });

// Índices recomendados
UsuarioSchema.index({ email: 1 }, { unique: true });
UsuarioSchema.index({ magicTokenExp: 1 }); // consultas/limpieza de tokens vencidos

// (Opcionales) helpers de conveniencia para el flujo mágico
UsuarioSchema.methods.startMagicFlow = async function ({ hash, exp }) {
  this.magicTokenHash = hash;
  this.magicTokenExp = exp;
  this.magicTokenSentAt = new Date();
  this.magicTokenAttempts = 0;
  await this.save();
};

UsuarioSchema.methods.clearMagicFlow = async function () {
  this.magicTokenHash = null;
  this.magicTokenExp = null;
  this.magicTokenAttempts = 0;
  await this.save();
};

module.exports = mongoose.model('Usuario', UsuarioSchema);
