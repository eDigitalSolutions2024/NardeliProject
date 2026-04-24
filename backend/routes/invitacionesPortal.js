const express = require('express');
const router = express.Router();
const crypto = require('crypto');

const InvitacionPortal = require('../models/InvitacionPortal');
const Reserva = require('../models/Reservas');

// ================================
// Generar acceso al portal
// ================================
router.post('/generar/:reservaId', async (req, res) => {
  try {
    const { reservaId } = req.params;

    // Verificar si la reserva existe
    const reserva = await Reserva.findById(reservaId);
    if (!reserva) {
      return res.status(404).json({ msg: 'Reserva no encontrada' });
    }

    // Ver si ya existe acceso
    let portal = await InvitacionPortal.findOne({ reservaId });

    if (!portal) {
      // Generar token seguro
      const token = crypto.randomBytes(16).toString('hex');

      // Generar código simple (4 dígitos)
      const codigo = Math.floor(1000 + Math.random() * 9000).toString();

      portal = new InvitacionPortal({
        reservaId,
        token,
        codigoAcceso: codigo,
      });

      await portal.save();
    }

    return res.json({
      token: portal.token,
      codigo: portal.codigoAcceso,
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ msg: 'Error al generar acceso' });
  }
});


// ================================
// Obtener info pública del portal
// ================================
router.get('/publico/:token', async (req, res) => {
  try {
    const { token } = req.params;

    const portal = await InvitacionPortal.findOne({ token })
      .populate('reservaId');

    console.log('portal publico:', portal);

    if (!portal || !portal.activo) {
      return res.status(404).json({ msg: 'Acceso inválido' });
    }

    return res.json({
      evento: portal.reservaId?.nombreEvento || 'Evento',
      anfitrion: portal.reservaId?.cliente || '',
      fecha: portal.reservaId?.fecha || '',
    });

  } catch (error) {
    console.error('error publico portal:', error);
    res.status(500).json({ msg: 'Error al obtener datos' });
  }
});


// ================================
// Verificar código de acceso
// ================================
router.post('/verificar/:token', async (req, res) => {
  try {
    const { token } = req.params;
    const { codigo } = req.body;

    const portal = await InvitacionPortal.findOne({ token });

    if (!portal || !portal.activo) {
      return res.status(404).json({ msg: 'Acceso inválido' });
    }

    if (portal.codigoAcceso !== codigo) {
      return res.status(401).json({ msg: 'Código incorrecto' });
    }

    portal.ultimoAcceso = new Date();
    await portal.save();

    return res.json({ ok: true });

  } catch (error) {
    console.error(error);
    res.status(500).json({ msg: 'Error al verificar código' });
  }
});

module.exports = router;