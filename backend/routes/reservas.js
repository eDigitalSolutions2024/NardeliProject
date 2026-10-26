const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const nodemailer = require('nodemailer');
const Usuario = require('../models/Usuario');
const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Reserva = require('../models/Reservas');
const Producto = require('../models/Producto');
const { streamReservaPDF } = require('../services/reservaPdf');
const {streamEstadoCuentaPdf} = require('../services/edocuentaPDF');
const jwt = require('jsonwebtoken');
const Accesorio = require('../models/Accesorio');

const HistorialReserva = require('../models/HistorialReserva');

const isId = (v) => mongoose.isValidObjectId(String(v));
const TZ = process.env.APP_TIMEZONE || 'America/Ciudad_Juarez';
const JWT_SECRET = require('../utils/jwtSecret');

const axios = require('axios');

async function enviarWhatsAppTemplatePrueba({ to }) {
  const url = `https://graph.facebook.com/v23.0/${process.env.WA_PHONE_NUMBER_ID}/messages`;

  try {
    const { data } = await axios.post(
      url,
      {
        messaging_product: 'whatsapp',
        to,
        type: 'template',
        template: {
          name: 'hello_world',
          language: {
            code: 'en_US'
          }
        }
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.WA_ACCESS_TOKEN}`,
          'Content-Type': 'application/json'
        }
      }
    );

    return data;
  } catch (err) {
    console.error('Error WhatsApp template:', err?.response?.data || err.message);
    throw new Error(
      err?.response?.data?.error?.message || err.message || 'Error enviando template'
    );
  }
}

// ===== Auth muy simple =====
function auth(req, res, next) {
  const h = req.headers.authorization || '';
  const t = h.startsWith('Bearer ') ? h.slice(7) : null;
  if (!t) return res.status(401).json({ ok: false, msg: 'No token' });
  try { req.user = jwt.verify(t, JWT_SECRET); next(); }
  catch { return res.status(401).json({ ok: false, msg: 'Token inválido' }); }
}

// Requiere token válido Y rol de staff (admin o asistente). Para acciones que
// solo el personal del salón debe poder hacer (listar todas las reservas,
// borrar, aplicar descuentos, aceptar cotizaciones, etc.) — NO usar en rutas
// que los clientes deben poder alcanzar por su link directo (ej. GET /:id).
const { requirePermission, usuarioOpcional } = require('../utils/permisos');
const bitacora = require('../utils/bitacora');
const { quienDe, registrarCambio } = require('../utils/historialReserva');
// Permiso validado contra la base (rol y estado actuales); ver utils/permisos.js
const requireStaff = requirePermission('eventos.gestionar');
const requireListar = requirePermission('eventos.gestionar', 'clientes.ver', 'calendario.ver', 'cotizaciones.ver_todas');
const requireEliminar = requirePermission('eventos.eliminar');
// Editar una reserva: staff de eventos, o un cotizador (que solo puede tocar SUS cotizaciones; se valida en el handler).
const requireEditarReserva = requirePermission('eventos.gestionar', 'cotizaciones.crear');

// Rutas de edición que siguen abiertas para los clientes (por su link): si quien llama es un
// cotizador con sesión, solo puede modificar las cotizaciones que él creó. Anónimos, admin y
// asistente no se ven afectados.
async function soloEditaSusCotizaciones(req, res, next) {
  try {
    const u = await usuarioOpcional(req);
    if (!u || u.role !== 'cotizador') return next();
    if (!mongoose.isValidObjectId(req.params.id)) return next();
    const r = await Reserva.findById(req.params.id).select('tipoReserva creadoPor').lean();
    const esSuya = r && r.tipoReserva === 'cotizacion' && String(r.creadoPor?.id || '') === String(u._id);
    if (esSuya) return next();
    return res.status(403).json({ ok: false, msg: 'Solo puedes editar las cotizaciones que tú creaste' });
  } catch (e) {
    return next(e);
  }
}

// ¿El nuevo mapa discountItems desmarca algún producto que hoy tiene
// aplicarDescuento:true? Eso es "quitar" el descuento de ese producto, sin
// importar el valor numérico del descuento.
function quitaAlgunDescuento(utensiliosActuales, discountItems) {
  if (!discountItems || typeof discountItems !== 'object') return false;
  return (utensiliosActuales || []).some((u) => {
    if (!u.aplicarDescuento) return false;
    const key = String(u.itemId || u._id);
    return !discountItems[key];
  });
}

// Valida la contraseña fija requerida para quitar un descuento ya aplicado
// (independiente de la cuenta con sesión iniciada). Se guarda en .env, no en
// el código, para no dejarla expuesta en el repositorio.
function validarPasswordAdmin(password) {
  const esperada = process.env.DISCOUNT_REMOVAL_PASSWORD || '';
  if (!password || !esperada) return false;
  const a = Buffer.from(String(password));
  const b = Buffer.from(esperada);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

function extraerUsuarioToken(req) {
  try {
    const h = req.headers.authorization || '';
    const t = h.startsWith('Bearer ') ? h.slice(7) : null;
    if (!t) return { id: null, email: null, role: null };
    const payload = jwt.verify(t, JWT_SECRET);
    return {
      id: payload.sub || payload.id || null,
      email: payload.email || null,
      role: payload.role || null
    };
  } catch { return { id: null, email: null, role: null }; }
}

// ===== Helpers de totales =====
function calcSubtotalFromUtensilios(utensilios = []) {
  return (utensilios || []).reduce((acc, u) => {
    const p = Number(u?.precio ?? 0);
    const c = Number(u?.cantidad ?? 0);
    return acc + (Number.isFinite(p) && Number.isFinite(c) ? p * c : 0);
  }, 0);
}
// subtotalDescuento = base sobre la que realmente se aplica el %/monto (solo
// productos con aplicarDescuento=true). Si no se pasa, cae en el subtotal
// completo para no romper otros usos.
function applyDiscount(subtotal, desc = { tipo: 'monto', valor: 0 }, subtotalDescuento = subtotal) {
  let monto = 0;
  const tipo  = desc?.tipo === 'porcentaje' ? 'porcentaje' : 'monto';
  const valor = Number(desc?.valor || 0);
  if (tipo === 'porcentaje') {
    const pct = Math.max(0, Math.min(100, valor));
    monto = subtotalDescuento * (pct / 100);
  } else {
    monto = Math.max(0, valor);
  }
  monto = Math.min(monto, subtotalDescuento);
  return { subtotal, descuento: { tipo, valor, monto }, total: Math.max(0, subtotal - monto) };
}
function calcSubtotalDescuentoFromUtensilios(utensilios = []) {
  return (utensilios || []).reduce((acc, u) => {
    if (!u?.aplicarDescuento) return acc;
    const p = Number(u?.precio ?? 0);
    const c = Number(u?.cantidad ?? 0);
    return acc + (Number.isFinite(p) && Number.isFinite(c) ? p * c : 0);
  }, 0);
}

// ===== Helpers de fecha/horario =====
function normalizeFechaNoonUTC(input) {
  if (!input) return null;

  let ymd;

  if (typeof input === 'string') {
    ymd = input.slice(0, 10);
  } else {
    const d = new Date(input);

    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');

    ymd = `${year}-${month}-${day}`;
  }

  const [year, month, day] = ymd.split('-').map(Number);

  return new Date(year, month - 1, day, 12, 0, 0);
}


function timeToMinutes(t) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(t || '').trim());
  if (!m) return NaN;
  const h = Number(m[1]), mi = Number(m[2]);
  if (!Number.isFinite(h) || !Number.isFinite(mi)) return NaN;
  return h * 60 + mi;
}
// Normaliza un horario [inicio, fin) a intervalos absolutos en una línea de
// tiempo de 48h, duplicándolo 24h después. Así se puede comparar contra
// otro horario sin importar si alguno cruza medianoche (ej. 21:00-02:00).
function normalizeIntervals(startMin, endMin) {
  if (!Number.isFinite(startMin) || !Number.isFinite(endMin)) return [];
  const end = endMin <= startMin ? endMin + 1440 : endMin; // cruza medianoche
  return [[startMin, end], [startMin + 1440, end + 1440]];
}
function overlap(s1, e1, s2, e2) {
  const a = normalizeIntervals(s1, e1);
  const b = normalizeIntervals(s2, e2);
  return a.some(([as, ae]) => b.some(([bs, be]) => Math.max(as, bs) < Math.min(ae, be)));
}
function ymd(input) {
  if (!input) return null;
  return (typeof input === 'string' ? input : new Date(input).toISOString()).slice(0, 10);
}
function sameDayFilter(fechaStr, excluirId = null) {
  const expr = {
    $expr: {
      $eq: [
        { $dateToString: { date: "$fecha", format: "%Y-%m-%d", timezone: TZ } },
        fechaStr
      ]
    }
  };
  if (excluirId) expr._id = { $ne: new mongoose.Types.ObjectId(excluirId) };
  return expr;
}

// ==== FUNCION PARA DETECTAR CAMBIOS =====
function generarHistorialAccesorios(prev = [], next = []) {
  const cambios = [];

  const prevMap = new Map(prev.map(a => [a.accesorioId, a]));
  const nextMap = new Map(next.map(a => [a.accesorioId, a]));

  // ➕ Agregados y 🔄 updates
  for (const [id, nuevo] of nextMap) {
    const anterior = prevMap.get(id);

    if (!anterior) {
      cambios.push({
        tipo: 'producto',
        accion: 'add',
        producto: { id, nombre: nuevo.nombre },
        cantidadAntes: 0,
        cantidadDespues: nuevo.cantidad
      });
    } else if (anterior.cantidad !== nuevo.cantidad) {
      cambios.push({
        tipo: 'producto',
        accion: 'update',
        producto: { id, nombre: nuevo.nombre },
        cantidadAntes: anterior.cantidad,
        cantidadDespues: nuevo.cantidad
      });
    }
  }

  // ❌ Eliminados
  for (const [id, anterior] of prevMap) {
    if (!nextMap.has(id)) {
      cambios.push({
        tipo: 'producto',
        accion: 'remove',
        producto: { id, nombre: anterior.nombre },
        cantidadAntes: anterior.cantidad,
        cantidadDespues: 0
      });
    }
  }

  return cambios;
}

// ===== Mailer =====
// Con MAIL_DEV_MODE=1 no se envía nada real (el mensaje queda en memoria), igual que utils/mailer.js
const transporter = process.env.MAIL_DEV_MODE === '1'
  ? nodemailer.createTransport({ streamTransport: true, newline: 'unix', buffer: true })
  : nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 587),
      secure: false,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
    });
function genPassword(len = 10) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789@$!%*?&';
  return Array.from({ length: len }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}
async function ensureUserAndMaybeSendPassword({ email, fullname }) {
  const correo = email.toLowerCase().trim();
  let user = await Usuario.findOne({ email: correo });
  if (!user) {
    const plain = genPassword(10);
    const hash = await bcrypt.hash(plain, 10);
    user = await Usuario.create({ fullname: fullname || 'Cliente', email: correo, role: 'user', password: hash });
    const loginUrl = `${process.env.FRONTEND_BASE_URL || 'http://localhost:3000'}/login`;
    await transporter.sendMail({
      from: process.env.FROM_EMAIL,
      to: correo,
      subject: 'Tu acceso a Nardeli',
      html: `<p>Hola ${fullname || 'cliente'},</p>
             <p>Tu reserva se registró correctamente. Aquí tienes tu acceso:</p>
             <ul><li><b>Correo:</b> ${correo}</li><li><b>Contraseña temporal:</b> ${plain}</li></ul>
             <p>Puedes iniciar sesión aquí: <a href="${loginUrl}">${loginUrl}</a></p>`
    });
    return { created: true, sentPassword: true };
  }
  if (!user.password) {
    const plain = genPassword(10);
    const hash = await bcrypt.hash(plain, 10);
    user.password = hash; await user.save();
    const loginUrl = `${process.env.FRONTEND_BASE_URL || 'http://localhost:3000'}/login`;
    await transporter.sendMail({
      from: process.env.FROM_EMAIL,
      to: correo,
      subject: 'Tu acceso a Nardeli',
      html: `<p>Hola ${user.fullname || 'cliente'},</p>
             <p>Actualizamos tu acceso. Contraseña temporal:</p>
             <ul><li><b>Correo:</b> ${correo}</li><li><b>Contraseña temporal:</b> ${plain}</li></ul>
             <p>Inicia sesión aquí: <a href="${loginUrl}">${loginUrl}</a></p>`
    });
    return { created: false, sentPassword: true };
  }
  return { created: false, sentPassword: false };
}
// ===== Rutas públicas =====
router.post('/public', async (req, res) => {
  try {
    const { cliente, correo, tipoEvento, fecha, horaInicio, horaFin, telefono, cantidadPersonas, descripcion = '' } = req.body || {};
    if (!cliente || !correo || !tipoEvento || !fecha || !horaInicio || !horaFin || !telefono || !cantidadPersonas) {
      return res.status(400).json({ msg: 'Faltan campos obligatorios' });
    }
    const fechaNorm = normalizeFechaNoonUTC(fecha);
    if (!fechaNorm || isNaN(fechaNorm)) return res.status(400).json({ msg: 'Fecha inválida' });

    const disp = await checarDisponibilidad({ fecha: fechaNorm, horaInicio, horaFin });
    if (!disp.disponible) return res.status(409).json({ msg: disp.motivo });

    const nueva = await new Reserva({
      cliente, correo: correo.toLowerCase().trim(), tipoEvento, fecha: fechaNorm,
      horaInicio, horaFin, telefono, cantidadPersonas, descripcion
    }).save();
    await registrarCambio(nueva._id, { tipo: 'campo', accion: 'field_update', campo: 'creacion', etiqueta: 'Reserva enviada por el cliente (formulario público)' }, { id: null, email: String(correo || '').toLowerCase().trim(), role: 'cliente' });

    const emailResult = await ensureUserAndMaybeSendPassword({ email: correo, fullname: cliente });
    return res.status(201).json({ msg: 'Reserva creada', reserva: nueva, userNotice: emailResult });
  } catch (e) {
    console.error('Error en /reservas/public:', e);
    return res.status(500).json({ msg: 'Error del servidor' });
  }
});

// ===== Disponibilidad general =====
async function checarDisponibilidad({ fecha, horaInicio, horaFin, excluirId = null }) {
  const fechaStr = ymd(fecha);
  if (!fechaStr || !horaInicio || !horaFin) return { disponible: false, motivo: 'Datos incompletos' };
  const ini = timeToMinutes(horaInicio);
  const fin = timeToMinutes(horaFin);
  const delDia = await Reserva.find(sameDayFilter(fechaStr, excluirId)).lean();
  const choca = delDia.some(r => overlap(ini, fin, timeToMinutes(r.horaInicio), timeToMinutes(r.horaFin)));
  return choca ? { disponible: false, motivo: 'Empalme con otra reserva' } : { disponible: true };
}

// Regla de negocio (candado DURO): solo puede existir UN evento confirmado
// activo por fecha+horario. Las cotizaciones sí pueden convivir entre sí
// libremente (ver más abajo el candado blando de 24h) — eso es normal, pasa
// todo el tiempo que varios prospectos pidan cotización para el mismo
// sábado. Lo único que nunca puede duplicarse es un evento ya confirmado.
function filtroEventoActivoEnFecha(fechaStr, excluirId = null) {
  return {
    ...sameDayFilter(fechaStr, excluirId),
    tipoReserva: 'evento',
    estado: { $ne: 'cancelada' },
  };
}

// Un evento confirmado bloquea cualquier otra reserva (cotización o evento)
// si su horario se traslapa con el de ese evento ya existente ese día; para
// usar ese horario hay que cancelar/rechazar el evento primero, sin
// excepción (no hay contraseña que lo salte). Esto es solo la validación
// "amigable" de código (da un mensaje claro antes de intentar guardar) — la
// garantía real contra condiciones de carrera es el índice único parcial
// fecha+horaInicio en el modelo (ver Reservas.js), que es atómico aunque dos
// peticiones lleguen al mismo tiempo desde computadoras distintas.
async function checarEventoEnFecha({ fecha, horaInicio, horaFin, excluirId = null }) {
  const fechaStr = ymd(fecha);
  if (!fechaStr) return { disponible: false, motivo: 'Fecha inválida' };

  const ini = timeToMinutes(horaInicio);
  const fin = timeToMinutes(horaFin);

  const reservasDelDia = await Reserva.find(filtroEventoActivoEnFecha(fechaStr, excluirId)).lean();

  const choque = reservasDelDia.find(e =>
    overlap(ini, fin, timeToMinutes(e.horaInicio), timeToMinutes(e.horaFin))
  );

  if (!choque) return { disponible: true };

  const detalle = choque.tipoEvento ? ` (${choque.tipoEvento} - ${choque.cliente || 'cliente'})` : '';
  return {
    disponible: false,
    motivo: `Ese horario del ${fechaStr} ya está ocupado por un evento confirmado${detalle}. Cancela o rechaza ese evento antes de usar este horario, o selecciona otro horario/fecha.`,
    evento: choque
  };
}

// Regla de negocio (candado BLANDO, 24h): cuando se crea una cotización,
// "aparta" su fecha+horario por 24 horas. Dentro de esa ventana, cualquier
// otra cotización o evento nuevo para la misma fecha+horario dispara una
// alerta y exige la contraseña de un administrador para continuar — después
// de las 24h, o si esa cotización se cancela/rechaza antes, cualquiera puede
// volver a cotizar esa fecha sin restricción (igual que siempre ha
// funcionado). Esto es deliberadamente un candado de aplicación, no de base
// de datos: no es una regla de unicidad real (varias cotizaciones SÍ pueden
// terminar coexistiendo, justo como hoy en producción), solo una alerta con
// opción de forzar.
const HOLD_COTIZACION_MS = 24 * 60 * 60 * 1000;

function filtroCotizacionRecienteEnFecha(fechaStr, excluirId = null) {
  return {
    ...sameDayFilter(fechaStr, excluirId),
    tipoReserva: 'cotizacion',
    estado: { $ne: 'cancelada' },
    holdLiberado: { $ne: true },
    createdAt: { $gte: new Date(Date.now() - HOLD_COTIZACION_MS) },
  };
}

async function checarCotizacionRecienteEnFecha({ fecha, horaInicio, horaFin, excluirId = null }) {
  const fechaStr = ymd(fecha);
  if (!fechaStr) return { disponible: true };

  const ini = timeToMinutes(horaInicio);
  const fin = timeToMinutes(horaFin);

  const recientes = await Reserva.find(filtroCotizacionRecienteEnFecha(fechaStr, excluirId)).lean();
  // OJO: antes se usaba .find() y solo se detectaba (y luego cancelaba) la
  // PRIMERA cotización en conflicto. Si había 3 cotizaciones compitiendo por
  // la misma fecha, las otras 2 se quedaban activas sin que nadie las
  // tocara. Con .filter() se detectan TODAS las que chocan.
  const choques = recientes.filter(c =>
    overlap(ini, fin, timeToMinutes(c.horaInicio), timeToMinutes(c.horaFin))
  );

  if (choques.length === 0) return { disponible: true };

  const primero = choques[0];
  const detalle = primero.tipoEvento ? ` (${primero.tipoEvento} - ${primero.cliente || 'cliente'})` : '';
  const masTexto = choques.length > 1 ? ` y ${choques.length - 1} más` : '';
  const holdExpiraEn = new Date(new Date(primero.createdAt).getTime() + HOLD_COTIZACION_MS);
  return {
    disponible: false,
    motivo: `Ya existe una cotización reciente (hace menos de 24 horas) para ese horario del ${fechaStr}${detalle}${masTexto}. Ingresa la contraseña de un administrador para continuar, o espera a que pase la ventana de 24 horas.`,
    cotizaciones: choques,
    holdExpiraEn
  };
}

// Corre primero el candado duro (evento confirmado, sin excepción) y luego
// el candado blando de 24h (cotización reciente, se puede forzar con
// contraseña). Se usa en POST /, PUT /:id y PUT /:id/aceptar-cotizacion para
// no repetir la misma secuencia tres veces.
async function validarDisponibilidadFecha({ fecha, horaInicio, horaFin, excluirId = null, adminPassword }) {
  const dispEvento = await checarEventoEnFecha({ fecha, horaInicio, horaFin, excluirId });
  if (!dispEvento.disponible) {
    return { ok: false, status: 409, body: { msg: dispEvento.motivo } };
  }

  const dispCot = await checarCotizacionRecienteEnFecha({ fecha, horaInicio, horaFin, excluirId });
  if (!dispCot.disponible) {
    if (!(await validarPasswordAdmin(adminPassword))) {
      // Se manda también la lista (ligera) de cotizaciones en conflicto
      // para que el front pueda ofrecer "reagendar esta cotización" como
      // alternativa a meter la contraseña.
      const cotizacionesConflicto = (dispCot.cotizaciones || []).map(c => ({
        id: c._id,
        cliente: c.cliente || '',
        tipoEvento: c.tipoEvento || '',
        fecha: ymd(c.fecha),
        horaInicio: c.horaInicio || '',
        horaFin: c.horaFin || ''
      }));
      return {
        ok: false,
        status: 401,
        body: {
          msg: dispCot.motivo,
          requierePassword: true,
          holdExpiraEn: dispCot.holdExpiraEn,
          cotizaciones: cotizacionesConflicto
        }
      };
    }
    // Se forzó el candado con contraseña: se devuelven TODAS las
    // cotizaciones que quedaron "superadas" para que la ruta que llama las
    // cancele. Esto pasa sin importar si lo que se termina creando es otra
    // cotización o un evento — la contraseña de administrador siempre
    // significa "esta fecha ya se la llevó alguien más".
    return { ok: true, cotizacionesForzadas: dispCot.cotizaciones };
  }

  return { ok: true };
}

// Alguien usó la contraseña de administrador para tomar una fecha que ya
// tenía una o más cotizaciones recientes apartándola (candado de 24h). Esas
// cotizaciones NO se cancelan ni se ocultan — siguen vivas, visibles y
// editables en la lista de pendientes, para que el staff las pueda mover a
// otra fecha con calma. Lo único que pierden es la prioridad de 24h: dejan
// de contar para el candado, así que ya no le exigen contraseña a nadie más
// ni muestran el badge de "prioridad 24h".
async function liberarHoldDeCotizaciones(cotizaciones, usuarioToken = {}) {
  for (const cotizacion of (cotizaciones || [])) {
    if (!cotizacion?._id) continue;
    await Reserva.findByIdAndUpdate(cotizacion._id, {
      holdLiberado: true,
      $push: {
        historialCambios: {
          tipo: 'edicion',
          campo: 'holdLiberado',
          etiqueta: 'Prioridad de 24h',
          antes: false,
          despues: true,
          usuarioId: usuarioToken.id || null,
          usuarioNombre: 'Sistema (otro cliente tomó esta fecha con contraseña de administrador)'
        }
      }
    });
    await HistorialReserva.create({
      reservaId: cotizacion._id,
      tipo: 'campo',
      accion: 'field_update',
      campo: 'holdLiberado',
      etiqueta: 'Prioridad de 24h',
      valorAntes: false,
      valorDespues: true,
      usuario: usuarioToken.id || null,
      usuarioEmail: usuarioToken.email || '',
      usuarioRole: usuarioToken.role || ''
    });
  }
}

// El mensaje amigable de arriba cubre el caso normal; esto es el respaldo
// para cuando el índice único de la base de datos detecta un choque que el
// chequeo de código no alcanzó a ver (dos peticiones casi simultáneas,
// ambas intentando confirmar un evento en el mismo horario).
function esErrorDeHorarioDuplicado(e) {
  return e && e.code === 11000 && !!(e.keyPattern?.fecha && e.keyPattern?.horaInicio);
}
const MOTIVO_HORARIO_DUPLICADO =
  'Ese horario ya se acaba de ocupar por otro evento (alguien más lo confirmó en este instante). Elige otro horario o fecha.';

// ===== CRUD =====
router.post('/', async (req, res) => {
  try {
    // Quien captura (si trae sesión). Un 'cotizador' solo puede crear cotizaciones,
    // sin importar lo que mande el body.
    delete req.body.creadoPor;
    const autor = await usuarioOpcional(req);
    const tipoReserva = autor?.role === 'cotizador' ? 'cotizacion' : (req.body.tipoReserva || 'evento');
    req.body.fecha = normalizeFechaNoonUTC(req.body.fecha);

    if (!req.body.fecha || isNaN(req.body.fecha)) {
      return res.status(400).json({ msg: 'Fecha inválida' });
    }

    // Candado duro (evento) + candado blando de 24h (cotización reciente).
    let cotizacionesForzadas = [];
    if (tipoReserva === 'cotizacion' || tipoReserva === 'evento') {
      const check = await validarDisponibilidadFecha({
        fecha: req.body.fecha,
        horaInicio: req.body.horaInicio,
        horaFin: req.body.horaFin,
        adminPassword: req.body.adminPassword
      });
      if (!check.ok) return res.status(check.status).json(check.body);
      cotizacionesForzadas = check.cotizacionesForzadas || [];
    }

    // Se guarda quién la capturó para que un 'cotizador' vea después solo las suyas.
    const creadoPor = autor
      ? { id: autor._id, nombre: autor.fullname || '', email: autor.email || '', rol: autor.role || '' }
      : undefined;

    const guardada = await new Reserva({ ...req.body, tipoReserva, ...(creadoPor ? { creadoPor } : {}) }).save();
    await registrarCambio(guardada._id, { tipo: 'campo', accion: 'field_update', campo: 'creacion', etiqueta: tipoReserva === 'cotizacion' ? 'Cotización creada' : 'Reserva creada' }, quienDe(req));

    // Se usó la contraseña de administrador para tomar esta fecha: las
    // cotizaciones con las que chocó pierden su prioridad de 24h (siguen
    // activas, solo ya no bloquean), sin importar si lo que se acaba de
    // crear es otra cotización o ya un evento confirmado.
    if (cotizacionesForzadas.length) {
      await liberarHoldDeCotizaciones(cotizacionesForzadas, extraerUsuarioToken(req));
    }

    return res.status(201).json({ ok: true, id: guardada._id, reserva: guardada });
  } catch (e) {
    if (esErrorDeHorarioDuplicado(e)) {
      return res.status(409).json({ msg: MOTIVO_HORARIO_DUPLICADO });
    }
    console.error('Error al guardar la reserva:', e);
    return res.status(500).json({ msg: 'Error del servidor' });
  }
});
// ===== Cotizaciones (ver: todas si tiene 'ver_todas', si no solo las suyas; editar: las suyas, o cualquiera con 'eventos.gestionar') =====
router.get('/mis-cotizaciones', requirePermission('cotizaciones.crear', 'cotizaciones.ver_todas'), async (req, res) => {
  try {
    const filtro = { tipoReserva: 'cotizacion' };
    const veTodas = !!req.permisos['cotizaciones.ver_todas'];
    // Sin 'ver_todas' (o con ?solo=mias) solo ve las suyas.
    if (!veTodas || req.query.solo === 'mias') filtro['creadoPor.id'] = req.user.sub;
    const editaCualquiera = !!req.permisos['eventos.gestionar'];

    const docs = await Reserva.find(filtro)
      .sort({ createdAt: -1 })
      .limit(300)
      .select('cliente correo telefono tipoEvento fecha horaInicio horaFin cantidadPersonas descripcion estado createdAt creadoPor utensilios')
      .lean();

    const items = docs.map((d) => {
      const subtotal = (d.utensilios || []).reduce((a, u) => a + Number(u.precio || 0) * Number(u.cantidad || 0), 0);
      const { utensilios, ...resto } = d;
      const esMia = String(d.creadoPor?.id || '') === String(req.user.sub);
      return { ...resto, subtotal, articulos: (utensilios || []).length, esMia, puedeEditar: editaCualquiera || esMia };
    });
    res.json({ ok: true, items });
  } catch (e) {
    console.error('reservas/mis-cotizaciones error:', e);
    res.status(500).json({ ok: false, msg: 'No se pudieron cargar las cotizaciones' });
  }
});

// ===== Reserva activa (montado en /reservas => /reservas/activa) =====
router.get('/activa', auth, async (req, res) => {
  try {
    const clienteId = req.user.sub;
    let r = await Reserva.findOne({ clienteId, estado: 'borrador' });
    if (!r) {
      r = await Reserva.create({ clienteId, estado: 'borrador', createdAt: new Date() });
    }
    res.json({ ok: true, reservaId: String(r._id) });
  } catch (e) {
    console.error('reservas/activa error:', e);
    res.status(500).json({ ok: false, msg: 'No se pudo obtener la reserva activa' });
  }
});
  
// GET /reservas
router.get('/', requireListar, async (req, res) => {
  try {
    const { correo } = req.query;
    const tipo = req.query.tipo || req.query.tipoReserva;

    const pipeline = [];
    if (correo) pipeline.push({ $match: { correo: correo.toLowerCase().trim() } });
    if (tipo === 'evento' || tipo === 'cotizacion') {
      pipeline.push({ $match: { tipoReserva: tipo } });
    }

    pipeline.push(
      // Fechas “locales” (string) útiles para UI
      {
        $addFields: {
          fechaLocal: {
            $dateToString: { date: "$fecha", format: "%Y-%m-%d", timezone: TZ }
          },
          creadaLocal: {
            $dateToString: { date: "$createdAt", format: "%Y-%m-%d %H:%M", timezone: TZ }
          },

          // 👇 folio corto (últimos 8 del _id)
          folio: {
            $toUpper: {
              $substrBytes: [{ $toString: "$_id" }, 16, 8]
            }
          }
        }
      },
      // Proyecta explícitamente lo que necesitas (incluye createdAt)
      {
        $project: {
          cliente: 1,
          correo: 1,
          telefono: 1,
          tipoEvento: 1,
          fecha: 1,
          folio: 1,
          fechaLocal: 1,
          horaInicio: 1,
          horaFin: 1,
          cantidadPersonas: 1,
          estado: 1,
          tipoReserva: 1,
          descripcion: 1,
          pdfUrl: 1,
          createdAt: 1,   // ← campo crudo para que el front lo use
          creadaLocal: 1, // ← string ya formateado (opcional)
          holdLiberado: 1 // ← para que el front sepa que ya no tiene prioridad de 24h
        }
      },
      // Ordena (opcional: primero las más recientes por creación)
      { $sort: { createdAt: -1, fecha: 1, horaInicio: 1 } }
    );

    const reservas = await Reserva.aggregate(pipeline);
    return res.json(reservas);
  } catch (e) {
    console.error('Error al obtener reservas:', e);
    return res.status(500).json({ msg: 'Error del servidor' });
  }
});


// Comprueba la contraseña de administrador ANTES de dejar editar un precio (no cambia nada).
router.post('/verificar-clave-admin', requireEditarReserva, async (req, res) => {
  if (await validarPasswordAdmin(req.body?.adminPassword)) return res.json({ ok: true });
  await bitacora.registrar(req.user, 'precio.clave_incorrecta', {
    reservaId: String(req.body?.reservaId || ''),
    folio: String(req.body?.reservaId || '').slice(-8).toUpperCase(),
    articulo: String(req.body?.articulo || ''),
    etapa: 'al entrar a editar',
  });
  if (mongoose.isValidObjectId(req.body?.reservaId)) {
    await registrarCambio(req.body.reservaId, { tipo: 'precio', accion: 'price_denied', producto: { id: '', nombre: String(req.body?.articulo || '') }, etiqueta: `Intento de editar el precio de ${String(req.body?.articulo || 'un artículo')} con clave incorrecta` }, quienDe(req));
  }
  return res.status(401).json({ ok: false, msg: 'Contraseña de administrador incorrecta' });
});

router.post('/disponibilidad', async (req, res) => {
  try {
    const resp = await checarDisponibilidad(req.body);
    return res.json(resp);
  } catch (e) {
    console.error(e);
    return res.status(500).json({ msg: 'Error del servidor' });
  }
});

// ===== Disponibilidad por rango (para el mini calendario de "Reservar Evento") =====
// GET /reservas/disponibilidad?desde=YYYY-MM-DD&hasta=YYYY-MM-DD
// Debe declararse ANTES de "GET /:id" para no ser interceptada por esa ruta.
router.get('/disponibilidad', async (req, res) => {
  try {
    const { desde, hasta } = req.query;

    const inicio = normalizeFechaNoonUTC(desde);
    const fin = normalizeFechaNoonUTC(hasta);

    if (!desde || !hasta || !inicio || isNaN(inicio) || !fin || isNaN(fin)) {
      return res.status(400).json({ msg: 'Parámetros "desde" y "hasta" (YYYY-MM-DD) son requeridos' });
    }

    const finDelDia = new Date(fin.getFullYear(), fin.getMonth(), fin.getDate(), 23, 59, 59, 999);

    const reservas = await Reserva.find({
      fecha: { $gte: inicio, $lte: finDelDia },
      estado: { $ne: 'cancelada' },
      $or: [
        { tipoReserva: 'evento' },
        { tipoReserva: 'cotizacion' },
        { tipoReserva: { $exists: false } },
        { tipoReserva: null }
      ]
    })
      .select('cliente tipoEvento tipoReserva fecha horaInicio horaFin cantidadPersonas estado createdAt holdLiberado')
      .sort({ fecha: 1, horaInicio: 1 })
      .lean();

    const fechas = reservas.map(r => {
      const tipoReserva = r.tipoReserva || 'evento';
      const esEvento = tipoReserva === 'evento';
      // Solo las cotizaciones cargan con el candado de 24h (ver
      // checarCotizacionRecienteEnFecha) — se manda la hora exacta en que
      // expira para que el front pueda mostrar un contador en vivo. Si ya
      // se le liberó el hold (otro cliente tomó la fecha con contraseña de
      // administrador), no manda nada — la cotización sigue viva, solo ya
      // no tiene prioridad.
      const holdExpiraEn = (!esEvento && r.createdAt && !r.holdLiberado)
        ? new Date(new Date(r.createdAt).getTime() + HOLD_COTIZACION_MS)
        : null;
      return {
        id: r._id,
        fecha: ymd(r.fecha),
        tipoReserva,
        tipoEvento: r.tipoEvento || '',
        cliente: r.cliente || '',
        cantidadPersonas: r.cantidadPersonas ?? null,
        horaInicio: r.horaInicio || '',
        horaFin: r.horaFin || '',
        estado: r.estado || 'confirmada',
        // Un evento solo bloquea si su horario se traslapa (lo calcula el front);
        // las cotizaciones son siempre de referencia y nunca bloquean.
        esEvento,
        holdExpiraEn
      };
    });

    return res.json({ ok: true, fechas });
  } catch (e) {
    console.error('GET /reservas/disponibilidad error:', e);
    return res.status(500).json({ msg: 'Error del servidor' });
  }
});

function valorComparable(v) {
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (v === undefined) return null;
  if (v === '') return '';
  return v ?? null;
}

function etiquetaCampo(campo) {
  const map = {
    cliente: 'Cliente',
    correo: 'Correo',
    telefono: 'Teléfono',
    tipoEvento: 'Tipo de evento',
    fecha: 'Fecha',
    horaInicio: 'Hora de inicio',
    horaFin: 'Hora de fin',
    cantidadPersonas: 'Cantidad de personas',
    descripcion: 'Descripción',
    estado: 'Estado',
    tipoReserva: 'Tipo de reserva'
  };
  return map[campo] || campo;
}

function generarCambiosGenerales(prev, body) {
  const campos = [
    'cliente',
    'correo',
    'telefono',
    'tipoEvento',
    'fecha',
    'horaInicio',
    'horaFin',
    'cantidadPersonas',
    'descripcion',
    'estado',
    'tipoReserva'
  ];

  const cambios = [];

  for (const campo of campos) {
    if (!(campo in body)) continue;

    const antes = valorComparable(prev[campo]);
    const despues = valorComparable(body[campo]);

    if (String(antes ?? '') !== String(despues ?? '')) {
      cambios.push({
        tipo: 'campo',
        accion: 'field_update',
        campo,
        etiqueta: etiquetaCampo(campo),
        valorAntes: antes,
        valorDespues: despues
      });
    }
  }

  return cambios;
}

function formatoFechaWA(fecha) {
  if (!fecha) return 'N/D';
  const d = new Date(fecha);
  if (isNaN(d)) return String(fecha);
  return d.toLocaleDateString('es-MX', {
    timeZone: TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
}

function calcularTotalesReserva(reserva) {
  const subtotal = (reserva?.utensilios || []).reduce((acc, it) => {
    const p = Number(it?.precio || 0);
    const q = Number(it?.cantidad || 0);
    return acc + (p * q);
  }, 0);

  const desc = reserva?.precios?.descuento || { tipo: 'monto', valor: 0 };
  let descuento = 0;

  if (desc.tipo === 'porcentaje') {
    const pct = Math.max(0, Math.min(100, Number(desc.valor || 0)));
    descuento = subtotal * (pct / 100);
  } else {
    descuento = Math.max(0, Number(desc.valor || 0));
  }

  descuento = Math.min(descuento, subtotal);
  const total = Math.max(0, subtotal - descuento);

  return { subtotal, descuento, total };
}

function formatearMoneda(valor) {
  return `$${Number(valor || 0).toLocaleString('es-MX', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })}`;
}

function resumenItemsReserva(items = []) {
  if (!Array.isArray(items) || items.length === 0) {
    return 'Sin servicios registrados';
  }

  return items.map(it => {
    const nombre = it?.nombre || 'Ítem';
    const cantidad = Number(it?.cantidad || 0);
    const precio = Number(it?.precio || 0);

    return `${nombre} — Cant: ${cantidad} — P.Unit: ${formatearMoneda(precio)}`;
  }).join(' | ');
}

function compararItemsReserva(prevItems = [], nextItems = []) {
  const cambios = [];

  const keyOf = (it) =>
    String(it?.itemId || it?._id || it?.id || it?.nombre || '').trim();

  const prevMap = new Map(prevItems.map(it => [keyOf(it), it]));
  const nextMap = new Map(nextItems.map(it => [keyOf(it), it]));

  for (const [key, nuevo] of nextMap.entries()) {
    const anterior = prevMap.get(key);

    if (!anterior) {
      cambios.push(
        `• ${nuevo.nombre}: agregado — Cant: ${Number(nuevo.cantidad || 0)} — P.Unit: ${formatearMoneda(nuevo.precio || 0)}`
      );
      continue;
    }

    const cantAntes = Number(anterior.cantidad || 0);
    const cantDespues = Number(nuevo.cantidad || 0);
    const precioAntes = Number(anterior.precio || 0);
    const precioDespues = Number(nuevo.precio || 0);

    if (cantAntes !== cantDespues && precioAntes !== precioDespues) {
      cambios.push(
        `• ${nuevo.nombre}: cantidad ${cantAntes} → ${cantDespues}, precio ${formatearMoneda(precioAntes)} → ${formatearMoneda(precioDespues)}`
      );
      continue;
    }

    if (cantAntes !== cantDespues) {
      cambios.push(`• ${nuevo.nombre}: cantidad ${cantAntes} → ${cantDespues}`);
    }

    if (precioAntes !== precioDespues) {
      cambios.push(`• ${nuevo.nombre}: precio ${formatearMoneda(precioAntes)} → ${formatearMoneda(precioDespues)}`);
    }
  }

  for (const [key, anterior] of prevMap.entries()) {
    if (!nextMap.has(key)) {
      cambios.push(`• ${anterior.nombre}: eliminado`);
    }
  }

  return cambios;
}

function construirPayloadTemplateCambioEvento(prev, actualizada, cambiosGenerales = []) {
  const totPrev = calcularTotalesReserva(prev);
  const totNuevo = calcularTotalesReserva(actualizada);

  const folio = actualizada.shortId || String(actualizada._id).slice(-8).toUpperCase();
  const cliente = actualizada.cliente || 'N/D';
  const telefono = actualizada.telefono || 'N/D';
  const tipoEvento = actualizada.tipoEvento || 'N/D';
  const fecha = formatoFechaWA(actualizada.fecha);
  const horario = `${actualizada.horaInicio || 'N/D'} - ${actualizada.horaFin || 'N/D'}`;
  const personas = String(actualizada.cantidadPersonas ?? 'N/D');

  const servicios = resumenItemsReserva(actualizada.utensilios || []);

  const subtotal = formatearMoneda(totNuevo.subtotal);
  const descuento = formatearMoneda(totNuevo.descuento);
  const total = formatearMoneda(totNuevo.total);

  const cambiosGeneralesTexto = cambiosGenerales.map(c =>
    `• ${c.etiqueta}: ${c.valorAntes ?? 'vacío'} → ${c.valorDespues ?? 'vacío'}`
  );

  const cambiosItemsTexto = compararItemsReserva(
    prev?.utensilios || [],
    actualizada?.utensilios || []
  );

  const cambiosTotalesTexto = [];

  if (Number(totPrev.subtotal) !== Number(totNuevo.subtotal)) {
    cambiosTotalesTexto.push(
      `• Subtotal: ${formatearMoneda(totPrev.subtotal)} → ${formatearMoneda(totNuevo.subtotal)}`
    );
  }

  if (Number(totPrev.descuento) !== Number(totNuevo.descuento)) {
    cambiosTotalesTexto.push(
      `• Descuento: ${formatearMoneda(totPrev.descuento)} → ${formatearMoneda(totNuevo.descuento)}`
    );
  }

  if (Number(totPrev.total) !== Number(totNuevo.total)) {
    cambiosTotalesTexto.push(
      `• Total: ${formatearMoneda(totPrev.total)} → ${formatearMoneda(totNuevo.total)}`
    );
  }

  const cambios = [
  ...cambiosGeneralesTexto,
  ...cambiosItemsTexto,
  ...cambiosTotalesTexto
].join(' | ') || 'Sin cambios detectados';

  return {
    folio,
    cliente,
    telefono,
    tipoEvento,
    fecha,
    horario,
    personas,
    servicios,
    subtotal,
    descuento,
    total,
    cambios
  };
}

function limpiarTextoTemplate(valor, maxLen = 1024) {
  return String(valor ?? '')
    .replace(/[\n\r\t]+/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim()
    .slice(0, maxLen);
}

async function enviarWhatsAppTemplateCambioEvento({
  to,
  folio,
  cliente,
  telefono,
  tipoEvento,
  fecha,
  horario,
  personas,
  servicios,
  subtotal,
  descuento,
  total,
  cambios
}) {
  const url = `https://graph.facebook.com/v23.0/${process.env.WA_PHONE_NUMBER_ID}/messages`;

  const requestBody = {
    messaging_product: 'whatsapp',
    to,
    type: 'template',
    template: {
      name: 'evento_cambio_alerta',
      language: {
        code: 'es_MX'
      },
      components: [
        {
          type: 'body',
          parameters: [
            { type: 'text', text: limpiarTextoTemplate(folio) },
            { type: 'text', text: limpiarTextoTemplate(cliente) },
            { type: 'text', text: limpiarTextoTemplate(telefono) },
            { type: 'text', text: limpiarTextoTemplate(tipoEvento) },
            { type: 'text', text: limpiarTextoTemplate(fecha) },
            { type: 'text', text: limpiarTextoTemplate(horario) },
            { type: 'text', text: limpiarTextoTemplate(personas) },
            { type: 'text', text: limpiarTextoTemplate(servicios) },
            { type: 'text', text: limpiarTextoTemplate(subtotal) },
            { type: 'text', text: limpiarTextoTemplate(descuento) },
            { type: 'text', text: limpiarTextoTemplate(total) },
            { type: 'text', text: limpiarTextoTemplate(cambios) }
          ]
        }
      ]
    }
  };

  console.log('========== WHATSAPP TEMPLATE ==========');
  console.log('URL:', url);
  console.log('TO:', to);
  console.log('PHONE_NUMBER_ID:', process.env.WA_PHONE_NUMBER_ID);
  console.log('TEMPLATE BODY:', JSON.stringify(requestBody, null, 2));

  try {
    const { data, status } = await axios.post(url, requestBody, {
      headers: {
        Authorization: `Bearer ${process.env.WA_ACCESS_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });

    console.log('META STATUS:', status);
    console.log('META RESPONSE:', JSON.stringify(data, null, 2));

    return data;
  } catch (err) {
    const metaError = err?.response?.data;
    console.error('META STATUS:', err?.response?.status);
    console.error('ERROR META TEMPLATE:', JSON.stringify(metaError, null, 2));
    throw new Error(metaError?.error?.message || err.message || 'Error enviando template de WhatsApp');
  }
}

/*function construirMensajeCambioEvento(prev, actualizada, cambiosGenerales = []) {
  const totPrev = calcularTotalesReserva(prev);
  const totNuevo = calcularTotalesReserva(actualizada);

  const cambiosGeneralesTexto = cambiosGenerales.map(c =>
    `• ${c.etiqueta}: ${c.valorAntes ?? 'vacío'} → ${c.valorDespues ?? 'vacío'}`
  );

  const cambiosItemsTexto = compararItemsReserva(
    prev?.utensilios || [],
    actualizada?.utensilios || []
  );

  const cambiosTotalesTexto = [];

  if (Number(totPrev.subtotal) !== Number(totNuevo.subtotal)) {
    cambiosTotalesTexto.push(
      `• Subtotal: ${formatearMoneda(totPrev.subtotal)} → ${formatearMoneda(totNuevo.subtotal)}`
    );
  }

  if (Number(totPrev.descuento) !== Number(totNuevo.descuento)) {
    cambiosTotalesTexto.push(
      `• Descuento: ${formatearMoneda(totPrev.descuento)} → ${formatearMoneda(totNuevo.descuento)}`
    );
  }

  if (Number(totPrev.total) !== Number(totNuevo.total)) {
    cambiosTotalesTexto.push(
      `• Total: ${formatearMoneda(totPrev.total)} → ${formatearMoneda(totNuevo.total)}`
    );
  }

  return [
    '🚨 CAMBIO EN EVENTO',
    '',
    'Se editó una reserva.',
    '',
    `Folio: ${actualizada.shortId || String(actualizada._id).slice(-8).toUpperCase()}`,
    `Cliente: ${actualizada.cliente || 'N/D'}`,
    `Teléfono: ${actualizada.telefono || 'N/D'}`,
    `Tipo de evento: ${actualizada.tipoEvento || 'N/D'}`,
    `Fecha: ${formatoFechaWA(actualizada.fecha)}`,
    `Horario: ${actualizada.horaInicio || 'N/D'} - ${actualizada.horaFin || 'N/D'}`,
    `Personas: ${actualizada.cantidadPersonas ?? 'N/D'}`,
    '',
    'Servicios actuales:',
    resumenItemsReserva(actualizada.utensilios || []),
    '',
    `Subtotal actual: ${formatearMoneda(totNuevo.subtotal)}`,
    `Descuento actual: ${formatearMoneda(totNuevo.descuento)}`,
    `Total actual: ${formatearMoneda(totNuevo.total)}`,
    '',
    'Cambios detectados:',
    ...(cambiosGeneralesTexto.length ? cambiosGeneralesTexto : []),
    ...(cambiosItemsTexto.length ? cambiosItemsTexto : []),
    ...(cambiosTotalesTexto.length ? cambiosTotalesTexto : []),
    ...(!cambiosGeneralesTexto.length && !cambiosItemsTexto.length && !cambiosTotalesTexto.length
      ? ['• Sin cambios detectados']
      : [])
  ].join('\n');
}*/

/*async function enviarWhatsAppAlerta({ to, body }) {
  const url = `https://graph.facebook.com/v23.0/${process.env.WA_PHONE_NUMBER_ID}/messages`;

  const resp = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.WA_ACCESS_TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to,
      type: 'text',
      text: { body }
    })
  });

  const data = await resp.json();

  if (!resp.ok) {
    throw new Error(data?.error?.message || 'Error enviando WhatsApp');
  }

  return data;
}*/

router.put('/:id', requireEditarReserva, async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ msg: 'ID inválido' });
    }

    const prev = await Reserva.findById(id);
    if (!prev) {
      return res.status(404).json({ msg: 'Reserva no encontrada' });
    }

    // Un cotizador (sin permiso de gestionar eventos) solo edita SUS cotizaciones, y solo los
    // datos de la cotización: no puede convertirla en evento ni tocar precios, estado, etc.
    if (!req.permisos['eventos.gestionar']) {
      const esSuya = prev.tipoReserva === 'cotizacion' && String(prev.creadoPor?.id || '') === String(req.user.sub);
      if (!esSuya) {
        return res.status(403).json({ ok: false, msg: 'Solo puedes editar las cotizaciones que tú creaste' });
      }
      const permitidos = ['cliente', 'correo', 'telefono', 'tipoEvento', 'fecha', 'horaInicio', 'horaFin',
        'cantidadPersonas', 'descripcion', 'notaCotizacion', 'adminPassword'];
      req.body = Object.fromEntries(Object.entries(req.body || {}).filter(([k]) => permitidos.includes(k)));
      req.body.tipoReserva = 'cotizacion';
    }

   const fechaFinal = req.body.fecha ? normalizeFechaNoonUTC(req.body.fecha) : prev.fecha;
    if (!fechaFinal || isNaN(fechaFinal)) {
      return res.status(400).json({ msg: 'Fecha inválida' });
    }
    req.body.fecha = fechaFinal;

    const nextTipo = req.body.tipoReserva || prev.tipoReserva || 'evento';

    const horaInicioFinal = req.body.horaInicio || prev.horaInicio;
    const horaFinFinal = req.body.horaFin || prev.horaFin;
    const fechaCambio = ymd(fechaFinal) !== ymd(prev.fecha)
      || horaInicioFinal !== prev.horaInicio
      || horaFinFinal !== prev.horaFin;
    const tipoCambio = nextTipo !== (prev.tipoReserva || 'evento');

    let cotizacionesForzadas = [];
    // El candado de fecha (evento duro + cotización reciente) solo tiene
    // sentido si de verdad se está cambiando la fecha/horario/tipo — si solo
    // se edita el nombre, descripción, etc., no hay por qué volver a chocar
    // contra otra cotización que ya compartía esa misma fecha desde antes de
    // este edit (si no, cualquier edición trivial de una cotización vieja
    // quedaba bloqueada por otra cotización reciente sin razón).
    if ((fechaCambio || tipoCambio) && (nextTipo === 'cotizacion' || nextTipo === 'evento')) {
      const check = await validarDisponibilidadFecha({
        fecha: req.body.fecha,
        horaInicio: horaInicioFinal,
        horaFin: horaFinFinal,
        excluirId: id,
        adminPassword: req.body.adminPassword
      });
      if (!check.ok) return res.status(check.status).json(check.body);
      cotizacionesForzadas = check.cotizacionesForzadas || [];
    }

    // ===== Detectar cambios antes de actualizar =====
    const cambios = generarCambiosGenerales(prev, {
      ...req.body,
      tipoReserva: nextTipo
    });

    const actualizada = await Reserva.findByIdAndUpdate(
      id,
      { ...req.body, tipoReserva: nextTipo },
      { new: true, runValidators: true }
    );

    if (!actualizada) {
      return res.status(404).json({ msg: 'Reserva no encontrada' });
    }

    if (cotizacionesForzadas.length) {
      await liberarHoldDeCotizaciones(cotizacionesForzadas, extraerUsuarioToken(req));
    }

    // ===== Historial: eventos y cotizaciones. WhatsApp: solo si YA era evento antes del cambio =====
    if (cambios.length > 0) {
      const _u = extraerUsuarioToken(req);
      // Guardar historial de campos
      await HistorialReserva.insertMany(
        cambios.map(c => ({
          reservaId: actualizada._id,
          tipo: c.tipo,
          accion: c.accion,
          campo: c.campo,
          etiqueta: c.etiqueta,
          valorAntes: c.valorAntes,
          valorDespues: c.valorDespues,
          usuario: _u.id,
          usuarioEmail: _u.email || '',
          usuarioRole: _u.role || ''
        }))
      );

      if (prev.tipoReserva === 'evento') {
      const payload = construirPayloadTemplateCambioEvento(
        prev.toObject(),
        actualizada.toObject(),
        cambios
      );

      try {
        await enviarWhatsAppTemplateCambioEvento({
          to: process.env.WA_ALERT_NUMBER,
          ...payload
        });

        await HistorialReserva.create({
          reservaId: actualizada._id,
          tipo: 'whatsapp',
          accion: 'alert_sent',
          destino: process.env.WA_ALERT_NUMBER,
          mensaje: JSON.stringify(payload, null, 2),
          usuario: req.user?.sub || null
        });
      } catch (err) {
        console.error('ERROR ENVIANDO TEMPLATE EN PUT /:id:', err.message);

        await HistorialReserva.create({
          reservaId: actualizada._id,
          tipo: 'whatsapp',
          accion: 'alert_error',
          destino: process.env.WA_ALERT_NUMBER,
          mensaje: JSON.stringify(payload, null, 2),
          error: err.message,
          usuario: req.user?.sub || null
        });
      }
      }
    }

    return res.json(actualizada);
  } catch (e) {
    if (esErrorDeHorarioDuplicado(e)) {
      return res.status(409).json({ msg: MOTIVO_HORARIO_DUPLICADO });
    }
    console.error('Error al actualizar:', e);
    return res.status(500).json({ msg: 'Error del servidor' });
  }
});

