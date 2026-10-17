// Fuente única de permisos por rol.
//
// - El catálogo (qué permisos existen) vive aquí, en código.
// - Los valores por rol viven en la base (Setting 'permisos_roles') para que el
//   admin los pueda prender/apagar desde "Usuarios y roles". Lo que no esté
//   guardado cae a PERMISOS_POR_DEFECTO.
// - El admin SIEMPRE tiene todo y 'usuarios.gestionar' solo existe para él: así
//   nadie puede bloquearse ni delegar la administración de cuentas.
// - El rol 'user' (cliente) no usa esta tabla: solo accede a su propia reserva.
const jwt = require('jsonwebtoken');
const JWT_SECRET = require('./jwtSecret');
const Setting = require('../models/Setting');
const Usuario = require('../models/Usuario');

const SETTING_KEY = 'permisos_roles';

const CATALOGO = [
  { key: 'usuarios.gestionar',    etiqueta: 'Gestionar usuarios y roles', fijoAdmin: true },
  { key: 'reportes.ver',          etiqueta: 'Reportes' },
  { key: 'clientes.ver',          etiqueta: 'Ver clientes' },
  { key: 'calendario.ver',        etiqueta: 'Ver calendario' },
  { key: 'inventario.gestionar',  etiqueta: 'Inventario (productos y accesorios)' },
  { key: 'eventos.gestionar',     etiqueta: 'Gestionar eventos, recibos e invitaciones' },
  { key: 'eventos.eliminar',      etiqueta: 'Eliminar reservas y recibos' },
  { key: 'cotizaciones.crear',    etiqueta: 'Crear cotizaciones' },
  { key: 'cotizaciones.ver_todas', etiqueta: 'Ver las cotizaciones de todos' },
];

// Roles configurables desde la tabla (admin es fijo; 'user' queda fuera).
const ROLES_CONFIGURABLES = ['asistente', 'cotizador'];
const ROLES_STAFF = ['admin', 'asistente', 'cotizador'];

const PERMISOS_POR_DEFECTO = {
  asistente: {
    'reportes.ver': false,
    'clientes.ver': true,
    'calendario.ver': true,
    'inventario.gestionar': true,
    'eventos.gestionar': true,
    'eventos.eliminar': false,
    'cotizaciones.crear': true,
    'cotizaciones.ver_todas': true,
  },
  // El cotizador VE todas las cotizaciones, pero solo EDITA las suyas (eso lo valida routes/reservas.js).
  cotizador: {
    'cotizaciones.crear': true,
    'cotizaciones.ver_todas': true,
  },
};

const KEYS = CATALOGO.map((p) => p.key);
const KEYS_CONFIGURABLES = CATALOGO.filter((p) => !p.fijoAdmin).map((p) => p.key);

function normalizar(guardado = {}) {
  const out = {};
  for (const rol of ROLES_CONFIGURABLES) {
    out[rol] = {};
    for (const k of KEYS_CONFIGURABLES) {
      const g = guardado?.[rol]?.[k];
      out[rol][k] = typeof g === 'boolean' ? g : !!PERMISOS_POR_DEFECTO[rol]?.[k];
    }
    out[rol]['usuarios.gestionar'] = false;
  }
  out.admin = Object.fromEntries(KEYS.map((k) => [k, true]));
  return out;
}

// --- caché corto en memoria: el cambio aplica en segundos sin pegarle a Mongo en cada request
let cache = { at: 0, value: null };
const TTL_MS = 5000;

async function obtenerMatriz() {
  if (cache.value && Date.now() - cache.at < TTL_MS) return cache.value;
  const doc = await Setting.findOne({ key: SETTING_KEY }).lean();
  cache = { at: Date.now(), value: normalizar(doc?.value) };
  return cache.value;
}

async function guardarMatriz(nueva) {
  const limpia = normalizar(nueva);
  await Setting.findOneAndUpdate(
    { key: SETTING_KEY },
    { value: { asistente: limpia.asistente, cotizador: limpia.cotizador } },
    { upsert: true, new: true }
  );
  cache = { at: 0, value: null };
  return limpia;
}

async function permisosDeRol(rol) {
  if (rol === 'admin') return Object.fromEntries(KEYS.map((k) => [k, true]));
  const matriz = await obtenerMatriz();
  return matriz[rol] || Object.fromEntries(KEYS.map((k) => [k, false]));
}

// Autentica el token contra la BASE (rol y estado actuales, no los del token)
// para que desactivar a alguien o cambiarle el rol aplique de inmediato.
async function autenticar(req, { permitirCambioPassword = false } = {}) {
  const h = req.headers.authorization || '';
  const t = h.startsWith('Bearer ') ? h.slice(7) : null;
  if (!t) return { status: 401, body: { ok: false, msg: 'No autorizado' } };

  let payload;
  try { payload = jwt.verify(t, JWT_SECRET); }
  catch { return { status: 401, body: { ok: false, msg: 'Token inválido' } }; }

  let user = null;
  try { user = await Usuario.findById(payload.sub || payload.id).select('role activo mustChangePassword fullname email'); }
  catch { /* id inválido */ }
  if (!user) return { status: 401, body: { ok: false, msg: 'Token inválido' } };
  if (user.activo === false) return { status: 401, body: { ok: false, msg: 'Cuenta desactivada' } };
  if (user.mustChangePassword && !permitirCambioPassword) {
    return { status: 403, body: { ok: false, code: 'PASSWORD_CHANGE_REQUIRED', msg: 'Debes cambiar tu contraseña temporal antes de continuar.' } };
  }
  return { user, payload };
}

// Deja pasar si el rol tiene AL MENOS UNO de los permisos indicados.
function requirePermission(...permisos) {
  return async (req, res, next) => {
    try {
      const r = await autenticar(req);
      if (r.status) return res.status(r.status).json(r.body);
      const { user, payload } = r;
      const mios = await permisosDeRol(user.role);
      if (!permisos.some((p) => mios[p])) {
        return res.status(403).json({ ok: false, msg: 'Tu rol no tiene permiso para esta acción' });
      }
      req.user = { ...payload, sub: String(user._id), role: user.role, fullname: user.fullname, email: user.email };
      req.permisos = mios;
      next();
    } catch (e) {
      console.error('requirePermission error:', e);
      res.status(500).json({ ok: false, msg: 'Error del servidor' });
    }
  };
}

// Para rutas que solo piden sesión válida (incluye a quien debe cambiar su contraseña).
function requireSesion({ permitirCambioPassword = false } = {}) {
  return async (req, res, next) => {
    try {
      const r = await autenticar(req, { permitirCambioPassword });
      if (r.status) return res.status(r.status).json(r.body);
      req.user = { ...r.payload, sub: String(r.user._id), role: r.user.role };
      req.usuarioDoc = r.user;
      next();
    } catch (e) {
      console.error('requireSesion error:', e);
      res.status(500).json({ ok: false, msg: 'Error del servidor' });
    }
  };
}

// Si el request trae un token válido, devuelve el usuario; si no, null (sin rechazar).
async function usuarioOpcional(req) {
  const r = await autenticar(req, { permitirCambioPassword: true }).catch(() => ({ status: 500 }));
  return r.status ? null : r.user;
}

module.exports = {
  CATALOGO,
  ROLES_CONFIGURABLES,
  ROLES_STAFF,
  PERMISOS_POR_DEFECTO,
  obtenerMatriz,
  guardarMatriz,
  permisosDeRol,
  requirePermission,
  requireSesion,
  usuarioOpcional,
};
