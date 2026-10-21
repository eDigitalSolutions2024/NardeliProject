// models/Producto.js
const mongoose = require('mongoose');

// Un renglón por cada campo que cambió en una edición (igual que
// historialCambios en Reservas.js) — quién, cuándo, de qué a qué.
const historialCambioProductoSchema = new mongoose.Schema(
  {
    campo: { type: String, default: '' },       // 'nombre' | 'categoria' | 'cantidad' | 'precio' | 'descripcion' | 'imagen'
    etiqueta: { type: String, default: '' },     // texto para mostrar, ej. 'Precio'
    antes: { type: mongoose.Schema.Types.Mixed, default: null },
    despues: { type: mongoose.Schema.Types.Mixed, default: null },
    usuarioId: { type: mongoose.Schema.Types.ObjectId, ref: 'Usuario', default: null },
    usuarioNombre: { type: String, default: '' },
    usuarioEmail: { type: String, default: '' },
    fecha: { type: Date, default: Date.now },
  },
  { _id: true }
);

const productoSchema = new mongoose.Schema({
  nombre:    { type: String, required: true, trim: true },
  categoria: { type: String, required: true, trim: true },
  cantidad:  { type: Number, required: true, min: 0 }, // ← este es tu stock
  precio:    { type: Number, required: true, min: 0 },
  descripcion:{ type: String, default: '' },
  imagen:    { type: String, default: '' },
  creadoEn:  { type: Date, default: Date.now },
  historialCambios: { type: [historialCambioProductoSchema], default: [] },
}, { timestamps: true });
module.exports = mongoose.model('Producto', productoSchema);
