const mongoose = require('mongoose');

const FormatoReservaSchema = new mongoose.Schema({
  reservaId: { type: mongoose.Schema.Types.ObjectId, required: true },
  tipo: {
    type: String,
    enum: ['tabla-trabajo', 'degustacion', 'proveedores'],
    required: true
  },
  data: { type: mongoose.Schema.Types.Mixed, default: {} },
  updatedAt: { type: Date, default: Date.now }
});

FormatoReservaSchema.index({ reservaId: 1, tipo: 1 }, { unique: true });

module.exports = mongoose.model('FormatoReserva', FormatoReservaSchema);
