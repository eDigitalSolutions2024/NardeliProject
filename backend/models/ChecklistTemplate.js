const mongoose = require('mongoose');

const itemSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: String,
  requiresPhoto: { type: Boolean, default: false },
  requiresObservation: { type: Boolean, default: false },
  order: { type: Number, default: 0 }
});

const checklistTemplateSchema = new mongoose.Schema({
  category: { type: String, required: true },
  name: { type: String, required: true },
  icon: { type: String, default: '📋' },
  items: [itemSchema],
  active: { type: Boolean, default: true }
}, { timestamps: true });

module.exports = mongoose.model('ChecklistTemplate', checklistTemplateSchema);
