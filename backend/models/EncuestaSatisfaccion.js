const mongoose = require('mongoose');

const calificacionCategoriaSchema = new mongoose.Schema({
  categoria: { type: String, required: true },
  etiqueta: { type: String, required: true },
  valor: { type: Number, required: true, min: 1, max: 5 },
}, { _id: false });

const encuestaSatisfaccionSchema = new mongoose.Schema({
  reservaId: { type: mongoose.Schema.Types.ObjectId, ref: 'Reserva', required: true },

  // Snapshot de datos de la reserva al momento de la encuesta — no se le vuelven a pedir al cliente
  cliente: { type: String, required: true },
  correo: { type: String, default: '' },
  telefono: { type: String, default: '' },
  tipoEvento: { type: String, default: '' },
  fecha: { type: Date, default: null },
  salon: { type: String, default: '' },

  calificacionGeneral: { type: Number, required: true, min: 1, max: 5 },
  calificaciones: { type: [calificacionCategoriaSchema], default: [] },
  recomendaria: { type: Boolean, required: true },
  volveriaContratar: { type: Boolean, required: true },
  canalReferencia: { type: String, required: true },
  comidaTags: { type: [String], default: [] },
  candybarTags: { type: [String], default: [] },
  loMejor: { type: [String], default: [] },
  queMejorar: { type: [String], default: [] },
  testimonioAutorizado: { type: Boolean, default: false },

  firmante: { type: String, required: true },
  firmaUrl: { type: String, required: true },
}, { timestamps: true });

// Una sola encuesta por reserva
encuestaSatisfaccionSchema.index({ reservaId: 1 }, { unique: true });

module.exports = mongoose.model('EncuestaSatisfaccion', encuestaSatisfaccionSchema);