router.delete('/:id', requireEliminar, async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) return res.status(400).json({ msg: 'ID inválido' });
    const out = await Reserva.findByIdAndDelete(id);
    if (!out) return res.status(404).json({ msg: 'Reserva no encontrada' });
    return res.json({ msg: 'Reserva eliminada' });
  } catch (e) {
    console.error('Error al eliminar:', e);
    return res.status(500).json({ msg: 'Error del servidor' });
  }
});

// ✅ GET /reservas/lookup/:key
// key puede ser: "65f..." (ObjectId) o "#C2DFFC0C" o "C2DFFC0C"
// ✅ GET /reservas/lookup/:key
router.get('/lookup/:key', async (req, res) => {
  try {
    let { key } = req.params;
    key = String(key || '').trim();

    // Limpia: quita #, espacios, "folio:", etc. y deja solo HEX
    key = key.replace(/[^0-9a-fA-F]/g, '').toUpperCase();

    let r = null;

    // 1) si viene ObjectId completo
    if (mongoose.isValidObjectId(key)) {
      r = await Reserva.findById(key).lean();
      if (r) return res.json({ ok: true, reserva: r });
    }

    // 2) si viene folio de 8 hex (como C2DFFC0C)
    if (/^[0-9A-F]{8}$/.test(key)) {
      const out = await Reserva.aggregate([
        {
          $addFields: {
            _idStr: { $toString: '$_id' }
          }
        },
        {
          $addFields: {
            folio8: {
              $toUpper: {
                $substrBytes: [
                  '$_idStr',
                  { $subtract: [{ $strLenBytes: '$_idStr' }, 8] },
                  8
                ]
              }
            }
          }
        },
        { $match: { folio8: key } },
        { $limit: 1 }
      ]);

      r = out?.[0] || null;
    }

    if (!r) return res.status(404).json({ ok: false, msg: 'Reserva no encontrada' });
    return res.json({ ok: true, reserva: r });
  } catch (e) {
    console.error('GET /reservas/lookup/:key', e);
    return res.status(500).json({ ok: false, msg: 'Error interno' });
  }
});

