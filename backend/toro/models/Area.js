const mongoose = require('mongoose');
const toroConnection = require('../db');

const checklistItemSchema = new mongoose.Schema(
  {
    text: { type: String, required: true },
    order: { type: Number, default: 0 },
  },
  { _id: true }
);

const areaSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true },
    icon: { type: String, default: '📋' },
    order: { type: Number, default: 0 },
    active: { type: Boolean, default: true },
    items: [checklistItemSchema],
  },
  { timestamps: true }
);

module.exports = toroConnection.model('Area', areaSchema);
