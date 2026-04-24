const express = require('express');
const router = express.Router();

const InvitacionQR = require('../models/InvitacionQR');

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

    return res.json({
      _id: invitacion._id,
      nombreFamilia: invitacion.nombreFamilia,
      personasAutorizadas: invitacion.personasAutorizadas,
      entradasRestantes: invitacion.entradasRestantes,
      estado: invitacion.estado,
      notas: invitacion.notas || '',
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

    invitacion.entradasRestantes -= 1;

    if (invitacion.entradasRestantes <= 0) {
      invitacion.estado = 'agotada';
    }

    await invitacion.save();

    return res.json({
      ok: true,
      msg: 'Acceso permitido',
      nombreFamilia: invitacion.nombreFamilia,
      personasAutorizadas: invitacion.personasAutorizadas,
      entradasRestantes: invitacion.entradasRestantes,
      estado: invitacion.estado,
    });
  } catch (error) {
    console.error('POST scan invitacion error:', error);
    return res.status(500).json({ ok: false, msg: 'Error al registrar escaneo' });
  }
});

module.exports = router;