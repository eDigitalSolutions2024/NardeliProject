const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const Setting = require('../models/Setting');

const JWT_SECRET = process.env.JWT_SECRET || 'secret';
const TIPO_CAMBIO_KEY = 'tipo_cambio_usd';
const TIPO_CAMBIO_DEFAULT = 18.00;

function getRole(req) {
  try {
    const auth = req.headers.authorization || '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : auth;
    if (!token) return null;
    const payload = jwt.verify(token, JWT_SECRET);
    return payload.role || null;
  } catch { return null; }
}

/** GET /api/settings/tipo-cambio — cualquier rol puede leer */
router.get('/tipo-cambio', async (req, res) => {
  try {
    const doc = await Setting.findOne({ key: TIPO_CAMBIO_KEY });
    const value = doc ? Number(doc.value) : TIPO_CAMBIO_DEFAULT;
    res.json({ value });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Error interno' });
  }
});

/** PUT /api/settings/tipo-cambio — solo admin */
router.put('/tipo-cambio', async (req, res) => {
  const role = getRole(req);
  if (role !== 'admin') {
    return res.status(403).json({ error: 'Solo el administrador puede cambiar el tipo de cambio.' });
  }
  const value = Number(req.body?.value);
  if (!Number.isFinite(value) || value <= 0) {
    return res.status(400).json({ error: 'Valor inválido' });
  }
  try {
    await Setting.findOneAndUpdate(
      { key: TIPO_CAMBIO_KEY },
      { value },
      { upsert: true, new: true }
    );
    res.json({ ok: true, value });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Error interno' });
  }
});

module.exports = router;
