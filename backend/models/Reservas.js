const mongoose = require('mongoose');

const reservaSchema = new mongoose.Schema({
  cliente: {
    type: String,
    required: true
  },
  correo: {
    type: String,
    required: true
  },
  tipoEvento: {
    type: String,
    required: true
  },
  fecha: {
    type: Date,
    required: true
  },
  horaInicio: {
    type: String,
    required: true
  },
  horaFin: {
    type: String,
    required: true
  },
  telefono: {
    type: String,
    required: true
  },
  cantidadPersonas: {
    type: Number,
    required: true
  },
  descripcion: {
    type: String,
    default: ''
  },
  creadoEn: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Reserva', reservaSchema);
