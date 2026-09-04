const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');

const Reserva = require('../models/Reservas');
const EncuestaSatisfaccion = require('../models/EncuestaSatisfaccion');

const CATEGORIAS_DEFAULT = [
  { categoria: 'salon', etiqueta: 'Salón' },
  { categoria: 'comida', etiqueta: 'Servicio de comida' },
  { categoria: 'barra', etiqueta: 'Barra y bebidas' },
  { categoria: 'candybar', etiqueta: 'Candy bar' },
  { categoria: 'atencion_personal', etiqueta: 'Atención del personal' },
  { categoria: 'puntualidad', etiqueta: 'Puntualidad' },
  { categoria: 'limpieza', etiqueta: 'Limpieza de las instalaciones' },
  { categoria: 'proceso_contratacion', etiqueta: 'Antes del evento (comunicación y precio)' },
];

const CANALES_DEFAULT = [
  { canal: 'redes_sociales', etiqueta: 'Redes sociales' },
  { canal: 'recomendacion', etiqueta: 'Recomendación de alguien' },
  { canal: 'google', etiqueta: 'Google / búsqueda' },
  { canal: 'evento_previo', etiqueta: 'Ya había venido a otro evento' },
  { canal: 'otro', etiqueta: 'Otro' },
];

const uploadDir = path.join(__dirname, '..', 'uploads', 'encuestas');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

// Decodifica una firma en base64 (data URL o base64 puro) y la guarda como PNG/JPG
function guardarFirma(base64) {
  const match = /^data:image\/(png|jpe?g);base64,(.+)$/.exec(base64 || '');
  const data = match ? match[2] : base64;
  if (!data) throw new Error('Firma vacía o con formato inválido');
  const ext = match && /jpe?g/.test(match[1]) ? 'jpg' : 'png';
  const filename = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
  fs.writeFileSync(path.join(uploadDir, filename), Buffer.from(data, 'base64'));
  return `/api/media/encuestas/${filename}`;
}

// GET /api/app/encuestas/categorias — catálogo de categorías a calificar
router.get('/encuestas/categorias', (req, res) => {
  res.json(CATEGORIAS_DEFAULT);
});

// GET /api/app/encuestas/reserva/:reservaId — datos de la reserva para prellenar + encuesta existente (si la hay)
router.get('/encuestas/reserva/:reservaId', async (req, res) => {
  try {
    const reserva = await Reserva.findById(req.params.reservaId)
      .select('cliente correo telefono tipoEvento fecha salon');
    if (!reserva) return res.status(404).json({ error: 'Reserva no encontrada' });

    const encuesta = await EncuestaSatisfaccion.findOne({ reservaId: req.params.reservaId });

    res.json({
      reserva,
      encuesta: encuesta || null,
      categorias: CATEGORIAS_DEFAULT,
      canales: CANALES_DEFAULT,
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/app/encuestas — crear encuesta de satisfacción (una por reserva)
router.post('/encuestas', async (req, res) => {
  try {
    const {
      reservaId, calificacionGeneral, calificaciones = [], recomendaria, volveriaContratar,
      canalReferencia, loMejor = '', queMejorar = '', opinionComida = '', opinionCandybar = '',
      testimonioAutorizado = false, firmante, firma,
    } = req.body;

    if (!reservaId) return res.status(400).json({ error: 'reservaId requerido' });
    const general = Number(calificacionGeneral);
    if (!general || general < 1 || general > 5) {
      return res.status(400).json({ error: 'calificacionGeneral debe ser entre 1 y 5' });
    }
    if (typeof recomendaria !== 'boolean') {
      return res.status(400).json({ error: 'recomendaria debe ser true o false' });
    }
    if (typeof volveriaContratar !== 'boolean') {
      return res.status(400).json({ error: 'volveriaContratar debe ser true o false' });
    }
    if (!canalReferencia || !CANALES_DEFAULT.some(c => c.canal === canalReferencia)) {
      return res.status(400).json({ error: 'canalReferencia inválido' });
    }
    if (!firma) return res.status(400).json({ error: 'Falta la firma' });

    const reserva = await Reserva.findById(reservaId);
    if (!reserva) return res.status(404).json({ error: 'Reserva no encontrada' });

    const existente = await EncuestaSatisfaccion.findOne({ reservaId });
    if (existente) return res.status(409).json({ error: 'Ya existe una encuesta para esta reserva', encuesta: existente });

    const firmaUrl = guardarFirma(firma);

    const encuesta = await EncuestaSatisfaccion.create({
      reservaId,
      cliente: reserva.cliente,
      correo: reserva.correo,
      telefono: reserva.telefono,
      tipoEvento: reserva.tipoEvento,
      fecha: reserva.fecha,
      salon: reserva.salon || '',
      calificacionGeneral: general,
      calificaciones: calificaciones
        .filter(c => c && c.categoria && c.valor)
        .map(c => ({
          categoria: c.categoria,
          etiqueta: c.etiqueta || CATEGORIAS_DEFAULT.find(d => d.categoria === c.categoria)?.etiqueta || c.categoria,
          valor: Math.max(1, Math.min(5, Number(c.valor))),
        })),
      recomendaria,
      volveriaContratar,
      canalReferencia,
      loMejor,
      queMejorar,
      opinionComida,
      opinionCandybar,
      testimonioAutorizado: !!testimonioAutorizado,
      firmante: firmante || reserva.cliente,
      firmaUrl,
    });

    res.status(201).json(encuesta);
  } catch (err) {
    if (err.code === 11000) return res.status(409).json({ error: 'Ya existe una encuesta para esta reserva' });
    res.status(500).json({ error: err.message });
  }
});

// GET /api/app/encuestas — listado reciente (para reportes/admin)
router.get('/encuestas', async (req, res) => {
  try {
    const encuestas = await EncuestaSatisfaccion.find().sort({ createdAt: -1 }).limit(200);
    res.json(encuestas);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
