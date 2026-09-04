const ChecklistSubmission = require('../models/ChecklistSubmission');

async function createSubmission(req, res) {
  const { area, areaName, shift, employeeName, responses } = req.body;

  if (!area || !areaName || !shift || !employeeName || !Array.isArray(responses)) {
    return res.status(400).json({ message: 'Faltan datos del checklist' });
  }

  if (responses.some((r) => !Array.isArray(r.photos) || r.photos.length === 0)) {
    return res.status(400).json({ message: 'Cada punto del checklist requiere al menos una foto de evidencia' });
  }

  const overallStatus = responses.some((r) => r.status === 'fail') ? 'con_pendientes' : 'completo';

  const submission = await ChecklistSubmission.create({
    area,
    areaName,
    shift,
    employeeName,
    responses,
    overallStatus,
  });

  res.status(201).json(submission);
}

async function listSubmissions(req, res) {
  const { date, area, shift } = req.query;
  const filter = {};

  if (area) filter.area = area;
  if (shift) filter.shift = shift;
  if (date) {
    const start = new Date(date);
    const end = new Date(date);
    end.setDate(end.getDate() + 1);
    filter.completedAt = { $gte: start, $lt: end };
  }

  const submissions = await ChecklistSubmission.find(filter).sort({ completedAt: -1 });
  res.json(submissions);
}

async function getSubmission(req, res) {
  const submission = await ChecklistSubmission.findById(req.params.id);
  if (!submission) return res.status(404).json({ message: 'Registro no encontrado' });
  res.json(submission);
}

module.exports = { createSubmission, listSubmissions, getSubmission };
