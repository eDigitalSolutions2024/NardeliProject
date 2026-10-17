// models/Usuario.js
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const UsuarioSchema = new mongoose.Schema({
  fullname: { type: String, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  password: { type: String },   // Login tradicional (opcional): guarda aquí el HASH (bcrypt) si lo usas
  googleId: { type: String, index: true },  // Login con Google (opcional)
  foto: { type: String },
  role: { type: String, enum: ['admin', 'user', 'asistente', 'cotizador'], default: 'user' },
  emailVerified: { type: Boolean, default: true },   // Estado del correo (si manejas verificación)

  telefono: { type: String, trim: true },
  lastLoginAt: { type: Date, default: null },

  // === Administración de cuentas (módulo Usuarios y roles) ===
  // activo=false bloquea el acceso sin borrar el historial de la cuenta.
  activo: { type: Boolean, default: true },
  // true mientras el usuario siga con la contraseña temporal que generó el admin:
  // el servidor le niega todo salvo cambiar su contraseña.
  mustChangePassword: { type: Boolean, default: false },
  creadoPor: { type: mongoose.Schema.Types.ObjectId, ref: 'Usuario', default: null },
  // Contraseña actual CIFRADA (utils/boveda.js) para que el admin pueda consultarla. select:false = no sale en consultas normales.
  passwordRecuperable: { type: String, default: null, select: false },
  // El usuario solo puede cambiar su contraseña UNA vez después de que el admin se la asigna.
  passwordCambiadaPorUsuario: { type: Boolean, default: false },
  passwordCambiadaEn: { type: Date, default: null },

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



UsuarioSchema.pre('save', async function (next) {
  try {
    if (!this.isModified('password')) return next();
    if (!this.password) return next();

    if (this.password.startsWith('$2a$') || this.password.startsWith('$2b$')) return next();

    this.password = await bcrypt.hash(this.password, 10);
    next();
  } catch (err) {
    next(err);
  }
});

module.exports = mongoose.model('Usuario', UsuarioSchema);