// ====== RUTA PODER VISUALIZAR EL HISTORIAL DE CAMBIOS =====
router.get('/:id/historial', requireStaff, async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ msg: 'ID inválido' });
    }

    const historial = await HistorialReserva.find({ reservaId: id })
      .sort({ fecha: -1 })
      .lean();

    return res.json({ ok: true, historial });
  } catch (e) {
    console.error('GET /reservas/:id/historial error:', e);
    return res.status(500).json({ msg: 'Error interno' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) return res.status(400).json({ msg: 'ID inválido' });
    const r = await Reserva.findById(id).lean();
    if (!r) return res.status(404).json({ msg: 'No encontrada' });
    return res.json(r);
  } catch (e) {
    console.error(e);
    return res.status(500).json({ msg: 'Error del servidor' });
  }
});

// ===== Utensilios =====
router.put('/:id/utensilios', soloEditaSusCotizaciones, async (req, res) => {
  try {
    const { id } = req.params;
    const { items = [], discountItems } = req.body;
    // Si no viene discountItems (llamada legada), no se debe borrar la
    // bandera aplicarDescuento ya guardada de cada producto.
    const hasDiscountItems = discountItems && typeof discountItems === 'object';

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ msg: 'ID inválido' });
    }

    if (!Array.isArray(items)) {
      return res.status(400).json({ msg: 'items debe ser un arreglo' });
    }

    const reservaActual = await Reserva.findById(id).lean();
    if (!reservaActual) {
      return res.status(404).json({ msg: 'Reserva no encontrada' });
    }

    // Desmarcar un producto que ya tenía el descuento aplicado (por ejemplo
    // al editar el carrito y guardar desde "Finalizar Reserva" o "Actualizar
    // Saldo") requiere confirmar con la contraseña de una cuenta admin,
    // igual que en PATCH /:id/precios.
    if (quitaAlgunDescuento(reservaActual.utensilios, discountItems)) {
      const adminPassword = req.body?.adminPassword;
      if (!(await validarPasswordAdmin(adminPassword))) {
        return res.status(401).json({ msg: 'Se requiere la contraseña de un administrador para quitar el descuento' });
      }
    }

    // ===== HISTORIAL: eventos y cotizaciones =====
    {
      const prev = reservaActual.utensilios || [];
      const next = items || [];

      const prevMap = new Map(
        prev.map(u => [String(u.itemId || u._id || u.id), u])
      );

      const cambios = [];

      // Agregados y actualizaciones
      for (const it of next) {
        const itemKey = String(it.itemId || it._id || it.id);
        const anterior = prevMap.get(itemKey);
        const cantidadNueva = Number(it.cantidad ?? it.qty ?? 0);

        if (!anterior) {
          cambios.push({
            tipo: 'producto',
            accion: 'add',
            producto: {
              id: itemKey,
              nombre: it.nombre
            },
            cantidadAntes: 0,
            cantidadDespues: cantidadNueva
          });
        } else if (Number(anterior.cantidad) !== cantidadNueva) {
          cambios.push({
            tipo: 'producto',
            accion: 'update',
            producto: {
              id: itemKey,
              nombre: it.nombre
            },
            cantidadAntes: Number(anterior.cantidad || 0),
            cantidadDespues: cantidadNueva
          });
        }
      }

      // Eliminados
      for (const u of prev) {
        const itemKey = String(u.itemId || u._id || u.id);
        const sigue = next.find(
          n => String(n.itemId || n._id || n.id) === itemKey
        );

        if (!sigue) {
          cambios.push({
            tipo: 'producto',
            accion: 'remove',
            producto: {
              id: itemKey,
              nombre: u.nombre
            },
            cantidadAntes: Number(u.cantidad || 0),
            cantidadDespues: 0
          });
        }
      }

      if (cambios.length > 0) {
        const _uProd = quienDe(req);
        await HistorialReserva.insertMany(
          cambios.map(c => ({
            reservaId: reservaActual._id,
            ...c,
            usuario: _uProd.id,
            usuarioEmail: _uProd.email,
            usuarioRole: _uProd.role
          }))
        );
      }
    }

    // ===== Lógica original para guardar utensilios =====
    const prevById = new Map(
      (reservaActual.utensilios || []).map(u => [String(u.itemId || u._id || u.id), u])
    );

    const saneados = [];
    const idsParaPrecio = [];
    const preciosCambiados = [];   // precios que cambiaron CON la clave de administrador
    const preciosIgnorados = [];   // intentos de cambiar un precio SIN la clave (se conserva el precio vigente)

    for (const it of items) {
      const itemId = it.itemId || it.id || it._id;
      const cantidad = Number(it.cantidad ?? it.qty ?? 0);

      if (!it.nombre || !Number.isFinite(cantidad) || cantidad < 0) {
        return res.status(400).json({ msg: 'Ítem inválido' });
      }

      let castId = null;
      if (itemId) {
        if (!mongoose.isValidObjectId(itemId)) {
          return res.status(400).json({ msg: 'itemId inválido' });
        }
        castId = new mongoose.Types.ObjectId(itemId);
        idsParaPrecio.push(castId);
      }

      saneados.push({
        ...(castId ? { itemId: castId } : {}),
        nombre: it.nombre,
        cantidad,
        unidad: it.unidad || 'pza',
        categoria: it.categoria || 'general',
        _precioInput: it.precio,
        _descInput: it.descripcion
      });
    }

    let invById = new Map();
    if (idsParaPrecio.length) {
      const prods = await Producto.find({ _id: { $in: idsParaPrecio } })
        .select('precio descripcion')
        .lean();

      invById = new Map(
        prods.map(p => [
          String(p._id),
          {
            precio: Number(p.precio ?? 0),
            descripcion: p.descripcion || ''
          }
        ])
      );
    }

    // Un precio distinto del vigente (o del inventario, en líneas nuevas) solo se acepta con la contraseña de administrador.
    {
      const claveOk = validarPasswordAdmin(req.body?.adminPassword);
      for (const s of saneados) {
        if (s._precioInput == null || s._precioInput === '') continue;
        const entrada = Number(s._precioInput);
        if (!Number.isFinite(entrada)) continue;
        const key = s.itemId ? String(s.itemId) : null;
        const prevLinea = key ? prevById.get(key) : null;
        const inv = key ? invById.get(key) : null;
        const base = prevLinea && Number(prevLinea.precio) > 0 ? Number(prevLinea.precio) : (inv && inv.precio > 0 ? inv.precio : null);
        if (base == null || entrada === base) continue;
        if (claveOk) { preciosCambiados.push({ id: key, nombre: s.nombre, antes: base, despues: entrada }); continue; }
        s._precioInput = undefined; // conserva el precio vigente
        preciosIgnorados.push({ id: key, nombre: s.nombre, antes: base, despues: entrada });
      }
    }

    const snapshot=saneados.map(s=>{

const key=s.itemId
?String(s.itemId)
:null;

const prev=
key
?prevById.get(key)
:null;

const prevPrice=
prev
?Number(prev.precio)
:undefined;

const prevDesc=
prev
?(prev.descripcion||'')
:'';

const inv=
key
&&
invById.get(key);

const invPrice=
inv
?inv.precio
:undefined;

const invDesc=
inv
?inv.descripcion
:'';

const finalPrice=
Number.isFinite(
Number(
s._precioInput
)
)
?Number(
s._precioInput
)
:
(
Number.isFinite(
prevPrice
)
&&
prevPrice>0
)
?prevPrice
:
(
Number.isFinite(
invPrice
)
&&
invPrice>0
)
?invPrice
:
0;

const hasInputDesc=
s._descInput!=null
&&
String(
s._descInput
)
.trim()!=='';

const finalDesc=
hasInputDesc
?String(
s._descInput
)
:
(
prevDesc
||
invDesc
||
''
);

const fechaAgregado=

prev
?.fechaAgregado

||

new Date(
new Date()
.toLocaleString(
'en-US',
{
timeZone:
TZ
}
)
);

const {
_precioInput,
_descInput,
...rest
}=s;

return{

...rest,

precio:
finalPrice,

descripcion:
finalDesc,

aplicarDescuento:
hasDiscountItems
?!!discountItems[
String(
s.itemId
)
]
:!!(prev && prev.aplicarDescuento),

fechaAgregado

};

});

    const updated = await Reserva.findByIdAndUpdate(
      id,
      { $set: { utensilios: snapshot } },
      { new: true }
    );

    const subtotal = calcSubtotalFromUtensilios(updated.utensilios || []);
    const subtotalDescuento = calcSubtotalDescuentoFromUtensilios(updated.utensilios || []);
    const precios = applyDiscount(
      subtotal,
      updated.precios?.descuento || { tipo: 'monto', valor: 0 },
      subtotalDescuento
    );

    updated.precios = precios;
    await updated.save();

