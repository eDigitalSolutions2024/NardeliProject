const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const Reserva = require('../models/Reservas');

const InvitacionPortal = require('../models/InvitacionPortal');
const InvitacionQR = require('../models/InvitacionQR');

// =====================================
// Listar invitaciones por token de portal
// =====================================
router.get('/:token', async (req, res) => {
  try {
    const { token } = req.params;

    console.log('--- GET /invitaciones-qr/:token ---');
    console.log('TOKEN RECIBIDO EN GET:', token);

    const portal = await InvitacionPortal.findOne({ token });

    console.log('PORTAL ENCONTRADO EN GET:', portal);

    if (!portal || !portal.activo) {
      return res.status(404).json({ msg: 'Portal no válido' });
    }

    const invitaciones = await InvitacionQR.find({ portalId: portal._id })
      .sort({ createdAt: -1 });

    console.log('INVITACIONES ENCONTRADAS:', invitaciones.length);

    const reserva = await Reserva.findById(portal.reservaId);
    const capacidadTotal = Number(reserva?.cantidadPersonas || 0);
    const pasesGenerados = invitaciones
      .filter(inv => inv.estado !== 'cancelada')
      .reduce((acc, inv) => acc + Number(inv.personasAutorizadas || 0), 0);
    const disponibles = Math.max(capacidadTotal - pasesGenerados, 0);

    return res.json({ invitaciones, capacidadTotal, disponibles });
  } catch (error) {
    console.error('GET invitacionesQR error:', error);
    return res.status(500).json({ msg: 'Error al obtener invitaciones' });
  }
}); 

// =====================================
// Crear invitación QR
// =====================================
router.post('/:token', async (req, res) => {
  try {
    const { token } = req.params;
    const { nombreFamilia, personasAutorizadas, notas, creadoPor } = req.body;

    console.log('--- POST /invitaciones-qr/:token ---');
    console.log('TOKEN RECIBIDO:', token);
    console.log('BODY RECIBIDO:', req.body);

    const portal = await InvitacionPortal.findOne({ token });

    console.log('PORTAL ENCONTRADO:', portal);

    if (!portal || !portal.activo) {
      return res.status(404).json({ msg: 'Portal no válido' });
    }

    const personas = Number(personasAutorizadas);

    console.log('PERSONAS PARSEADAS:', personas);

    if (!nombreFamilia || !String(nombreFamilia).trim()) {
      return res.status(400).json({ msg: 'El nombre de la familia es obligatorio' });
    }

    if (!Number.isFinite(personas) || personas < 1) {
      return res.status(400).json({ msg: 'La cantidad de personas debe ser mayor a 0' });
    }

    /*if (personas > 12) {
      return res.status(400).json({
        msg: 'Máximo 12 personas por código QR. Genera otro QR para las personas restantes.'
      });
    }*/


    const reserva = await Reserva.findById(portal.reservaId);

if (!reserva) {
  return res.status(404).json({ msg: 'Reserva no encontrada' });
}

const capacidadEvento = Number(reserva.cantidadPersonas || 0);

const invitacionesActivas = await InvitacionQR.find({
  reservaId: portal.reservaId,
  estado: { $ne: 'cancelada' },
});

const pasesGenerados = invitacionesActivas.reduce(
  (acc, inv) => acc + Number(inv.personasAutorizadas || 0),
  0
);

const disponibles = capacidadEvento - pasesGenerados;

if (personas > disponibles) {
  return res.status(400).json({
    msg: `No se puede generar este QR. Solo quedan ${Math.max(disponibles, 0)} pases disponibles para este evento.`,
    capacidadEvento,
    pasesGenerados,
    disponibles: Math.max(disponibles, 0),
  });
}

    const qrToken = crypto.randomBytes(20).toString('hex');

    console.log('QR TOKEN GENERADO:', qrToken);

    const invitacion = new InvitacionQR({
      reservaId: portal.reservaId,
      portalId: portal._id,
      nombreFamilia: String(nombreFamilia).trim(),
      personasAutorizadas: personas,
      entradasRestantes: personas,
      qrToken,
      notas: notas ? String(notas).trim() : '',
      creadoPor: creadoPor ? String(creadoPor).trim() : 'cliente',
    });

    console.log('INVITACION A GUARDAR:', invitacion);

    await invitacion.save();

  

    console.log('INVITACION GUARDADA OK');

    return res.status(201).json(invitacion);
  } catch (error) {
    console.error('POST invitacionesQR error:', error);
    return res.status(500).json({ msg: 'Error al crear invitación QR' });
  }
});

// =====================================
// Cancelar invitación QR
// =====================================
router.patch('/:token/:id/cancelar', async (req, res) => {
  try {
    const { token, id } = req.params;

    const portal = await InvitacionPortal.findOne({ token });

    if (!portal || !portal.activo) {
      return res.status(404).json({ msg: 'Portal no válido' });
    }

    const invitacion = await InvitacionQR.findOne({
      _id: id,
      portalId: portal._id,
    });

    if (!invitacion) {
      return res.status(404).json({ msg: 'Invitación no encontrada' });
    }

    invitacion.estado = 'cancelada';
    await invitacion.save();

    return res.json({ ok: true, invitacion });
  } catch (error) {
    console.error('PATCH cancelar invitacionesQR error:', error);
    return res.status(500).json({ msg: 'Error al cancelar invitación' });
  }
});

module.exports = router;