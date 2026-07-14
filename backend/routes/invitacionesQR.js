const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const Reserva = require('../models/Reservas');

const InvitacionPortal = require('../models/InvitacionPortal');
const InvitacionQR = require('../models/InvitacionQR');

const JWT_SECRET = process.env.JWT_SECRET || 'secreto-temporal';

// Solo deja pasar si el JWT trae role === 'admin'
function requireAdmin(req, res, next) {
  const h = req.headers.authorization || '';
  const t = h.startsWith('Bearer ') ? h.slice(7) : null;
  if (!t) return res.status(401).json({ msg: 'No autorizado' });
  try {
    const payload = jwt.verify(t, JWT_SECRET);
    if (payload.role !== 'admin') {
      return res.status(403).json({ msg: 'Solo un administrador puede editar esta invitación' });
    }
    req.user = payload;
    next();
  } catch {
    return res.status(401).json({ msg: 'Token inválido' });
  }
}

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

// =====================================
// Editar invitación QR (solo admin)
// Corrige personas autorizadas / entradas restantes cuando
// el staff se equivocó al registrar el escaneo en la entrada.
// =====================================
router.patch('/:token/:id', requireAdmin, async (req, res) => {
  try {
    const { token, id } = req.params;
    const { personasAutorizadas, entradasRestantes } = req.body;

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

    const personas = Number(personasAutorizadas);
    const entradas = Number(entradasRestantes);

    if (!Number.isFinite(personas) || personas < 1) {
      return res.status(400).json({ msg: 'La cantidad de personas debe ser mayor a 0' });
    }

    if (!Number.isFinite(entradas) || entradas < 0) {
      return res.status(400).json({ msg: 'Las entradas restantes no pueden ser negativas' });
    }

    if (entradas > personas) {
      return res.status(400).json({ msg: 'Las entradas restantes no pueden ser mayores a las personas autorizadas' });
    }

    const reserva = await Reserva.findById(portal.reservaId);

    if (!reserva) {
      return res.status(404).json({ msg: 'Reserva no encontrada' });
    }

    const capacidadEvento = Number(reserva.cantidadPersonas || 0);

    const otrasActivas = await InvitacionQR.find({
      reservaId: portal.reservaId,
      estado: { $ne: 'cancelada' },
      _id: { $ne: invitacion._id },
    });

    const pasesOtras = otrasActivas.reduce(
      (acc, inv) => acc + Number(inv.personasAutorizadas || 0),
      0
    );

    if (invitacion.estado !== 'cancelada' && (pasesOtras + personas) > capacidadEvento) {
      return res.status(400).json({
        msg: `No se puede editar. Solo hay ${Math.max(capacidadEvento - pasesOtras, 0)} pases disponibles para este evento.`,
      });
    }

    invitacion.personasAutorizadas = personas;
    invitacion.entradasRestantes = entradas;

    if (invitacion.estado !== 'cancelada') {
      invitacion.estado = entradas <= 0 ? 'agotada' : 'activa';
    }

    await invitacion.save();

    return res.json({ ok: true, invitacion });
  } catch (error) {
    console.error('PATCH editar invitacionesQR error:', error);
    return res.status(500).json({ msg: 'Error al editar invitación' });
  }
});

module.exports = router;