// ===== WHATSAPP ALERTA (solo si hubo cambios reales) =====
if (reservaActual.tipoReserva === 'evento') {
  try {
    const payload = construirPayloadTemplateCambioEvento(
      reservaActual,
      updated.toObject(),
      [] // aquí no usamos cambiosGenerales
    );

    if (payload.cambios !== 'Sin cambios detectados') {
      await enviarWhatsAppTemplateCambioEvento({
        to: process.env.WA_ALERT_NUMBER,
        ...payload
      });

      await HistorialReserva.create({
        reservaId: updated._id,
        tipo: 'whatsapp',
        accion: 'alert_sent',
        destino: process.env.WA_ALERT_NUMBER,
        mensaje: JSON.stringify(payload, null, 2)
      });
    }

  } catch (err) {
    console.error('ERROR ENVIANDO TEMPLATE EN PUT /:id/utensilios:', err);

    await HistorialReserva.create({
      reservaId: updated._id,
      tipo: 'whatsapp',
      accion: 'alert_error',
      destino: process.env.WA_ALERT_NUMBER,
      mensaje: 'Error enviando template',
      error: err.message
    });
  }
}

    {
      const _uPrecio = quienDe(req);
      for (const c of preciosCambiados) {
        await registrarCambio(id, { tipo: 'precio', accion: 'price_update', producto: { id: c.id || '', nombre: c.nombre }, etiqueta: `Precio de ${c.nombre}`, valorAntes: c.antes, valorDespues: c.despues }, _uPrecio);
        await bitacora.registrar(req.user || { email: _uPrecio.email }, 'precio.cambiar', { reservaId: id, folio: String(id).slice(-8).toUpperCase(), articulo: c.nombre, anterior: c.antes, nuevo: c.despues, via: 'guardar artículos' });
      }
      for (const c of preciosIgnorados) {
        await registrarCambio(id, { tipo: 'precio', accion: 'price_denied', producto: { id: c.id || '', nombre: c.nombre }, etiqueta: `Intento de cambiar el precio de ${c.nombre} sin clave (se conservó el vigente)`, valorAntes: c.antes, valorDespues: c.despues }, _uPrecio);
        await bitacora.registrar({ email: _uPrecio.email || 'Desconocido' }, 'precio.clave_incorrecta', { reservaId: id, folio: String(id).slice(-8).toUpperCase(), articulo: c.nombre, anterior: c.antes, nuevo: c.despues, via: 'guardar artículos' });
      }
      // marcas de "aplicar descuento" por producto
      if (hasDiscountItems) {
        const antes = new Map((reservaActual.utensilios || []).map(u => [String(u.itemId || u._id), u]));
        for (const u of (reservaActual.utensilios || [])) {
          const k = String(u.itemId || u._id);
          const ahora = !!discountItems[k];
          if (!!u.aplicarDescuento !== ahora) {
            await registrarCambio(id, { tipo: 'descuento', accion: ahora ? 'discount_add' : 'discount_remove', etiqueta: `Descuento ${ahora ? 'aplicado a' : 'quitado de'} ${u.nombre}` }, _uPrecio);
          }
        }
        void antes;
      }
    }
    return res.json({ ok: true, reserva: updated });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ msg: 'Error interno' });
  }
});

