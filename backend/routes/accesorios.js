const router = require('express').Router();
const Accesorio = require('../models/Accesorio');
// 👇 NUEVO
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 } // 5 MB
});

// listar activos
router.get('/', async (_req, res) => {
  const list = await Accesorio.find({ activo: true }).sort({ nombre: 1 }).lean();
  res.json(list);
});

// crear (acepta JSON o FormData con campo "imagen")
router.post('/', upload.single('imagen'), async (req, res) => {
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



module.exports = router;
