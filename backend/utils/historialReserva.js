// Historial por reserva (el que se ve en el Panel del Cliente como "Historial de cambios").
// Cada entrada guarda qué se hizo, quién (rol y correo) y cuándo.
const jwt = require('jsonwebtoken');
const JWT_SECRET = require('./jwtSecret');
const HistorialReserva = require('../models/HistorialReserva');

// Quién hace la petición, según el token (la sesión). Si no hay sesión válida, queda vacío.
function quienDe(req) {
  try {
    if (req.user && (req.user.email || req.user.sub)) {
      return { id: req.user.sub || req.user.id || null, email: req.user.email || '', role: req.user.role || '' };
    }
    const h = req.headers?.authorization || '';
    if (!h.startsWith('Bearer ')) return { id: null, email: '', role: '' };
    const p = jwt.verify(h.slice(7), JWT_SECRET);
    return { id: p.sub || p.id || null, email: p.email || '', role: p.role || '' };
  } catch {
    return { id: null, email: '', role: '' };
  }
}

// datos: { tipo, accion, etiqueta?, campo?, producto?, valorAntes?, valorDespues?, descuentoAntes?, descuentoDespues? }
async function registrarCambio(reservaId, datos, quien) {
  try {
    await HistorialReserva.create({
      reservaId,
      ...datos,
      usuario: quien?.id || null,
      usuarioEmail: quien?.email || '',
      usuarioRole: quien?.role || '',
    });
  } catch (e) {
    console.error('[historialReserva] no se pudo registrar:', e.message);
  }
}

module.exports = { quienDe, registrarCambio };
