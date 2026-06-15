const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const FormatoReserva = require('../models/FormatoReserva');
const { streamFormatoPdf } = require('../services/formatosPdf');

const TIPOS = ['tabla-trabajo', 'degustacion', 'proveedores'];

// GET /api/reservas/:reservaId/formatos/:tipo
router.get('/:reservaId/formatos/:tipo', async (req, res) => {
  try {
    const { reservaId, tipo } = req.params;
    if (!mongoose.isValidObjectId(reservaId))
      return res.status(400).json({ ok: false, msg: 'ID inválido' });
    if (!TIPOS.includes(tipo))
      return res.status(400).json({ ok: false, msg: 'Tipo de formato inválido' });

    const doc = await FormatoReserva.findOne({ reservaId, tipo }).lean();
    return res.json({ ok: true, data: doc?.data || {} });
  } catch (e) {
    console.error('GET /formatos/:tipo', e);
    return res.status(500).json({ ok: false, msg: 'Error interno' });
  }
});

// PUT /api/reservas/:reservaId/formatos/:tipo
router.put('/:reservaId/formatos/:tipo', async (req, res) => {
  try {
    const { reservaId, tipo } = req.params;
    if (!mongoose.isValidObjectId(reservaId))
      return res.status(400).json({ ok: false, msg: 'ID inválido' });
    if (!TIPOS.includes(tipo))
      return res.status(400).json({ ok: false, msg: 'Tipo de formato inválido' });

    const saved = await FormatoReserva.findOneAndUpdate(
      { reservaId, tipo },
      { $set: { data: req.body, updatedAt: new Date() } },
      { upsert: true, new: true }
    );
    return res.json({ ok: true, formato: saved });
  } catch (e) {
    console.error('PUT /formatos/:tipo', e);
    return res.status(500).json({ ok: false, msg: 'Error interno' });
  }
});

// GET /api/reservas/:reservaId/formatos/:tipo/pdf
router.get('/:reservaId/formatos/:tipo/pdf', async (req, res) => {
  try {
    const { reservaId, tipo } = req.params;
    if (!mongoose.isValidObjectId(reservaId))
      return res.status(400).json({ ok: false, msg: 'ID inválido' });
    if (!TIPOS.includes(tipo))
      return res.status(400).json({ ok: false, msg: 'Tipo de formato inválido' });

    const doc = await FormatoReserva.findOne({ reservaId, tipo }).lean();
    streamFormatoPdf(res, { tipo, data: doc?.data || {} });
  } catch (e) {
    console.error('GET /formatos/:tipo/pdf', e);
    return res.status(500).json({ ok: false, msg: 'Error al generar PDF' });
  }
});

module.exports = router;