router.patch('/:id/utensilios/:lineId', soloEditaSusCotizaciones, async (req, res) => {
  try {
    const { id, lineId } = req.params;
    if (!mongoose.isValidObjectId(id) || !mongoose.isValidObjectId(lineId)) {
      return res.status(400).json({ msg: 'ID inválido' });
    }
    const set = {};
    if (req.body.cantidad != null) set['utensilios.$.cantidad'] = Number(req.body.cantidad);
    let precioLineaCambiado = false;
    if (req.body.precio != null) {
      if (validarPasswordAdmin(req.body.adminPassword)) {
        set['utensilios.$.precio'] = Number(req.body.precio);
        precioLineaCambiado = true;
      } else {
        await registrarCambio(id, { tipo: 'precio', accion: 'price_denied', etiqueta: `Intento de cambiar un precio sin clave (${req.body.nombre || 'artículo'})`, valorDespues: Number(req.body.precio) }, quienDe(req));
        await bitacora.registrar(req.user || { email: quienDe(req).email || 'Desconocido' }, 'precio.clave_incorrecta', { reservaId: id, folio: String(id).slice(-8).toUpperCase(), articulo: req.body.nombre || '', nuevo: Number(req.body.precio), via: 'línea de artículo' });
      }
    }
    if (req.body.nombre)           set['utensilios.$.nombre']   = req.body.nombre;
    if (req.body.categoria)        set['utensilios.$.categoria']= String(req.body.categoria).toLowerCase();
    if (req.body.unidad)           set['utensilios.$.unidad']   = req.body.unidad;
    if (req.body.imagen)           set['utensilios.$.imagen']   = req.body.imagen;
    if (req.body.descripcion != null) set['utensilios.$.descripcion'] = String(req.body.descripcion);

    const r = await Reserva.findOneAndUpdate(
      { _id: id, 'utensilios._id': lineId },
      { $set: set },
      { new: true, runValidators: true }
    ).select('utensilios');

    if (!r) return res.status(404).json({ msg: 'Reserva o línea no encontrada' });
    if (precioLineaCambiado) {
      const _uL = quienDe(req);
      const linea = (r.utensilios || []).find((u) => String(u._id) === String(lineId));
      await registrarCambio(id, { tipo: 'precio', accion: 'price_update', producto: { id: String(lineId), nombre: linea?.nombre || '' }, etiqueta: `Precio de ${linea?.nombre || 'artículo'}`, valorDespues: Number(req.body.precio) }, _uL);
      await bitacora.registrar(req.user || { email: _uL.email || 'Desconocido' }, 'precio.cambiar', { reservaId: id, folio: String(id).slice(-8).toUpperCase(), articulo: linea?.nombre || '', nuevo: Number(req.body.precio), via: 'línea de artículo' });
    }
    res.json(r.utensilios);
  } catch (e) {
    console.error(e);
    res.status(400).json({ msg: 'Error al actualizar la línea' });
  }
});

