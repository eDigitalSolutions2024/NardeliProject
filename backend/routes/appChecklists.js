const router = require('express').Router();
const path = require('path');
const fs = require('fs');
const ChecklistTemplate = require('../models/ChecklistTemplate');
const EventChecklist = require('../models/EventChecklist');

// ── Multer ────────────────────────────────────────────────────────────────
let upload;
try {
  const multer = require('multer');
  const uploadDir = path.join(__dirname, '..', 'uploads', 'checklists');
  if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
  const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename: (req, file, cb) => cb(null, `${Date.now()}-${Math.random().toString(36).slice(2)}${path.extname(file.originalname)}`)
  });
  upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 } });
} catch {
  upload = { single: () => (req, res, next) => res.status(501).json({ error: 'multer no instalado' }) };
}

// ═══════════════════════════════════════════════════════════════
// PLANTILLAS — CRUD completo
// ═══════════════════════════════════════════════════════════════

// GET /api/app/checklist-templates — listar todas
router.get('/checklist-templates', async (req, res) => {
  try {
    res.json(await ChecklistTemplate.find({ active: true }).sort({ name: 1 }));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/app/checklist-templates/:id — detalle
router.get('/checklist-templates/:id', async (req, res) => {
  try {
    const tpl = await ChecklistTemplate.findById(req.params.id);
    if (!tpl) return res.status(404).json({ error: 'Plantilla no encontrada' });
    res.json(tpl);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/app/checklist-templates — crear plantilla
router.post('/checklist-templates', async (req, res) => {
  try {
    const { name, icon = '📋', items = [] } = req.body;
    if (!name) return res.status(400).json({ error: 'El nombre es requerido' });
    const category = `tpl_${name.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '')}_${Date.now()}`;
    const tpl = await ChecklistTemplate.create({
      name, category, icon,
      items: items.map((it, i) => ({ ...it, order: i })),
      active: true
    });
    res.status(201).json(tpl);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PUT /api/app/checklist-templates/:id — renombrar / cambiar ícono
router.put('/checklist-templates/:id', async (req, res) => {
  try {
    const { name, icon } = req.body;
    const tpl = await ChecklistTemplate.findById(req.params.id);
    if (!tpl) return res.status(404).json({ error: 'Plantilla no encontrada' });
    if (name) tpl.name = name;
    if (icon) tpl.icon = icon;
    await tpl.save();
    res.json(tpl);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// DELETE /api/app/checklist-templates/:id — desactivar
router.delete('/checklist-templates/:id', async (req, res) => {
  try {
    await ChecklistTemplate.findByIdAndUpdate(req.params.id, { active: false });
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/app/checklist-templates/:id/items — agregar tarea a plantilla
router.post('/checklist-templates/:id/items', async (req, res) => {
  try {
    const { title, description, requiresPhoto, requiresObservation } = req.body;
    if (!title) return res.status(400).json({ error: 'El título es requerido' });
    const tpl = await ChecklistTemplate.findById(req.params.id);
    if (!tpl) return res.status(404).json({ error: 'Plantilla no encontrada' });
    tpl.items.push({ title, description, requiresPhoto: !!requiresPhoto, requiresObservation: !!requiresObservation, order: tpl.items.length });
    await tpl.save();
    res.status(201).json(tpl.items[tpl.items.length - 1]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PUT /api/app/checklist-templates/:id/items/:itemId — editar tarea de plantilla
router.put('/checklist-templates/:id/items/:itemId', async (req, res) => {
  try {
    const tpl = await ChecklistTemplate.findById(req.params.id);
    if (!tpl) return res.status(404).json({ error: 'Plantilla no encontrada' });
    const item = tpl.items.id(req.params.itemId);
    if (!item) return res.status(404).json({ error: 'Tarea no encontrada' });
    const { title, description, requiresPhoto, requiresObservation } = req.body;
    if (title !== undefined) item.title = title;
    if (description !== undefined) item.description = description;
    if (requiresPhoto !== undefined) item.requiresPhoto = requiresPhoto;
    if (requiresObservation !== undefined) item.requiresObservation = requiresObservation;
    await tpl.save();
    res.json(item);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// DELETE /api/app/checklist-templates/:id/items/:itemId — eliminar tarea de plantilla
router.delete('/checklist-templates/:id/items/:itemId', async (req, res) => {
  try {
    const tpl = await ChecklistTemplate.findById(req.params.id);
    if (!tpl) return res.status(404).json({ error: 'Plantilla no encontrada' });
    tpl.items = tpl.items.filter(i => i._id.toString() !== req.params.itemId);
    await tpl.save();
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/app/checklist-templates/seed — datos iniciales (una sola vez)
router.post('/checklist-templates/seed', async (req, res) => {
  try {
    const existing = await ChecklistTemplate.countDocuments();
    if (existing > 0) return res.json({ msg: 'Las plantillas ya existen', count: existing });
    const plantillas = [
      { category: 'salon', name: 'Salón', icon: '🏛️', items: [
        { title: 'Revisión de mesas y sillas', requiresPhoto: true, order: 1 },
        { title: 'Mantelería limpia y bien colocada', requiresPhoto: true, order: 2 },
        { title: 'Centros de mesa instalados', requiresPhoto: true, order: 3 },
        { title: 'Iluminación funcionando', requiresObservation: true, order: 4 },
        { title: 'Temperatura del aire acondicionado', requiresObservation: true, order: 5 },
        { title: 'Pista de baile limpia', order: 6 },
        { title: 'Música de ambiente lista', requiresObservation: true, order: 7 },
      ]},
      { category: 'candy_bar', name: 'Candy Bar', icon: '🍬', items: [
        { title: 'Mesa decorada según tema', requiresPhoto: true, order: 1 },
        { title: 'Dulces y bocadillos surtidos', requiresPhoto: true, order: 2 },
        { title: 'Recipientes limpios y etiquetados', order: 3 },
        { title: 'Bolsas o empaques disponibles', order: 4 },
        { title: 'Personal asignado presente', requiresObservation: true, order: 5 },
      ]},
      { category: 'banos', name: 'Baños', icon: '🚿', items: [
        { title: 'Baños limpios y desinfectados', requiresPhoto: true, order: 1 },
        { title: 'Papel higiénico abastecido', order: 2 },
        { title: 'Jabón y toallas disponibles', order: 3 },
        { title: 'Aromatizante aplicado', order: 4 },
        { title: 'Basureros vacíos', order: 5 },
        { title: 'Espejos limpios', requiresPhoto: true, order: 6 },
      ]},
      { category: 'lobby', name: 'Lobby', icon: '🚪', items: [
        { title: 'Recepción decorada', requiresPhoto: true, order: 1 },
        { title: 'Señalización del evento colocada', requiresPhoto: true, order: 2 },
        { title: 'Personal de bienvenida en posición', requiresObservation: true, order: 3 },
        { title: 'Área de registro lista', order: 4 },
        { title: 'Iluminación exterior funcionando', order: 5 },
      ]},
      { category: 'barra', name: 'Barra', icon: '🍹', items: [
        { title: 'Barra limpia y organizada', requiresPhoto: true, order: 1 },
        { title: 'Bebidas e hielo abastecidos', requiresPhoto: true, order: 2 },
        { title: 'Copas y vasos limpios', order: 3 },
        { title: 'Barman presente y uniformado', requiresObservation: true, order: 4 },
        { title: 'Carta de cócteles disponible', order: 5 },
      ]},
      { category: 'proveedores', name: 'Proveedores', icon: '🚚', items: [
        { title: 'Proveedor de audio/video instalado', requiresObservation: true, order: 1 },
        { title: 'Proveedor de flores/decoración listo', requiresPhoto: true, order: 2 },
        { title: 'Catering confirmado y en tiempo', requiresObservation: true, order: 3 },
        { title: 'Fotógrafo/videógrafo presente', requiresObservation: true, order: 4 },
        { title: 'Todos los contratos firmados', order: 5 },
      ]},
      { category: 'degustacion', name: 'Degustación', icon: '🍽️', items: [
        { title: 'Menú degustación preparado', requiresPhoto: true, order: 1 },
        { title: 'Presentación de platillos correcta', requiresPhoto: true, order: 2 },
        { title: 'Temperatura adecuada de alimentos', requiresObservation: true, order: 3 },
        { title: 'Meseros uniformados y listos', requiresObservation: true, order: 4 },
        { title: 'Cocina limpia y organizada', requiresPhoto: true, order: 5 },
      ]},
    ];
    await ChecklistTemplate.insertMany(plantillas);
    res.json({ msg: 'Plantillas creadas exitosamente', count: plantillas.length });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ═══════════════════════════════════════════════════════════════
// CHECKLISTS DE EVENTO
// ═══════════════════════════════════════════════════════════════

// GET /api/app/checklists/evento/:eventId — checklists asignados al evento
router.get('/checklists/evento/:eventId', async (req, res) => {
  try {
    const checklists = await EventChecklist.find({ eventExternalId: req.params.eventId })
      .select('category categoryName icon status completedCount totalCount template')
      .sort({ createdAt: 1 });
    res.json(checklists);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/app/checklists/evento/:eventId/asignar — asignar plantilla a evento
router.post('/checklists/evento/:eventId/asignar', async (req, res) => {
  try {
    const { templateId } = req.body;
    if (!templateId) return res.status(400).json({ error: 'templateId requerido' });
    const tpl = await ChecklistTemplate.findById(templateId);
    if (!tpl) return res.status(404).json({ error: 'Plantilla no encontrada' });

    // Evitar duplicados de la misma plantilla en el mismo evento
    const exists = await EventChecklist.findOne({ eventExternalId: req.params.eventId, template: templateId });
    if (exists) return res.status(409).json({ error: 'Esta área ya está en el evento', checklist: exists });

    const items = tpl.items.map(i => ({
      templateItemId: i._id, title: i.title, description: i.description,
      requiresPhoto: i.requiresPhoto, requiresObservation: i.requiresObservation, order: i.order
    }));
    const cl = await EventChecklist.create({
      eventExternalId: req.params.eventId,
      template: tpl._id,
      category: tpl.category,
      categoryName: tpl.name,
      icon: tpl.icon || '📋',
      items,
      totalCount: items.length
    });
    res.status(201).json(cl);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/app/checklists/evento/:eventId — crear área personalizada (sin plantilla)
router.post('/checklists/evento/:eventId', async (req, res) => {
  try {
    const { categoryName, icon = '📋', items = [] } = req.body;
    if (!categoryName) return res.status(400).json({ error: 'El nombre es requerido' });
    const category = `custom_${Date.now()}`;
    const mappedItems = items.map((item, i) => ({
      title: item.title, description: item.description || '',
      requiresPhoto: !!item.requiresPhoto, requiresObservation: !!item.requiresObservation, order: i
    }));
    const cl = await EventChecklist.create({
      eventExternalId: req.params.eventId, category, categoryName, icon,
      items: mappedItems, totalCount: mappedItems.length
    });
    res.status(201).json(cl);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/app/checklists/:id — checklist completo con items
router.get('/checklists/:id', async (req, res) => {
  try {
    const cl = await EventChecklist.findById(req.params.id);
    if (!cl) return res.status(404).json({ error: 'Checklist no encontrado' });
    res.json(cl);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PUT /api/app/checklists/:id — renombrar checklist del evento
router.put('/checklists/:id', async (req, res) => {
  try {
    const { categoryName, icon } = req.body;
    const cl = await EventChecklist.findById(req.params.id);
    if (!cl) return res.status(404).json({ error: 'Checklist no encontrado' });
    if (categoryName) cl.categoryName = categoryName;
    if (icon) cl.icon = icon;
    await cl.save();
    res.json(cl);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// DELETE /api/app/checklists/:id — quitar checklist del evento
router.delete('/checklists/:id', async (req, res) => {
  try {
    await EventChecklist.findByIdAndDelete(req.params.id);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/app/checklists/:id/items — agregar tarea al checklist del evento
router.post('/checklists/:id/items', async (req, res) => {
  try {
    const { title, description, requiresPhoto, requiresObservation } = req.body;
    if (!title) return res.status(400).json({ error: 'El título es requerido' });
    const cl = await EventChecklist.findById(req.params.id);
    if (!cl) return res.status(404).json({ error: 'Checklist no encontrado' });
    cl.items.push({ title, description, requiresPhoto: !!requiresPhoto, requiresObservation: !!requiresObservation, order: cl.items.length });
    cl.recalcProgress();
    await cl.save();
    res.status(201).json(cl.items[cl.items.length - 1]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PUT /api/app/checklists/:checklistId/items/:itemId — editar tarea
router.put('/checklists/:checklistId/items/:itemId', async (req, res) => {
  try {
    const cl = await EventChecklist.findById(req.params.checklistId);
    if (!cl) return res.status(404).json({ error: 'Checklist no encontrado' });
    const item = cl.items.id(req.params.itemId);
    if (!item) return res.status(404).json({ error: 'Tarea no encontrada' });
    const { title, description, requiresPhoto, requiresObservation } = req.body;
    if (title !== undefined) item.title = title;
    if (description !== undefined) item.description = description;
    if (requiresPhoto !== undefined) item.requiresPhoto = requiresPhoto;
    if (requiresObservation !== undefined) item.requiresObservation = requiresObservation;
    await cl.save();
    res.json(item);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// DELETE /api/app/checklists/:checklistId/items/:itemId — eliminar tarea
router.delete('/checklists/:checklistId/items/:itemId', async (req, res) => {
  try {
    const cl = await EventChecklist.findById(req.params.checklistId);
    if (!cl) return res.status(404).json({ error: 'Checklist no encontrado' });
    cl.items = cl.items.filter(i => i._id.toString() !== req.params.itemId);
    cl.recalcProgress();
    await cl.save();
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PATCH /api/app/checklists/:checklistId/items/:itemId — marcar/observación (operativo)
router.patch('/checklists/:checklistId/items/:itemId', async (req, res) => {
  try {
    const { completed, observation } = req.body;
    const cl = await EventChecklist.findById(req.params.checklistId);
    if (!cl) return res.status(404).json({ error: 'Checklist no encontrado' });
    const item = cl.items.id(req.params.itemId);
    if (!item) return res.status(404).json({ error: 'Tarea no encontrada' });
    if (completed !== undefined) { item.completed = completed; item.completedAt = completed ? new Date() : undefined; }
    if (observation !== undefined) item.observation = observation;
    cl.recalcProgress();
    await cl.save();
    res.json({ item, status: cl.status, completedCount: cl.completedCount, totalCount: cl.totalCount });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Evidencias
router.post('/checklists/:checklistId/items/:itemId/evidence', upload.single('photo'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No se recibió archivo' });
    const cl = await EventChecklist.findById(req.params.checklistId);
    if (!cl) return res.status(404).json({ error: 'Checklist no encontrado' });
    const item = cl.items.id(req.params.itemId);
    if (!item) return res.status(404).json({ error: 'Tarea no encontrada' });
    const evidence = { url: `/uploads/checklists/${req.file.filename}`, filename: req.file.originalname, uploadedAt: new Date() };
    item.evidence.push(evidence);
    await cl.save();
    res.json(evidence);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/checklists/:checklistId/items/:itemId/evidence/:evId', async (req, res) => {
  try {
    const cl = await EventChecklist.findById(req.params.checklistId);
    if (!cl) return res.status(404).json({ error: 'Checklist no encontrado' });
    const item = cl.items.id(req.params.itemId);
    if (!item) return res.status(404).json({ error: 'Tarea no encontrada' });
    item.evidence = item.evidence.filter(e => e._id.toString() !== req.params.evId);
    await cl.save();
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Sync offline
router.post('/checklists/sync', async (req, res) => {
  try {
    const { updates = [] } = req.body;
    const results = [];
    for (const u of updates) {
      const cl = await EventChecklist.findById(u.checklistId);
      if (!cl) continue;
      const item = cl.items.id(u.itemId);
      if (!item) continue;
      if (u.completed !== undefined) { item.completed = u.completed; item.completedAt = u.completedAt ? new Date(u.completedAt) : new Date(); }
      if (u.observation !== undefined) item.observation = u.observation;
      cl.recalcProgress();
      await cl.save();
      results.push({ checklistId: u.checklistId, itemId: u.itemId, ok: true });
    }
    res.json({ synced: results.length, results });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
