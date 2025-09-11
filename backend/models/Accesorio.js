// models/Accesorio.js
const mongoose = require('mongoose');

const accesorioSchema = new mongoose.Schema({
  nombre: { type: String, required: true, trim: true },
  categoria: { type: String, default: 'Accesorio' },
  unidad: { type: String, default: 'pza' },
  stock: { type: Number, default: 0, min: 0 },
  imagen: { type: String, default: '' },
  descripcion: { type: String, default: '' },
  activo: { type: Boolean, default: true },

  // para contrato/responsiva
  esPrestamo: { type: Boolean, default: true },           // normalmente true
  precioReposicion: { type: Number, default: 0 },         // si quieres listar reposición en el contrato
}, { timestamps: true });

module.exports = mongoose.model('Accesorio', accesorioSchema);
