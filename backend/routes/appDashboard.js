const express = require('express');
const router = express.Router();

const Reserva = require('../models/Reservas');
const InvitacionQR = require('../models/InvitacionQR');

router.get('/reservas', async (req, res) => {
  try {
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);

    const reservas = await Reserva.find({
      tipoReserva: 'evento',
      estado: 'confirmada',
      fecha: { $gte: hoy },
    })
      .sort({ fecha: 1 })
      .limit(100);

    return res.json(reservas);
  } catch (error) {
    console.error('GET app reservas error:', error);
    return res.status(500).json({ msg: 'Error al obtener eventos' });
  }
});

router.get('/dashboard/:reservaId', async (req, res) => {
  try {
    const { reservaId } = req.params;

    const reserva = await Reserva.findById(reservaId);

    if (!reserva) {
      return res.status(404).json({ msg: 'Evento no encontrado' });
    }

    const invitaciones = await InvitacionQR.find({ reservaId });

    const totalInvitaciones = invitaciones.length;

let canceladas = 0;
let personasAutorizadas = 0;
let entradasRestantes = 0;
let entradasRegistradas = 0;

invitaciones.forEach((inv) => {
  if (inv.estado === 'cancelada') {
    canceladas++;
    return;
  }

  const autorizadas = Number(inv.personasAutorizadas || 0);
  const restantes = Number(inv.entradasRestantes || 0);

  personasAutorizadas += autorizadas;
  entradasRestantes += restantes;
  entradasRegistradas += autorizadas - restantes;
});

const capacidadEvento = Number(reserva.cantidadPersonas || 0);

const disponiblesParaGenerar = Math.max(
  capacidadEvento - personasAutorizadas,
  0
);

const sobreCupo = Math.max(personasAutorizadas - capacidadEvento, 0);
const porcentajeCapacidad = capacidadEvento > 0
  ? Math.min((personasAutorizadas / capacidadEvento) * 100, 100)
  : 0;

    return res.json({
  reserva,
  resumen: {
    invitaciones: totalInvitaciones,
    entradas: entradasRegistradas,
    restantes: entradasRestantes,
    canceladas,
    personasAutorizadas,

    capacidadEvento,
    pasesGenerados: personasAutorizadas,
    disponiblesParaGenerar,
    sobreCupo,
porcentajeCapacidad,
  },
  invitaciones,
});
  } catch (error) {
    console.error('GET app dashboard error:', error);
    return res.status(500).json({ msg: 'Error al obtener dashboard' });
  }
});

module.exports = router;