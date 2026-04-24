const mongoose = require('mongoose');

const InvitacionPortalSchema = new mongoose.Schema(
  {
    reservaId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Reserva',
      required: true,
      unique: true,
    },
    token: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    codigoAcceso: {
      type: String,
      required: true,
      trim: true,
    },
    activo: {
      type: Boolean,
      default: true,
    },
    ultimoAcceso: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('InvitacionPortal', InvitacionPortalSchema);