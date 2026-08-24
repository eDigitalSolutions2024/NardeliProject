const express = require('express');
const router = express.Router();
const path = require('path');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const axios = require('axios');
const rateLimit = require('express-rate-limit');

const Reserva = require('../models/Reservas');
const EmpresaAccesoQR = require('../models/EmpresaAccesoQR');
const JWT_SECRET = require('../utils/jwtSecret');

// Dispara rotación de credenciales en la Partner API — limitar por si una sesión de
// staff se compromete o hay un doble-click accidental en bucle.
const generarAccesoLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { msg: 'Demasiadas solicitudes, intenta de nuevo en unos minutos' },
});

const PARTNER_API_BASE_URL = process.env.PARTNER_API_BASE_URL;
const PARTNER_API_INTERNAL_KEY = process.env.PARTNER_API_INTERNAL_KEY;
const NARDELI_VENUE = process.env.NARDELI_VENUE_NAME || 'Nardeli';

// Requiere token válido Y rol de staff — a diferencia de /api/invitaciones-portal
// (que es de acceso libre para el cliente), este endpoint emite una credencial capaz
// de crear/editar/eliminar QR, así que solo el personal del salón puede dispararlo.
// Mismo patrón que requireStaff en routes/reservas.js.
function requireStaff(req, res, next) {
  const h = req.headers.authorization || '';
  const t = h.startsWith('Bearer ') ? h.slice(7) : null;
  if (!t) return res.status(401).json({ ok: false, msg: 'No autorizado' });
  try {
    const payload = jwt.verify(t, JWT_SECRET);
    if (payload.role !== 'admin' && payload.role !== 'asistente') {
      return res.status(403).json({ ok: false, msg: 'Requiere permisos de staff' });
    }
    req.user = payload;
    next();
  } catch {
    return res.status(401).json({ ok: false, msg: 'Token inválido' });
  }
}

// ================================
// Manual de integración para el equipo técnico de la empresa (descarga forzada,
// no vista previa — algunos plugins de PDF del navegador fallan al previsualizar
// PDFs servidos desde localhost, forzar la descarga lo evita por completo).
// ================================
router.get('/manual', (_req, res) => {
  const filePath = path.join(__dirname, '..', 'uploads', 'docs', 'manual-integracion-partner-api.pdf');
  res.download(filePath, 'manual-integracion-partner-api.pdf', (err) => {
    if (err && !res.headersSent) {
      console.error('Error al descargar el manual:', err.message);
      res.status(404).json({ msg: 'Manual no encontrado' });
    }
  });
});

// ================================
// Generar/rotar acceso QR para una empresa, sobre una reserva/evento
// ================================
router.post('/generar-empresa/:reservaId', requireStaff, generarAccesoLimiter, async (req, res) => {
  try {
    if (!PARTNER_API_BASE_URL || !PARTNER_API_INTERNAL_KEY) {
      console.error('Faltan PARTNER_API_BASE_URL / PARTNER_API_INTERNAL_KEY en el .env');
      return res.status(500).json({ msg: 'Integración con Partner API no configurada' });
    }

    const { reservaId } = req.params;
    if (!mongoose.isValidObjectId(reservaId)) {
      return res.status(400).json({ msg: 'reservaId inválido' });
    }
    const label = (req.body?.label || '').trim();
    if (!label) {
      return res.status(400).json({ msg: 'Falta "label" (nombre para identificar el acceso)' });
    }

    const reserva = await Reserva.findById(reservaId);
    if (!reserva) {
      return res.status(404).json({ msg: 'Reserva no encontrada' });
    }

    let partnerResp;
    try {
      partnerResp = await axios.post(
        `${PARTNER_API_BASE_URL}/internal/admin/event-access`,
        {
          eventId: String(reserva._id),
          eventName: reserva.cliente,
          eventDate: reserva.fecha,
          venue: NARDELI_VENUE,
          capacity: reserva.cantidadPersonas,
          label,
          grantedBy: req.user.email || req.user.sub || req.user.id || 'admin-nardeli',
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'X-Internal-Admin-Key': PARTNER_API_INTERNAL_KEY,
          },
          timeout: 10000,
        }
      );
    } catch (err) {
      console.error('Error llamando a Partner API:', err?.response?.data || err.message);
      return res.status(502).json({ msg: 'No se pudo generar el acceso en Partner API' });
    }

    const { company_id: companyId, api_key: apiKey } = partnerResp.data;

    await EmpresaAccesoQR.findOneAndUpdate(
      { reservaId },
      {
        reservaId,
        label,
        companyId,
        lastIssuedAt: new Date(),
        lastIssuedBy: req.user.email || req.user.sub || req.user.id || 'admin-nardeli',
      },
      { upsert: true }
    );

    return res.json({
      apiKey,
      apiBaseUrl: `${PARTNER_API_BASE_URL}/v1`,
      eventId: String(reserva._id),
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ msg: 'Error al generar acceso de empresa' });
  }
});

// ================================
// Ver si una reserva ya tiene acceso de empresa generado (sin exponer el secreto)
// ================================
router.get('/estado/:reservaId', requireStaff, async (req, res) => {
  try {
    const { reservaId } = req.params;
    if (!mongoose.isValidObjectId(reservaId)) {
      return res.status(400).json({ msg: 'reservaId inválido' });
    }
    const acceso = await EmpresaAccesoQR.findOne({ reservaId });
    if (!acceso) {
      return res.json({ existe: false });
    }
    return res.json({
      existe: true,
      label: acceso.label,
      lastIssuedAt: acceso.lastIssuedAt,
      lastIssuedBy: acceso.lastIssuedBy,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ msg: 'Error al consultar estado' });
  }
});

module.exports = router;
