const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const JWT_SECRET = require('../utils/jwtSecret');
const Producto = require('../models/Producto');
const multer = require('multer');
const path = require('path');

// Solo staff administra el catálogo de productos (el inventario público de
// consulta sigue abierto en GET /inventario, que usan los clientes).
function requireStaff(req, res, next) {
  const h = req.headers.authorization || '';
  const t = h.startsWith('Bearer ') ? h.slice(7) : null;
  if (!t) return res.status(401).json({ msg: 'No autorizado' });
  try {
    const payload = jwt.verify(t, JWT_SECRET);
    if (payload.role !== 'admin' && payload.role !== 'asistente') {
      return res.status(403).json({ msg: 'Requiere permisos de staff' });
    }
    req.user = payload;
    next();
  } catch {
    return res.status(401).json({ msg: 'Token inválido' });
  }
}

// ===== Multer (imagen opcional) =====
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, 'uploads/'),
  filename: (_req, file, cb) => {
    const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, file.fieldname + '-' + unique + path.extname(file.originalname));
  }
});
const upload = multer({ storage });

// ===== Helpers =====
const toNumber = (v, def = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : def;
};

// ====== CREATE (con/sin imagen) ======
router.post('/', requireStaff, upload.single('imagen'), async (req, res) => {
  try {
    const body = req.body || {};
    const nuevoProducto = new Producto({
      nombre: body.nombre,
      categoria: (body.categoria || '').toLowerCase(),
      cantidad: toNumber(body.cantidad, 0),   // <- stock
      precio: toNumber(body.precio, 0),
      descripcion: body.descripcion || '',
      imagen: req.file ? `/uploads/${req.file.filename}` : (body.imagen || '')
    });

    const guardado = await nuevoProducto.save();
    return res.status(201).json(guardado);
  } catch (error) {
    console.error('Error al guardar producto:', error);
    return res.status(400).json({ msg: 'Error al registrar el producto' });
  }
});

// ====== READ all ======
router.get('/', requireStaff, async (_req, res) => {
  try {
    const productos = await Producto.find().sort({ creadoEn: -1 });
    return res.json(productos);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ msg: 'Error al obtener los productos' });
  }
});

// ====== INVENTARIO para el Dashboard del Cliente ======
// Devuelve items normalizados: {_id, nombre, categoria, unidad, imagen, stock}
router.get('/inventario', async (req, res) => {
  try {
    const { categoria = '', q = '' } = req.query;

    const filtro = {};
    if (categoria) filtro.categoria = categoria.toLowerCase();
    if (q) filtro.nombre = { $regex: q, $options: 'i' };

    const prods = await Producto.find(filtro)
      .select('nombre categoria cantidad precio descripcion imagen') // ajusta si tu modelo tiene otros campos
      .lean();

    const items = prods.map(p => ({
      _id: p._id,
      nombre: p.nombre || 'Ítem',
      categoria: p.categoria || 'general',
      unidad: p.unidad || 'pza',    // si tu modelo no tiene "unidad", se mostrará 'pza'
      imagen: p.imagen || null,
      stock: Number(p.cantidad ?? 0),
      stock: Number(p.cantidad ?? 0) // 👈 importante: stock = cantidad
    }));

    return res.json(items);
  } catch (e) {
    console.error('inventario:', e);
    return res.status(500).json({ msg: 'Error cargando inventario' });
  }
});

// ====== READ one (útil para admin/edición) ======
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) return res.status(400).json({ msg: 'ID inválido' });
    const prod = await Producto.findById(id);
    if (!prod) return res.status(404).json({ msg: 'Producto no encontrado' });
    return res.json(prod);
  } catch (e) {
    console.error(e);
    return res.status(500).json({ msg: 'Error del servidor' });
  }
});

// ====== UPDATE (con/sin nueva imagen) ======
router.put('/:id', requireStaff, upload.single('imagen'), async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) return res.status(400).json({ msg: 'ID inválido' });

    const body = req.body || {};
    const update = {
      nombre: body.nombre,
      categoria: body.categoria ? body.categoria.toLowerCase() : undefined,
      cantidad: body.cantidad !== undefined ? toNumber(body.cantidad) : undefined,
      precio: body.precio !== undefined ? toNumber(body.precio) : undefined,
      descripcion: body.descripcion
    };

    if (req.file) update.imagen = `/uploads/${req.file.filename}`;
    // limpia undefined
    Object.keys(update).forEach(k => update[k] === undefined && delete update[k]);

    const actualizado = await Producto.findByIdAndUpdate(id, update, {
      new: true,
      runValidators: true
    });
    if (!actualizado) return res.status(404).json({ msg: 'Producto no encontrado' });
    return res.json(actualizado);
  } catch (error) {
    console.error(error);
    return res.status(400).json({ msg: 'Error al actualizar el producto' });
  }
});

// ====== DELETE ======
router.delete('/:id', requireStaff, async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) return res.status(400).json({ msg: 'ID inválido' });

    const eliminado = await Producto.findByIdAndDelete(id);
    if (!eliminado) return res.status(404).json({ msg: 'Producto no encontrado' });
    return res.json({ msg: 'Producto eliminado correctamente' });
  } catch (error) {
    console.error(error);
    return res.status(400).json({ msg: 'Error al eliminar el producto' });
  }
});

module.exports = router;
