// models/Producto.js
const mongoose = require('mongoose');

const productoSchema = new mongoose.Schema({
  nombre:    { type: String, required: true, trim: true },
  categoria: { type: String, required: true, trim: true },
  cantidad:  { type: Number, required: true, min: 0 }, // ← este es tu stock
  precio:    { type: Number, required: true, min: 0 },
  descripcion:{ type: String, default: '' },
  imagen:    { type: String, default: '' },
  creadoEn:  { type: Date, default: Date.now }
});
module.exports = mongoose.model('Producto', productoSchema);
