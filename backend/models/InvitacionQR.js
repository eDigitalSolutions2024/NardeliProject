const mongoose = require('mongoose');

const invitacionQRSchema = new mongoose.Schema(
  {
    reservaId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Reserva',
      required: true,
      index: true,
    },
    portalId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'InvitacionPortal',
      required: true,
      index: true,
    },
    nombreFamilia: {
      type: String,
      required: true,
      trim: true,
    },
    personasAutorizadas: {
      type: Number,
      required: true,
      min: 1,

    },
    entradasRestantes: {
      type: Number,
      required: true,
      min: 0,
    },
    qrToken: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    estado: {
      type: String,
      enum: ['activa', 'agotada', 'cancelada'],
      default: 'activa',
    },
    notas: {
      type: String,
      default: '',
      trim: true,
    },
    ultimaCantidadRegistrada: {
  type: Number,
  default: 0,
},
    // Log de cada escaneo real (antes solo se guardaba el último en
    // ultimaCantidadRegistrada, así que un QR escaneado varias veces perdía
    // el historial de los escaneos anteriores). Cada registro POST /scan
    // agrega una entrada aquí en vez de sobreescribir.
    accesos: {
      type: [
        {
          cantidad: { type: Number, required: true },
          restantesDespues: { type: Number, required: true },
          fecha: { type: Date, default: Date.now },
        },
      ],
      default: [],
    },
    creadoPor: {
      type: String,
      default: 'cliente',
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('InvitacionQR', invitacionQRSchema);
