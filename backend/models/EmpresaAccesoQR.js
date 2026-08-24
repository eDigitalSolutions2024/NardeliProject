// models/EmpresaAccesoQR.js
const mongoose = require('mongoose');

// Referencia local de qué reserva ya tiene acceso QR delegado a una empresa partner.
// IMPORTANTE: nunca guarda el apiKey en texto plano ni su hash — ese secreto vive
// únicamente en nardeli-partner-api y se muestra al admin una sola vez al generarlo.
const empresaAccesoQRSchema = new mongoose.Schema(
  {
    reservaId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Reserva',
      required: true,
      unique: true,
    },
    label: { type: String, required: true, trim: true },
    companyId: { type: String, required: true },
    lastIssuedAt: { type: Date, default: Date.now },
    lastIssuedBy: { type: String, default: '' },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('EmpresaAccesoQR', empresaAccesoQRSchema);
