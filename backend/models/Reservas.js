
const mongoose = require('mongoose');

const utensilioSchema = new mongoose.Schema({
  itemId: { type: mongoose.Schema.Types.ObjectId, ref: 'Producto' },
  nombre: { type: String, required: true },
  cantidad: { type: Number, required: true, min: 0 },
  unidad: { type: String, default: 'pza' },
  categoria: { type: String, default: 'general' }
}, { _id: false });


const reservaSchema = new mongoose.Schema({
  cliente: {type: String, required: true },
  correo: { type: String, required: true, lowercase: true, trim: true, index: true },
  tipoEvento: { type: String, required: true },
  fecha: { type: Date, required: true },
  horaInicio: { type: String, required: true },
  horaFin: { type: String, required: true },
  telefono: { type: String, required: true },
  cantidadPersonas: { type: Number, required: true },
  descripcion: { type: String, default: '' },
  utensilios: { type: [utensilioSchema], default: [] },
  creadoEn: { type: Date, default: Date.now },
  pdfUrl: { type: String, default: null },
  pdfPath: { type: String, default: null }
});





module.exports = mongoose.model('Reserva', reservaSchema);
