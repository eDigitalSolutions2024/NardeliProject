// models/Usuario.js
const mongoose = require('mongoose');

const UsuarioSchema = new mongoose.Schema({
  fullname: { type: String, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },

  // Login tradicional (opcional): guarda aquí el HASH (bcrypt) si lo usas
  password: { type: String },

  // Login con Google (opcional)
  googleId: { type: String, index: true },
  foto: { type: String },
  role: { type: String, enum: ['admin', 'user'], default: 'user' },

  // Estado del correo (si manejas verificación)
  emailVerified: { type: Boolean, default: true },

  // === Acceso por código/enlace mágico ===
  // Guarda el HASH del código temporal (NO guardes el código plano)
  magicTokenHash: { type: String, default: null },
  // Fecha/hora de expiración del código
  magicTokenExp: { type: Date, default: null },
  // Cuándo se envió el último código (para rate limiting)
  magicTokenSentAt: { type: Date, default: null },
  // Intentos de verificación fallidos (para limitar)
  magicTokenAttempts: { type: Number, default: 0 },

  // Último inicio de sesión
  lastLoginAt: { type: Date, default: null },

  // models/Usuario.js (campos adicionales sugeridos)
  magicTokenSentAt: { type: Date, default: null },
  magicTokenAttempts: { type: Number, default: 0 },
  telefono: { type: String, trim: true }, // si quieres guardarlo


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
