const Area = require('../models/Area');

async function listAreas(req, res) {
  const areas = await Area.find({ active: true }).sort({ order: 1 });
  res.json(areas);
}

async function getArea(req, res) {
  const area = await Area.findById(req.params.id);
  if (!area) return res.status(404).json({ message: 'Área no encontrada' });
  res.json(area);
}

async function createArea(req, res) {
  const area = await Area.create(req.body);
  res.status(201).json(area);
}

async function updateArea(req, res) {
  const area = await Area.findByIdAndUpdate(req.params.id, req.body, { new: true });
  if (!area) return res.status(404).json({ message: 'Área no encontrada' });
  res.json(area);
}

module.exports = { listAreas, getArea, createArea, updateArea };
