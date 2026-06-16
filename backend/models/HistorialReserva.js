const mongoose = require('mongoose');

const HistorialSchema = new mongoose.Schema({
  reservaId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Reserva',
    required: true
  },

  tipo: {
    type: String,
    enum: ['producto', 'descuento', 'campo', 'whatsapp', 'conversion'],
    required: true
  },

  accion: {
    type: String,
    enum: [
      'add',
      'remove',
      'update',
      'discount_add',
      'discount_remove',
      'field_update',
      'alert_sent',
      'alert_error',
      'evento_a_cotizacion',
      'cotizacion_a_evento'
    ],
    required: true
  },

  // ===== Para cambios de producto =====
  producto: {
    id: String,
    nombre: String
  },

  cantidadAntes: Number,
  cantidadDespues: Number,

  // ===== Para cambios de descuento =====
  descuentoAntes: Number,
  descuentoDespues: Number,

  // ===== Para cambios generales =====
  campo: { type: String, default: '' },
  etiqueta: { type: String, default: '' },
  valorAntes: { type: mongoose.Schema.Types.Mixed, default: null },
  valorDespues: { type: mongoose.Schema.Types.Mixed, default: null },

  // ===== Para log de WhatsApp =====
  destino: { type: String, default: '' },
  mensaje: { type: String, default: '' },
  error: { type: String, default: '' },

  usuario: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Usuario',
    default: null
  },

  usuarioEmail: { type: String, default: '' },
  usuarioRole: { type: String, default: '' },

  fecha: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('HistorialReserva', HistorialSchema);