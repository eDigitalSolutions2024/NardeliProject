// models/Reservas.js
const mongoose = require('mongoose');

// -------- Subdocumento de utensilios --------
// IMPORTANTE: NO desactives _id (lo usamos en PATCH /utensilios/:lineId)
const utensilioSchema = new mongoose.Schema(
  {
    itemId: { type: mongoose.Schema.Types.ObjectId, ref: 'Producto' },
    nombre: { type: String, required: true, trim: true },
    cantidad: { type: Number, required: true, min: 0 },
    unidad: { type: String, default: 'pza' },
    categoria: { type: String, default: 'general' },
    precio: { type: Number, min: 0, default: 0 },
    descripcion: { type: String, default: '' },
    imagen: { type: String, default: '' },
  },
  { _id: true } // <- necesario para editar líneas por ID
);

// -------- Esquema principal de Reserva --------
const reservaSchema = new mongoose.Schema(
  {
    // Datos de la persona / autenticación opcional
    clienteId: { type: mongoose.Schema.Types.ObjectId, ref: 'Usuario', default: null },

    // Datos básicos
    cliente: { type: String, required: true, trim: true },
    correo: { type: String, required: true, lowercase: true, trim: true, index: true },
    telefono: { type: String, required: true, trim: true },

    // Evento
    tipoEvento: { type: String, required: true, trim: true },
    fecha: { type: Date, required: true, index: true },
    horaInicio: { type: String, required: true }, // "HH:mm"
    horaFin: { type: String, required: true },    // "HH:mm"
    cantidadPersonas: { type: Number, required: true, min: 0 },
    descripcion: { type: String, default: '' },

    // Ítems seleccionados
    utensilios: { type: [utensilioSchema], default: [] },

    // Estado de la reserva de flujo interno (para /reservas/activa)
    estado: {
      type: String,
      enum: ['borrador', 'confirmada', 'cancelada'],
      default: 'confirmada',
      index: true,
    },

    // Cotización / Evento
    tipoReserva: {
      type: String,
      enum: ['cotizacion', 'evento'],
      default: 'evento',
      index: true,
    },
    cotizacion: {
      aceptada: { type: Boolean, default: false },
      aceptadaEn: { type: Date, default: null },
      nota: { type: String, default: '' },
    },

    // Precios / Descuento global (persistente)
    precios: {
      moneda: { type: String, default: 'MXN' },
      descuento: {
        tipo: { type: String, enum: ['monto', 'porcentaje'], default: 'monto' },
        valor: { type: Number, default: 0, min: 0 }, // % o monto según 'tipo'
        motivo: { type: String, default: '' },
      },
      // opcionales por si los quieres guardar además del virtual
      subtotal: { type: Number, default: 0 },
      total: { type: Number, default: 0 },
    },

    // Archivos / otros
    pdfUrl: { type: String, default: null },
    pdfPath: { type: String, default: null },
  },
  {
    timestamps: true,            // createdAt / updatedAt
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// -------- Virtuales útiles (no pisan precios.subtotal/total) --------
reservaSchema.virtual('subTotal').get(function () {
  const items = this.utensilios || [];
  return items.reduce((acc, it) => {
    const p = Number(it?.precio || 0);
    const q = Number(it?.cantidad || 0);
    return acc + p * q;
  }, 0);
});

reservaSchema.virtual('descuentoCalculado').get(function () {
  const d = this.precios?.descuento;
  const st = Number(this.subTotal || 0);
  if (!d || !Number.isFinite(d.valor) || d.valor <= 0) return 0;

  if (d.tipo === 'porcentaje') {
    const pct = Math.max(0, Math.min(100, Number(d.valor)));
    return Math.min(st, st * (pct / 100));
  }
  const monto = Math.max(0, Number(d.valor));
  return Math.min(st, monto);
});

reservaSchema.virtual('totalVirtual').get(function () {
  const st = Number(this.subTotal || 0);
  const desc = Number(this.descuentoCalculado || 0);
  return Math.max(0, st - desc);
});

// -------- Índices de ayuda --------
reservaSchema.index({ fecha: 1, horaInicio: 1 });
reservaSchema.index({ tipoReserva: 1, fecha: 1 });

module.exports = mongoose.model('Reserva', reservaSchema);
