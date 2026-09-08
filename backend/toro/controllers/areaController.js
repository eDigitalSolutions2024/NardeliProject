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
  const { name, icon, order, items } = req.body;
  if (!name) return res.status(400).json({ message: 'El nombre del área es requerido' });
  const area = await Area.create({
    name,
    icon: icon || '📋',
    order: order ?? 0,
    items: Array.isArray(items) ? items : [],
  });
  res.status(201).json(area);
}

async function updateArea(req, res) {
  const area = await Area.findByIdAndUpdate(req.params.id, req.body, { new: true });
  if (!area) return res.status(404).json({ message: 'Área no encontrada' });
  res.json(area);
}

// Baja lógica (no se borra de la base, solo deja de listarse/usarse).
async function deleteArea(req, res) {
  const area = await Area.findByIdAndUpdate(req.params.id, { active: false }, { new: true });
  if (!area) return res.status(404).json({ message: 'Área no encontrada' });
  res.json({ ok: true });
}

async function addItem(req, res) {
  const { text, order } = req.body;
  if (!text) return res.status(400).json({ message: 'El texto de la tarea es requerido' });
  const area = await Area.findById(req.params.id);
  if (!area) return res.status(404).json({ message: 'Área no encontrada' });
  area.items.push({ text, order: order ?? area.items.length });
  await area.save();
  res.status(201).json(area.items[area.items.length - 1]);
}

async function updateItem(req, res) {
  const { text, order } = req.body;
  const area = await Area.findById(req.params.id);
  if (!area) return res.status(404).json({ message: 'Área no encontrada' });
  const item = area.items.id(req.params.itemId);
  if (!item) return res.status(404).json({ message: 'Tarea no encontrada' });
  if (text !== undefined) item.text = text;
  if (order !== undefined) item.order = order;
  await area.save();
  res.json(item);
}

async function deleteItem(req, res) {
  const area = await Area.findById(req.params.id);
  if (!area) return res.status(404).json({ message: 'Área no encontrada' });
  area.items = area.items.filter((i) => i._id.toString() !== req.params.itemId);
  await area.save();
  res.json({ ok: true });
}

module.exports = {
  listAreas,
  getArea,
  createArea,
  updateArea,
  deleteArea,
  addItem,
  updateItem,
  deleteItem,
};
