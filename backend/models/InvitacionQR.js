const mongoose = require('mongoose');

const invitacionQRSchema = new mongoose.Schema(
  {
    reservaId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Reserva',
      required: true,
      index: true,
    },
    // Ausente cuando el QR viene sincronizado desde una empresa partner (nardeli-partner-api) —
    // esas invitaciones no nacen de un InvitacionPortal, se crean vía API.
    portalId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'InvitacionPortal',
      index: true,
    },
    // Presentes SOLO en QR sincronizados desde una empresa partner. partnerInvitationId es la
    // llave de upsert del job de sincronización (jobs/syncPartnerInvitations.js).
    partnerInvitationId: {
      type: String,
      unique: true,
      sparse: true,
      index: true,
    },
    partnerCompanyId: {
      type: String,
    },
    // Último authorizedCount que reportó la Partner API — separado de personasAutorizadas
    // a propósito: si el admin edita personasAutorizadas a mano desde Nardeli, el próximo
    // sync debe calcular el delta contra ESTE valor (lo último que sabíamos de la empresa),
    // no contra el valor ya editado por el admin, o se pisarían uno al otro.
    partnerAuthorizedCount: {
      type: Number,
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