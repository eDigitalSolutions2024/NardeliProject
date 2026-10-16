const router = require('express').Router();
const mongoose = require('mongoose');
const Accesorio = require('../models/Accesorio');
// 👇 NUEVO
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const jwt = require('jsonwebtoken');
const JWT_SECRET = require('../utils/jwtSecret');
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 } // 5 MB
});

// Solo staff da de alta accesorios en el catálogo (listar sigue abierto,
// los clientes también consultan accesorios disponibles para su evento).
const { requirePermission } = require('../utils/permisos');
// Permiso validado contra la base (rol y estado actuales); ver utils/permisos.js
const requireStaff = requirePermission('inventario.gestionar');

// listar activos
router.get('/', async (_req, res) => {
  const list = await Accesorio.find({ activo: true }).sort({ nombre: 1 }).lean();
  res.json(list);
});

// crear (acepta JSON o FormData con campo "imagen")
router.post('/', requireStaff, upload.single('imagen'), async (req, res) => {
  try {
    const b = req.body || {};

    const nombre = (b.nombre || '').trim();
    if (!nombre) return res.status(400).json({ error: 'El nombre es obligatorio' });

    // mapear cantidad -> stock; si no viene, usar stock; default 0
    const cantidad = Number(b.cantidad);
    const stock = Number.isFinite(cantidad) ? cantidad : Number(b.stock) || 0;

    // castear tipos que llegan como string en FormData
    const payload = {
      nombre,
      categoria: (b.categoria || 'Accesorio').toString(),
      unidad: (b.unidad || 'pza').toString(),
      stock,
      precioReposicion: Number(b.precioReposicion) || 0,
      descripcion: b.descripcion || '',
      imagen: b.imagen || '',
      activo: String(b.activo) === 'true' || b.activo === true,
      esPrestamo: String(b.esPrestamo) === 'true' || b.esPrestamo === true
    };

    // si subieron archivo, lo guardamos y seteamos ruta pública
    if (req.file && req.file.buffer) {
      const dir = path.join(process.cwd(), 'public', 'uploads', 'accesorios');
      fs.mkdirSync(dir, { recursive: true });
      const ext = path.extname(req.file.originalname || '').toLowerCase() || '.jpg';
      const fname = `acc_${Date.now()}_${Math.random().toString(36).slice(2)}${ext}`;
      fs.writeFileSync(path.join(dir, fname), req.file.buffer);
      payload.imagen = `/uploads/accesorios/${fname}`; // tu front ya resuelve esta ruta
    }

    const doc = await Accesorio.create(payload);
    res.json(doc);
  } catch (e) {
    console.error('POST /accesorios error:', e);
    res.status(400).json({ error: e.message || 'No se pudo crear el accesorio' });
  }
});


// obtener uno (útil para edición)
router.get('/:id', requireStaff, async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) return res.status(400).json({ error: 'ID inválido' });
    const acc = await Accesorio.findById(id);
    if (!acc) return res.status(404).json({ error: 'Accesorio no encontrado' });
    res.json(acc);
  } catch (e) {
    console.error('GET /accesorios/:id error:', e);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// actualizar (acepta JSON o FormData con campo "imagen")
router.put('/:id', requireStaff, upload.single('imagen'), async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) return res.status(400).json({ error: 'ID inválido' });

    const b = req.body || {};
    const update = {};

    if (b.nombre !== undefined) update.nombre = String(b.nombre).trim();
    if (b.categoria !== undefined) update.categoria = String(b.categoria);
    if (b.unidad !== undefined) update.unidad = String(b.unidad);
    if (b.descripcion !== undefined) update.descripcion = b.descripcion;
    if (b.stock !== undefined) update.stock = Number(b.stock) || 0;
    if (b.cantidad !== undefined) update.stock = Number(b.cantidad) || 0; // alias, igual que en create
    if (b.precioReposicion !== undefined) update.precioReposicion = Number(b.precioReposicion) || 0;
    if (b.activo !== undefined) update.activo = String(b.activo) === 'true' || b.activo === true;
    if (b.esPrestamo !== undefined) update.esPrestamo = String(b.esPrestamo) === 'true' || b.esPrestamo === true;

    // si subieron archivo nuevo, se guarda y reemplaza la ruta; si no, se
    // conserva la imagen que ya tenía el documento.
    if (req.file && req.file.buffer) {
      const dir = path.join(process.cwd(), 'public', 'uploads', 'accesorios');
      fs.mkdirSync(dir, { recursive: true });
      const ext = path.extname(req.file.originalname || '').toLowerCase() || '.jpg';
      const fname = `acc_${Date.now()}_${Math.random().toString(36).slice(2)}${ext}`;
      fs.writeFileSync(path.join(dir, fname), req.file.buffer);
      update.imagen = `/uploads/accesorios/${fname}`;
    }

    const actualizado = await Accesorio.findByIdAndUpdate(id, update, {
      new: true,
      runValidators: true,
    });
    if (!actualizado) return res.status(404).json({ error: 'Accesorio no encontrado' });
    res.json(actualizado);
  } catch (e) {
    console.error('PUT /accesorios/:id error:', e);
    res.status(400).json({ error: e.message || 'No se pudo actualizar el accesorio' });
  }
});

// eliminar
router.delete('/:id', requireStaff, async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) return res.status(400).json({ error: 'ID inválido' });
    const eliminado = await Accesorio.findByIdAndDelete(id);
    if (!eliminado) return res.status(404).json({ error: 'Accesorio no encontrado' });
    res.json({ msg: 'Accesorio eliminado correctamente' });
  } catch (e) {
    console.error('DELETE /accesorios/:id error:', e);
    res.status(400).json({ error: 'Error al eliminar el accesorio' });
  }
});

module.exports = router;
