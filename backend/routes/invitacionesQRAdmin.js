const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');

const InvitacionQR = require('../models/InvitacionQR');
const Reserva = require('../models/Reservas');
const JWT_SECRET = require('../utils/jwtSecret');

const writeLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  limit: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, msg: 'Demasiadas solicitudes, intenta de nuevo en unos minutos' },
});

// Vista de administrador: junta TODAS las invitaciones de una reserva (las que crea el
// cliente vía su portal + las sincronizadas desde una empresa partner), sin importar
// portalId. Nunca la consume el cliente ni la empresa — solo el staff de Nardeli.
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
// Listar todas las invitaciones de una reserva
// ================================
router.get('/:reservaId', requireStaff, async (req, res) => {
  try {
    const { reservaId } = req.params;
    if (!mongoose.isValidObjectId(reservaId)) {
      return res.status(400).json({ ok: false, msg: 'reservaId inválido' });
    }

    const reserva = await Reserva.findById(reservaId).select('cantidadPersonas cliente tipoEvento');
    if (!reserva) {
      return res.status(404).json({ ok: false, msg: 'Reserva no encontrada' });
    }

    const invitaciones = await InvitacionQR.find({ reservaId }).sort({ createdAt: -1 });

    const capacidadTotal = Number(reserva.cantidadPersonas || 0);
    const pasesGenerados = invitaciones
      .filter((inv) => inv.estado !== 'cancelada')
      .reduce((acc, inv) => acc + Number(inv.personasAutorizadas || 0), 0);

    return res.json({
      ok: true,
      invitaciones,
      capacidadTotal,
      pasesGenerados,
      disponibles: Math.max(capacidadTotal - pasesGenerados, 0),
    });
  } catch (error) {
    console.error('GET invitacionesQRAdmin error:', error);
    res.status(500).json({ ok: false, msg: 'Error al obtener invitaciones' });
  }
});

// ================================
// Editar (control total del admin) — incluye invitaciones creadas por empresas partner.
// Si es de una empresa (creadoPor === 'empresa-partner'), el cambio NO se refleja en su
// sistema — el próximo sync solo puede volver a mover entradasRestantes por el delta de
// authorizedCount que reporte la Partner API, nunca revierte una edición manual de nombre.
// ================================
router.patch('/:id', requireStaff, writeLimiter, async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ ok: false, msg: 'id inválido' });
    }
    const { nombreFamilia, personasAutorizadas, entradasRestantes, notas } = req.body;

    const invitacion = await InvitacionQR.findById(id);
    if (!invitacion) {
      return res.status(404).json({ ok: false, msg: 'Invitación no encontrada' });
    }

    const personas = Number(personasAutorizadas);
    const entradas = Number(entradasRestantes);

    if (!Number.isFinite(personas) || personas < 1) {
      return res.status(400).json({ ok: false, msg: 'La cantidad de personas debe ser mayor a 0' });
    }
    if (!Number.isFinite(entradas) || entradas < 0) {
      return res.status(400).json({ ok: false, msg: 'Las entradas restantes no pueden ser negativas' });
    }
    if (entradas > personas) {
      return res
        .status(400)
        .json({ ok: false, msg: 'Las entradas restantes no pueden ser mayores a las personas autorizadas' });
    }

    const reserva = await Reserva.findById(invitacion.reservaId).select('cantidadPersonas');
    if (reserva) {
      const capacidadEvento = Number(reserva.cantidadPersonas || 0);
      const otrasActivas = await InvitacionQR.find({
        reservaId: invitacion.reservaId,
        estado: { $ne: 'cancelada' },
        _id: { $ne: invitacion._id },
      });
      const pasesOtras = otrasActivas.reduce((acc, inv) => acc + Number(inv.personasAutorizadas || 0), 0);

      if (invitacion.estado !== 'cancelada' && pasesOtras + personas > capacidadEvento) {
        return res.status(400).json({
          ok: false,
          msg: `No se puede editar. Solo hay ${Math.max(capacidadEvento - pasesOtras, 0)} pases disponibles para este evento.`,
        });
      }
    }

    if (nombreFamilia !== undefined) invitacion.nombreFamilia = String(nombreFamilia).trim();
    if (notas !== undefined) invitacion.notas = String(notas).trim();
    invitacion.personasAutorizadas = personas;
    invitacion.entradasRestantes = entradas;
    if (invitacion.estado !== 'cancelada') {
      invitacion.estado = entradas <= 0 ? 'agotada' : 'activa';
    }

    await invitacion.save();
    res.json({ ok: true, invitacion });
  } catch (error) {
    console.error('PATCH invitacionesQRAdmin error:', error);
    res.status(500).json({ ok: false, msg: 'Error al editar invitación' });
  }
});

// ================================
// Cancelar (control total del admin) — incluye invitaciones de empresas partner.
// ================================
router.patch('/:id/cancelar', requireStaff, writeLimiter, async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ ok: false, msg: 'id inválido' });
    }
    const invitacion = await InvitacionQR.findById(id);
    if (!invitacion) {
      return res.status(404).json({ ok: false, msg: 'Invitación no encontrada' });
    }
    invitacion.estado = 'cancelada';
    await invitacion.save();
    res.json({ ok: true, invitacion });
  } catch (error) {
    console.error('PATCH cancelar invitacionesQRAdmin error:', error);
    res.status(500).json({ ok: false, msg: 'Error al cancelar invitación' });
  }
});

module.exports = router;
