// backend/models/Receipt.js
const mongoose = require('mongoose');

const receiptSchema = new mongoose.Schema({
  orderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Reserva', required: true, index: true },
  folio:   { type: String, index: true },
  amount:  { type: Number, required: true, min: 0 },
  paymentMethod: { type: String, enum: ['EFECTIVO','TARJETA','TRANSFERENCIA','OTRO'], default: 'EFECTIVO' },
  currency: { type: String, default: 'MXN' },
  concept:  { type: String, default: '' },
  customerName: { type: String, default: '' },
  issuedAt: { type: Date, default: Date.now },
  notes:   { type: String, default: '' },
  issuedBy: { type: String, default: 'sistema' },
  taxRate: { type: Number, default: 0 },
}, { timestamps: true });

module.exports = mongoose.model('Receipt', receiptSchema);