router.get('/:id/utensilios', async (req, res) => {
  const { id } = req.params;
  if (!mongoose.isValidObjectId(id)) return res.status(400).json({ msg: 'ID inválido' });
  const r = await Reserva.findById(id).select('utensilios').lean();
  if (!r) return res.status(404).json({ msg: 'Reserva no encontrada' });
  res.json(r.utensilios || []);
});

// Cambiar el precio de un artículo en una reserva: lo puede hacer personal y cotizador (este último solo en sus
// cotizaciones), pero SIEMPRE con la contraseña de administrador. Todo intento queda en la bitácora.
router.patch('/:id/utensilios/:itemId/precio', requireEditarReserva, soloEditaSusCotizaciones, async (req, res) => {
  try {
    const { id, itemId } = req.params;
    if (!mongoose.isValidObjectId(id) || !mongoose.isValidObjectId(itemId)) {
      return res.status(400).json({ msg: 'ID inválido' });
    }
    const p = Number((req.body && req.body.precio) ?? req.query.precio);
    if (!Number.isFinite(p) || p < 0) return res.status(400).json({ msg: 'Precio inválido' });

    const previa = await Reserva.findById(id).select('nombre cliente tipoReserva utensilios').lean();
    if (!previa) return res.status(404).json({ msg: 'Reserva no encontrada' });
    const lineaPrevia = (previa.utensilios || []).find((u) => String(u.itemId) === String(itemId));
    const contexto = {
      reservaId: id,
      folio: String(id).slice(-8).toUpperCase(),
      cliente: previa.nombre || previa.cliente || '',
      tipo: previa.tipoReserva || '',
      articulo: lineaPrevia?.nombre || req.body?.nombre || '',
      anterior: lineaPrevia ? Number(lineaPrevia.precio || 0) : null,
      nuevo: p,
    };

    if (!(await validarPasswordAdmin(req.body?.adminPassword))) {
      await bitacora.registrar(req.user, 'precio.clave_incorrecta', contexto);
      await registrarCambio(id, { tipo: 'precio', accion: 'price_denied', producto: { id: String(itemId), nombre: contexto.articulo }, etiqueta: `Intento de cambiar el precio de ${contexto.articulo} con clave incorrecta`, valorAntes: contexto.anterior, valorDespues: p }, quienDe(req));
      return res.status(401).json({ msg: 'Se requiere la contraseña de administrador para cambiar un precio', requierePassword: true });
    }

    const updated = await Reserva.findOneAndUpdate(
      { _id: id, 'utensilios.itemId': itemId },
      { $set: { 'utensilios.$.precio': p } },
      { new: true }
    ).lean();
    if (updated) {
      await bitacora.registrar(req.user, 'precio.cambiar', contexto);
      await registrarCambio(id, { tipo: 'precio', accion: 'price_update', producto: { id: String(itemId), nombre: contexto.articulo }, etiqueta: `Precio de ${contexto.articulo}`, valorAntes: contexto.anterior, valorDespues: p }, quienDe(req));
      return res.json({ ok: true, utensilios: updated.utensilios });
    }

    const prod = await Producto.findById(itemId).select('nombre categoria unidad imagen descripcion').lean();
    const nuevaLinea = {
      itemId: new mongoose.Types.ObjectId(itemId),
      nombre: prod?.nombre || 'Ítem',
      categoria: (prod?.categoria || 'general').toLowerCase(),
      unidad: prod?.unidad || 'pza',
      cantidad: 0,
      precio: p,
      descripcion: prod?.descripcion || '',
      ...(prod?.imagen ? { imagen: prod.imagen } : {})
    };
    const afterPush = await Reserva.findByIdAndUpdate(id, { $push: { utensilios: nuevaLinea } }, { new: true }).lean();
    if (!afterPush) return res.status(404).json({ msg: 'Reserva no encontrada' });
    await bitacora.registrar(req.user, 'precio.cambiar', contexto);
    await registrarCambio(id, { tipo: 'precio', accion: 'price_update', producto: { id: String(itemId), nombre: contexto.articulo }, etiqueta: `Precio de ${contexto.articulo}`, valorAntes: contexto.anterior, valorDespues: p }, quienDe(req));
    return res.json({ ok: true, utensilios: afterPush.utensilios });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ msg: 'Error interno' });
  }
});

