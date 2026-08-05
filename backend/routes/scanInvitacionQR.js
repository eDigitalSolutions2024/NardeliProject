const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const JWT_SECRET = require('../utils/jwtSecret');

const InvitacionQR = require('../models/InvitacionQR');
const Reserva = require('../models/Reservas');

// El link/QR de la invitación se le manda al invitado (por WhatsApp o al
// abrir el enlace directo), así que cualquiera que lo tenga podría llamar
// este endpoint. Solo el staff logueado (quien opera el lector de QR en la
// entrada) puede registrar el acceso.
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

// =====================================
// Consultar estado de una invitación QR
// =====================================
router.get('/:qrToken', async (req, res) => {
  try {
    const { qrToken } = req.params;

    const invitacion = await InvitacionQR.findOne({ qrToken });

    if (!invitacion) {
      return res.status(404).json({ msg: 'Invitación no encontrada' });
    }

    const reserva = await Reserva.findById(invitacion.reservaId).select(
      'tipoEvento cliente fecha horaInicio horaFin'
    );

    return res.json({
      _id: invitacion._id,
      nombreFamilia: invitacion.nombreFamilia,
      personasAutorizadas: invitacion.personasAutorizadas,
      entradasRestantes: invitacion.entradasRestantes,
      estado: invitacion.estado,
      notas: invitacion.notas || '',
      evento: reserva
        ? {
            tipoEvento: reserva.tipoEvento || '',
            anfitrion: reserva.cliente || '',
            fecha: reserva.fecha,
            horaInicio: reserva.horaInicio || '',
            horaFin: reserva.horaFin || '',
          }
        : null,
    });
  } catch (error) {
    console.error('GET scan invitacion error:', error);
    return res.status(500).json({ msg: 'Error al consultar invitación' });
  }
});

// =====================================
// Registrar escaneo de entrada
// =====================================
router.post('/:qrToken/scan', requireStaff, async (req, res) => {
  try {
    const { qrToken } = req.params;
    const { cantidad } = req.body;

    const cantidadEntradas = Number(cantidad || 1);

    if (!Number.isFinite(cantidadEntradas) || cantidadEntradas < 1) {
      return res.status(400).json({
        ok: false,
        msg: 'La cantidad de personas debe ser mayor a 0',
      });
    }

    const invitacion = await InvitacionQR.findOne({ qrToken });

    if (!invitacion) {
      return res.status(404).json({ ok: false, msg: 'Invitación no encontrada' });
    }

    if (invitacion.estado === 'cancelada') {
      return res.status(400).json({ ok: false, msg: 'Invitación cancelada' });
    }

    if (invitacion.entradasRestantes <= 0) {
      invitacion.estado = 'agotada';
      await invitacion.save();

      return res.status(400).json({
        ok: false,
        msg: 'Ya no quedan accesos disponibles para este QR',
        entradasRestantes: 0,
        estado: invitacion.estado,
      });
    }

    if (cantidadEntradas > invitacion.entradasRestantes) {
      return res.status(400).json({
        ok: false,
        msg: `Solo quedan ${invitacion.entradasRestantes} entradas disponibles`,
        entradasRestantes: invitacion.entradasRestantes,
        estado: invitacion.estado,
      });
    }

    invitacion.entradasRestantes -= cantidadEntradas;

    invitacion.ultimaCantidadRegistrada =
      cantidadEntradas;

    if (invitacion.entradasRestantes <= 0) {
      invitacion.estado = 'agotada';
      invitacion.entradasRestantes = 0;
    }

    await invitacion.save();

    return res.json({
      ok: true,
      msg: `Acceso permitido para ${cantidadEntradas} persona(s)`,
      nombreFamilia: invitacion.nombreFamilia,
      personasAutorizadas: invitacion.personasAutorizadas,
      entradasRestantes: invitacion.entradasRestantes,
      estado: invitacion.estado,
      cantidadRegistrada: cantidadEntradas,
    });
  } catch (error) {
    console.error('POST scan invitacion error:', error);
    return res.status(500).json({ ok: false, msg: 'Error al registrar escaneo' });
  }
});

module.exports = router;