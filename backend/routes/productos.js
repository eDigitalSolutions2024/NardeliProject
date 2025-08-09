const express = require('express');
const router = express.Router();
const Producto = require('../models/Producto');
const multer = require('multer');
const path = require('path');

// Configuración de multer
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/'); // carpeta donde se guarda
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, file.fieldname + '-' + uniqueSuffix + ext);
  }
});

const upload = multer({ storage });

// POST - Crear producto con imagen
router.post('/', upload.single('imagen'), async (req, res) => {
  try {
    const nuevoProducto = new Producto({
      nombre: req.body.nombre,
      categoria: req.body.categoria,
      cantidad: req.body.cantidad,
      precio: req.body.precio,
      descripcion: req.body.descripcion,
      imagen: req.file ? `/uploads/${req.file.filename}` : ''  // solo el path
    });

    const guardado = await nuevoProducto.save();
    res.status(201).json(guardado);
  } catch (error) {
    console.error('Error al guardar producto:', error.message);
    res.status(400).json({ message: 'Error al registrar el producto' });
  }
});

// GET - Listar todos los productos
router.get('/', async (req, res) => {
  try {
    const productos = await Producto.find().sort({ creadoEn: -1 });
    res.json(productos);
  } catch (error) {
    res.status(500).json({ message: 'Error al obtener los productos' });
  }
});

// POST - Crear un nuevo producto
router.post('/', async (req, res) => {
  try {
    const nuevoProducto = new Producto(req.body);
    const guardado = await nuevoProducto.save();
    res.status(201).json(guardado);
  } catch (error) {
    res.status(400).json({ message: 'Error al registrar el producto' });
  }
});

// PUT - Editar producto
router.put('/:id', async (req, res) => {
  try {
    const actualizado = await Producto.findByIdAndUpdate(req.params.id, req.body, {
      new: true
    });
    if (!actualizado) {
      return res.status(404).json({ message: 'Producto no encontrado' });
    }
    res.json(actualizado);
  } catch (error) {
    res.status(400).json({ message: 'Error al actualizar el producto' });
  }
});

// DELETE - Eliminar producto
router.delete('/:id', async (req, res) => {
  try {
    const eliminado = await Producto.findByIdAndDelete(req.params.id);
    if (!eliminado) {
      return res.status(404).json({ message: 'Producto no encontrado' });
    }
    res.json({ message: 'Producto eliminado correctamente' });
  } catch (error) {
    res.status(400).json({ message: 'Error al eliminar el producto' });
  }
});

module.exports = router;
