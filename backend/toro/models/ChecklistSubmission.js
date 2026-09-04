const mongoose = require('mongoose');
const toroConnection = require('../db');

const responseSchema = new mongoose.Schema(
  {
    itemText: { type: String, required: true },
    status: { type: String, enum: ['ok', 'fail', 'na'], required: true },
    note: { type: String, default: '' },
    photos: {
      type: [String],
      required: true,
      validate: {
        validator: (arr) => Array.isArray(arr) && arr.length > 0,
        message: 'Cada punto requiere al menos una foto de evidencia',
      },
    },
  },
  { _id: false }
);

const checklistSubmissionSchema = new mongoose.Schema(
  {
    area: { type: mongoose.Schema.Types.ObjectId, ref: 'Area', required: true },
    areaName: { type: String, required: true },
    shift: { type: String, enum: ['apertura', 'cierre'], required: true },
    employeeName: { type: String, required: true },
    responses: { type: [responseSchema], required: true },
    overallStatus: { type: String, enum: ['completo', 'con_pendientes'], required: true },
    completedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

module.exports = toroConnection.model('ChecklistSubmission', checklistSubmissionSchema);