// ===== PDF =====
router.get('/:id/pdf', async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) return res.status(400).json({ msg: 'ID inválido' });
    const reserva = await Reserva.findById(id).lean();
    if (!reserva) return res.status(404).json({ msg: 'Reserva no encontrada' });

    let productosById = new Map();
    const ids = (reserva.utensilios || []).map(u => u.itemId).filter(Boolean);
    if (ids.length) {
      const productos = await Producto.find({ _id: { $in: ids } }).lean();
      productosById = new Map(productos.map(p => [String(p._id), p]));
    }
    const brand = { title: 'Nardeli', footer: 'Nardeli - Salón de Eventos' };
    streamReservaPDF(res, { reserva, productosById, brand });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ msg: 'Error interno al generar PDF' });
  }
});

router.get(
  '/:id/estado-cuenta/pdf',
  async (req, res) => {

    try {

      const { id } = req.params;

      if (!mongoose.isValidObjectId(id)) {
        return res
          .status(400)
          .json({
            msg:'ID inválido'
          });
      }

      await streamEstadoCuentaPdf(
        res,
        id
      );

    } catch (e) {

      console.error(
        'estado cuenta:',
        e
      );

      return res
        .status(500)
        .json({
          msg:
          'Error al generar estado de cuenta'
        });

    }

  }
);

// ===== Descuento y totales =====
function calcularSubTotal(utensilios = []) {
  return (utensilios || []).reduce((acc, it) => {
    const p = Number(it?.precio || 0);
    const q = Number(it?.cantidad || 0);
    return acc + (p * q);
  }, 0);
}
function calcularDescuento(subtotalDescuento, descuento) {
  if (!descuento || !Number.isFinite(Number(descuento.valor)) || Number(descuento.valor) <= 0) return 0;
  if (descuento.tipo === 'porcentaje') {
    const pct = Math.max(0, Math.min(100, Number(descuento.valor)));
    return Math.min(subtotalDescuento, subtotalDescuento * (pct / 100));
    }
  const monto = Math.max(0, Number(descuento.valor));
  return Math.min(subtotalDescuento, monto);
}
router.put('/:id/descuento', requireStaff, async (req, res) => {
  try {
    const { id } = req.params;
    const { tipo, valor, motivo = '' } = req.body || {};

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ msg: 'ID inválido' });
    }

    if (!['monto', 'porcentaje'].includes(tipo)) {
      return res.status(400).json({ msg: 'tipo debe ser "monto" o "porcentaje"' });
    }

    let v = Number(valor);
    if (!Number.isFinite(v) || v < 0) {
      return res.status(400).json({ msg: 'valor inválido' });
    }

    if (tipo === 'porcentaje' && v > 100) {
      v = 100;
    }

    const r = await Reserva.findById(id);
    if (!r) {
      return res.status(404).json({ msg: 'Reserva no encontrada' });
    }

    // ===== Guardar valor anterior antes del cambio =====
    const prevDesc = Number(r.precios?.descuento?.valor || 0);

    r.precios = r.precios || {};
    r.precios.descuento = {
      tipo,
      valor: v,
      motivo: String(motivo || '')
    };

    await r.save();

    // ===== Historial: eventos y cotizaciones =====
    if (prevDesc !== v) {
      const _uDesc = extraerUsuarioToken(req);
      await HistorialReserva.create({
        reservaId: r._id,
        tipo: 'descuento',
        accion: v > 0 ? 'discount_add' : 'discount_remove',
        descuentoAntes: prevDesc,
        descuentoDespues: v,
        usuario: _uDesc.id,
        usuarioEmail: _uDesc.email || '',
        usuarioRole: _uDesc.role || ''
      });
    }

    const subTotal = calcularSubTotal(r.utensilios);
    const descuento = calcularDescuento(calcSubtotalDescuentoFromUtensilios(r.utensilios), r.precios.descuento);
    const total = Math.max(0, subTotal - descuento);

    return res.json({
      ok: true,
      precios: r.precios,
      subTotal,
      descuento,
      total,
      moneda: r.precios?.moneda || 'MXN'
    });
  } catch (e) {
    console.error('PUT /reservas/:id/descuento error:', e);
    return res.status(500).json({ msg: 'Error interno' });
  }
});

router.get('/:id/totales', async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) return res.status(400).json({ msg: 'ID inválido' });
    const r = await Reserva.findById(id);
    if (!r) return res.status(404).json({ msg: 'Reserva no encontrada' });
    const subTotal = calcularSubTotal(r.utensilios);
    const descuento = calcularDescuento(calcSubtotalDescuentoFromUtensilios(r.utensilios), r.precios?.descuento);
    const total = Math.max(0, subTotal - descuento);
    return res.json({ subTotal, descuento, total, precios: r.precios || { moneda: 'MXN', descuento: { tipo: 'monto', valor: 0, motivo: '' } } });
  } catch (e) {
    console.error('GET /reservas/:id/totales error:', e);
    return res.status(500).json({ msg: 'Error interno' });
  }
});

// ===== Convertir cotización a evento =====
router.put('/:id/aceptar-cotizacion', requireStaff, async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ msg: 'ID inválido', debug: { id } });
    }

    const r = await Reserva.findById(id);
    if (!r) return res.status(404).json({ msg: 'Reserva no encontrada' });

    const tipo = String(r.tipoReserva ?? '').toLowerCase().trim();
    const esCotizacion =
      tipo === 'cotizacion' ||
      (!!r.cotizacion && r.cotizacion.aceptada !== true);

    if (!esCotizacion && tipo === 'evento') {
      return res.json({ ok: true, reserva: r, alreadyEvent: true });
    }

    if (!esCotizacion) {
      return res.status(400).json({
        msg: 'La reserva no es una cotización',
        debug: { tipoReserva: r.tipoReserva ?? null, cotizacion: r.cotizacion ?? null }
      });
    }

    const check = await validarDisponibilidadFecha({
      fecha: r.fecha,
      horaInicio: r.horaInicio,
      horaFin: r.horaFin,
      excluirId: r._id,
      adminPassword: req.body?.adminPassword
    });
    if (!check.ok) return res.status(check.status).json(check.body);

    r.tipoReserva = 'evento';
    r.cotizacion = {
      ...(r.cotizacion || {}),
      aceptada: true,
      aceptadaEn: new Date()
    };

    await r.save();

    const _uAcep = extraerUsuarioToken(req);
    await HistorialReserva.create({
      reservaId: r._id,
      tipo: 'conversion',
      accion: 'cotizacion_a_evento',
      usuario: _uAcep.id,
      usuarioEmail: _uAcep.email || '',
      usuarioRole: _uAcep.role || ''
    });

    // Esta cotización se acaba de convertir en evento confirmado; si para
    // lograrlo se forzó el candado de 24h de OTRA cotización (misma fecha),
    // esa otra pierde su prioridad de 24h (sigue viva, solo ya no bloquea).
    if (check.cotizacionesForzadas?.length) {
      await liberarHoldDeCotizaciones(check.cotizacionesForzadas, _uAcep);
    }

    return res.json({ ok: true, reserva: r });
  } catch (e) {
    if (esErrorDeHorarioDuplicado(e)) {
      return res.status(409).json({ msg: MOTIVO_HORARIO_DUPLICADO });
    }
    console.error('aceptar-cotizacion error:', e);
    return res.status(500).json({ msg: 'Error al convertir cotización' });
  }
});



