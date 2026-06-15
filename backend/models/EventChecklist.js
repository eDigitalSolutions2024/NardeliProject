const mongoose = require('mongoose');

const evidenceSchema = new mongoose.Schema({
  url: String,
  filename: String,
  uploadedAt: { type: Date, default: Date.now }
});

const checkItemSchema = new mongoose.Schema({
  templateItemId: mongoose.Schema.Types.ObjectId,
  title: { type: String, required: true },
  description: String,
  requiresPhoto: { type: Boolean, default: false },
  requiresObservation: { type: Boolean, default: false },
  order: { type: Number, default: 0 },
  completed: { type: Boolean, default: false },
  completedAt: Date,
  observation: String,
  evidence: [evidenceSchema]
});

const eventChecklistSchema = new mongoose.Schema({
  eventExternalId: { type: String, required: true, index: true },
  template: { type: mongoose.Schema.Types.ObjectId, ref: 'ChecklistTemplate' },
  // categoria libre — puede ser cualquier string, no solo las 7 estándar
  category: { type: String, required: true },
  categoryName: { type: String, required: true },
  icon: { type: String, default: '📋' },
  items: [checkItemSchema],
  status: { type: String, enum: ['pendiente', 'en_progreso', 'completado'], default: 'pendiente' },
  completedCount: { type: Number, default: 0 },
  totalCount: { type: Number, default: 0 }
}, { timestamps: true });

eventChecklistSchema.methods.recalcProgress = function () {
  this.completedCount = this.items.filter(i => i.completed).length;
  this.totalCount = this.items.length;
  this.status = this.completedCount === 0
    ? 'pendiente'
    : this.completedCount === this.totalCount
      ? 'completado'
      : 'en_progreso';
};

module.exports = mongoose.model('EventChecklist', eventChecklistSchema);
