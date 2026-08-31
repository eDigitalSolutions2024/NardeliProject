const express = require('express');
const router = express.Router();

const InvitacionQR = require('../models/InvitacionQR');
const Reserva = require('../models/Reservas');

// Hotfix temporal (evento en vivo, 2026-08-15): los lectores Zebra ya
// desplegados en el salón nunca mandaron el header Authorization (su login
// era local/falso, sin token real — ver nardeli-invitaciones/src/screens/
// LoginScreen.js), así que exigir sesión de staff aquí los dejaba sin poder
// registrar entradas. Se quita el requireStaff SOLO de esta ruta para
// destrabar el evento. Pendiente: revertir esto en cuanto los Zebra se
// puedan reconfigurar/actualizar con un login real.

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
router.post('/:qrToken/scan', async (req, res) => {
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

    invitacion.accesos.push({
      cantidad: cantidadEntradas,
      restantesDespues: invitacion.entradasRestantes,
      fecha: new Date(),
    });

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