// ===== Convertir EVENTO -> COTIZACIÓN =====
router.put('/:id/convertir-a-cotizacion', requireStaff, async (req, res) => {
  try {
    const { id } = req.params;
    const nota = (req.body?.nota ?? '').toString();

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ msg: 'ID inválido', debug: { id } });
    }

    const r = await Reserva.findById(id);
    if (!r) return res.status(404).json({ msg: 'Reserva no encontrada' });

    // Si ya es cotización, no hacemos nada costoso
    if (String(r.tipoReserva).toLowerCase() === 'cotizacion') {
      // (opcional) actualizar nota de cotización si la mandan
      if (nota) {
        r.cotizacion = { ...(r.cotizacion || {}), nota };
        await r.save();
      }
      return res.json({ ok: true, reserva: r, alreadyQuote: true });
    }

    // Cambiar a cotización y limpiar flags de aceptación
    r.tipoReserva = 'cotizacion';
    r.cotizacion = {
      ...(r.cotizacion || {}),
      aceptada: false,
      aceptadaEn: null,
      ...(nota ? { nota } : {})
    };

    await r.save();

    const _uConv = extraerUsuarioToken(req);
    await HistorialReserva.create({
      reservaId: r._id,
      tipo: 'conversion',
      accion: 'evento_a_cotizacion',
      usuario: _uConv.id,
      usuarioEmail: _uConv.email || '',
      usuarioRole: _uConv.role || ''
    });

    return res.json({ ok: true, reserva: r });
  } catch (e) {
    console.error('convertir-a-cotizacion error:', e);
    return res.status(500).json({ msg: 'Error al convertir a cotización' });
  }
});


// ===== Alias: PATCH /reservas/:id/precios =====
router.patch('/:id/precios', requireStaff, async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) return res.status(400).json({ msg: 'ID inválido' });

    const nuevoDesc = req.body?.descuento || {};
    const tipo = (nuevoDesc.tipo === 'porcentaje') ? 'porcentaje' : 'monto';
    let valor = Number(nuevoDesc.valor || 0);
    if (!Number.isFinite(valor) || valor < 0) return res.status(400).json({ msg: 'valor inválido' });
    if (tipo === 'porcentaje' && valor > 100) valor = 100;

    const r = await Reserva.findById(id);
    if (!r) return res.status(404).json({ msg: 'Reserva no encontrada' });

    // Desmarcar un producto que ya tenía el descuento aplicado requiere
    // confirmar con la contraseña de una cuenta admin, sin importar qué
    // usuario tenga la sesión iniciada. Se valida aquí en el backend para
    // que no se pueda saltar llamando la API directamente.
    const discountItems = req.body?.discountItems;
    if (quitaAlgunDescuento(r.utensilios, discountItems)) {
      const adminPassword = req.body?.adminPassword;
      if (!(await validarPasswordAdmin(adminPassword))) {
        return res.status(401).json({ msg: 'Se requiere la contraseña de un administrador para quitar el descuento' });
      }
    }

    r.precios = r.precios || { moneda: 'MXN' };
    const descAntes = Number(r.precios?.descuento?.valor || 0);
    const tipoAntes = r.precios?.descuento?.tipo || 'monto';
    r.precios.descuento = { tipo, valor, motivo: String(nuevoDesc.motivo || '') };

    {
      const _uMarcas = quienDe(req);
      if (discountItems && typeof discountItems === 'object') {
        for (const u of (r.utensilios || [])) {
          const ahora = !!discountItems[String(u.itemId || u._id)];
          if (!!u.aplicarDescuento !== ahora) {
            await registrarCambio(r._id, { tipo: 'descuento', accion: ahora ? 'discount_add' : 'discount_remove', etiqueta: `Descuento ${ahora ? 'aplicado a' : 'quitado de'} ${u.nombre}` }, _uMarcas);
          }
        }
      }
    }

    // Igual que PUT /:id/utensilios: persiste qué productos llevan el
    // descuento. Si no viene discountItems (llamada legada), se respetan
    // las banderas aplicarDescuento que ya estén guardadas.
    if (discountItems && typeof discountItems === 'object') {
      (r.utensilios || []).forEach((u) => {
        const key = String(u.itemId || u._id);
        u.aplicarDescuento = !!discountItems[key];
      });
    }

    const subTotal = (r.utensilios || []).reduce((a, u) => {
  return a + Number(u.precio || 0) * Number(u.cantidad || 0);
}, 0);

// ✅ SOLO productos marcados
const subtotalDescuento = (r.utensilios || []).reduce((a, u) => {

  if (!u.aplicarDescuento) return a;

  return a + Number(u.precio || 0) * Number(u.cantidad || 0);

}, 0);

const descuento = tipo === 'porcentaje'
  ? Math.min(
      subtotalDescuento,
      subtotalDescuento * (Math.max(0, Math.min(100, valor)) / 100)
    )
  : Math.min(subtotalDescuento, Math.max(0, valor));

const total = Math.max(0, subTotal - descuento);

    r.precios.subtotal = subTotal;
    r.precios.total = total;

    await r.save();
    if (descAntes !== valor || tipoAntes !== tipo) {
      await registrarCambio(r._id, { tipo: 'descuento', accion: valor > 0 ? 'discount_add' : 'discount_remove', etiqueta: `Descuento ${tipoAntes === 'porcentaje' ? descAntes + '%' : '$' + descAntes} → ${tipo === 'porcentaje' ? valor + '%' : '$' + valor}`, descuentoAntes: descAntes, descuentoDespues: valor }, quienDe(req));
    }
    return res.json({ ok: true, precios: r.precios, subTotal, descuento, total });
  } catch (e) {
    console.error('PATCH /reservas/:id/precios', e);
    return res.status(500).json({ msg: 'Error al guardar descuento' });
  }
});

/* ============================================================
   ACCESORIOS → SOLO RESUMEN (NO toca 'utensilios')
   ============================================================ */

// Normalizador de objetos de resumen
function normalizeResumenAccesorios(inArr = []) {
  const arr = Array.isArray(inArr) ? inArr : [];
  return arr
    .map(a => ({
      accesorioId: String(a.accesorioId || a._id || ''),
      nombre: String(a.nombre || ''),
      categoria: String(a.categoria || 'Accesorio'),
      unidad: String(a.unidad || 'pza'),
      cantidad: Number(a.cantidad || 0),
      precioReposicion: Number(a.precioReposicion || 0),
      descripcion: String(a.descripcion || ''),
      imagen: String(a.imagen || ''),
      esPrestamo: true
    }))
    .filter(a => a.accesorioId && a.cantidad > 0);
}

// GET: devolver resumen (array)
router.get('/:id/resumen-accesorios', async (req, res) => {
  try {
    const { id } = req.params;
    if (!isId(id)) return res.status(400).json({ ok: false, msg: 'ID de reserva inválido' });
    const r = await Reserva.findById(id).lean();
    if (!r) return res.status(404).json({ ok: false, msg: 'Reserva no encontrada' });
    const out = r?.resumenSeleccion?.accesorios || [];
    res.json(out);
  } catch (e) {
    console.error('GET /reservas/:id/resumen-accesorios', e);
    res.status(500).json({ ok: false, msg: 'Error al obtener resumen de accesorios' });
  }
});

// PUT: guardar resumen (array de objetos ya completos)
router.put('/:id/resumen-accesorios', soloEditaSusCotizaciones, async (req, res) => {
  try {
    const { id } = req.params;
    if (!isId(id)) return res.status(400).json({ ok: false, msg: 'ID de reserva inválido' });

    const reserva = await Reserva.findById(id);
    if (!reserva) return res.status(404).json({ ok: false, msg: 'Reserva no encontrada' });

    const accesorios = normalizeResumenAccesorios(req.body?.accesorios);
    reserva.resumenSeleccion = reserva.resumenSeleccion || {};
    reserva.resumenSeleccion.accesorios = accesorios;

    await reserva.save();
    await registrarCambio(reserva._id, { tipo: 'accesorios', accion: 'accessories_update', etiqueta: `Accesorios actualizados: ${accesorios.map(a => `${a.nombre} x${a.cantidad}`).join(', ') || 'ninguno'}` }, quienDe(req));
    res.json({ ok: true, resumenSeleccion: reserva.resumenSeleccion });
  } catch (e) {
    console.error('PUT /reservas/:id/resumen-accesorios', e);
    res.status(500).json({ ok: false, msg: 'Error al guardar resumen de accesorios' });
  }
});

// Alias legacy (compat): PUT /:id/resumen-seleccion  → guarda exactamente lo mismo
router.put('/:id/resumen-seleccion', soloEditaSusCotizaciones, async (req, res) => {
  try {
    const { id } = req.params;
    if (!isId(id)) return res.status(400).json({ ok: false, msg: 'ID de reserva inválido' });

    const reserva = await Reserva.findById(id);
    if (!reserva) return res.status(404).json({ ok: false, msg: 'Reserva no encontrada' });

    const accesorios = normalizeResumenAccesorios(req.body?.accesorios);
    reserva.resumenSeleccion = reserva.resumenSeleccion || {};
    reserva.resumenSeleccion.accesorios = accesorios;

    await reserva.save();
    res.json({ ok: true, resumenSeleccion: reserva.resumenSeleccion });
  } catch (e) {
    console.error('PUT /reservas/:id/resumen-seleccion', e);
    res.status(500).json({ ok: false, msg: 'Error al guardar resumen de accesorios' });
  }
});

/**
 * COMPATIBILIDAD: POST /reservas/:id/accesorios/apply
 * Recibe { seleccion: [{ accesorioId, cantidad }] } y guarda SOLO el resumen.
 * NO modifica la colección 'utensilios'.
 */
router.post('/:id/accesorios/apply', soloEditaSusCotizaciones, async (req, res) => {
  try {
    const { id } = req.params;
    if (!isId(id)) return res.status(400).json({ ok: false, msg: 'ID de reserva inválido' });

    const reserva = await Reserva.findById(id);
    if (!reserva) return res.status(404).json({ ok: false, msg: 'Reserva no encontrada' });

    const seleccion = Array.isArray(req.body?.seleccion) ? req.body.seleccion : [];
    if (seleccion.length === 0) {
      // no cambiamos nada; devolvemos el resumen actual
      return res.json({ ok: true, resumenSeleccion: reserva.resumenSeleccion || { accesorios: [] } });
    }

    // cargar accesorios para completar nombre, unidad, etc.
    const ids = seleccion.map(s => s?.accesorioId).filter(isId);
    const accs = ids.length
      ? await Accesorio.find({ _id: { $in: ids }, activo: { $ne: false } }).lean()
      : [];
    const byId = new Map(accs.map(a => [String(a._id), a]));
    const qtyById = new Map(seleccion.map(s => [String(s.accesorioId), Math.max(0, Number(s.cantidad || 0))]));

    const resumen = [];
    for (const idStr of ids.map(String)) {
      const qty = qtyById.get(idStr) || 0;
      const acc = byId.get(idStr);
      if (!acc || qty <= 0) continue;

      resumen.push({
        accesorioId: idStr,
        nombre: acc.nombre,
        categoria: acc.categoria || 'Accesorio',
        unidad: acc.unidad || 'pza',
        cantidad: qty,
        precioReposicion: Number(acc.precioReposicion || 0),
        descripcion: acc.descripcion || '',
        imagen: acc.imagen || '',
        esPrestamo: true
      });
    }

    reserva.resumenSeleccion = reserva.resumenSeleccion || {};
    reserva.resumenSeleccion.accesorios = resumen;

    await reserva.save();
    res.json({ ok: true, resumenSeleccion: reserva.resumenSeleccion });
  } catch (e) {
    console.error('POST /reservas/:id/accesorios/apply', e);
    res.status(500).json({ ok: false, msg: 'Error al aplicar accesorios (resumen)' });
  }
});

module.exports = router;
