const bcrypt = require('bcryptjs');
const nodemailer = require('nodemailer');
const Usuario = require('../models/Usuario');
const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Reserva = require('../models/Reservas');
const Producto = require('../models/Producto');
const { streamReservaPDF } = require('../services/reservaPdf');
const jwt = require('jsonwebtoken');
const TZ = process.env.APP_TIMEZONE || 'America/Ciudad_Juarez';

const JWT_SECRET = process.env.JWT_SECRET || 'secreto-temporal';

// ===== Auth muy simple (usa el tuyo si ya tienes uno) =====
function auth(req, res, next) {
  const h = req.headers.authorization || '';
  const t = h.startsWith('Bearer ') ? h.slice(7) : null;
  if (!t) return res.status(401).json({ ok: false, msg: 'No token' });
  try {
    req.user = jwt.verify(t, JWT_SECRET); // { sub, email, role }
    next();
  } catch {
    return res.status(401).json({ ok: false, msg: 'Token inválido' });
  }
}

// ===== Helpers de totales =====
function calcSubtotalFromUtensilios(utensilios = []) {
  return (utensilios || []).reduce((acc, u) => {
    const p = Number(u?.precio ?? 0);
    const c = Number(u?.cantidad ?? 0);
    return acc + (Number.isFinite(p) && Number.isFinite(c) ? p * c : 0);
  }, 0);
}
function applyDiscount(subtotal, desc = { tipo: 'monto', valor: 0 }) {
  let monto = 0;
  const tipo  = desc?.tipo === 'porcentaje' ? 'porcentaje' : 'monto';
  const valor = Number(desc?.valor || 0);
  if (tipo === 'porcentaje') {
    const pct = Math.max(0, Math.min(100, valor));
    monto = subtotal * (pct / 100);
  } else {
    monto = Math.max(0, valor);
  }
  monto = Math.min(monto, subtotal);
  return { subtotal, descuento: { tipo, valor, monto }, total: Math.max(0, subtotal - monto) };
}

// ===== Helpers de fecha/horario =====
function normalizeFechaNoonUTC(input) {
  if (!input) return null;
  let ymd;
  if (typeof input === 'string') ymd = input.slice(0, 10);
  else ymd = new Date(input).toISOString().slice(0, 10);
  return new Date(`${ymd}T12:00:00Z`);
}
function timeToMinutes(t) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(t || '').trim());
  if (!m) return NaN;
  const h = Number(m[1]), mi = Number(m[2]);
  if (!Number.isFinite(h) || !Number.isFinite(mi)) return NaN;
  return h * 60 + mi;
}
function overlap(s1, e1, s2, e2) {
  if ([s1, e1, s2, e2].some(x => !Number.isFinite(x))) return false;
  return Math.max(s1, s2) < Math.min(e1, e2);
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

// ===== Mailer =====
const transporter = nodemailer.createTransport({
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

    const emailResult = await ensureUserAndMaybeSendPassword({ email: correo, fullname: cliente });
    return res.status(201).json({ msg: 'Reserva creada', reserva: nueva, userNotice: emailResult });
  } catch (e) {
    console.error('Error en /reservas/public:', e);
    return res.status(500).json({ msg: 'Error del servidor' });
  }
});

// ===== Disponibilidad general (EVENTOS y COTIZACIONES, uso genérico) =====
async function checarDisponibilidad({ fecha, horaInicio, horaFin, excluirId = null }) {
  const fechaStr = ymd(fecha);
  if (!fechaStr || !horaInicio || !horaFin) return { disponible: false, motivo: 'Datos incompletos' };
  const ini = timeToMinutes(horaInicio);
  const fin = timeToMinutes(horaFin);
  const delDia = await Reserva.find(sameDayFilter(fechaStr, excluirId)).lean();
  const choca = delDia.some(r => overlap(ini, fin, timeToMinutes(r.horaInicio), timeToMinutes(r.horaFin)));
  return choca ? { disponible: false, motivo: 'Empalme con otra reserva' } : { disponible: true };
}

// ===== CRUD =====
router.post('/', async (req, res) => {
  try {
    const tipoReserva = req.body.tipoReserva || 'evento';
    req.body.fecha = normalizeFechaNoonUTC(req.body.fecha);
    if (!req.body.fecha || isNaN(req.body.fecha)) return res.status(400).json({ msg: 'Fecha inválida' });

    if (tipoReserva === 'evento') {
      const disp = await checarDisponibilidad(req.body);
      if (!disp.disponible) return res.status(409).json({ msg: disp.motivo });
    }
    const guardada = await new Reserva({ ...req.body, tipoReserva }).save();
    return res.status(201).json({ ok: true, id: guardada._id, reserva: guardada });
  } catch (e) {
    console.error('Error al guardar la reserva:', e);
    return res.status(500).json({ msg: 'Error del servidor' });
  }
});

router.get('/', async (req, res) => {
  try {
    const { correo } = req.query;
    const tipo = req.query.tipo || req.query.tipoReserva;
    const pipeline = [];
    if (correo) pipeline.push({ $match: { correo: correo.toLowerCase().trim() } });
    if (tipo === 'evento' || tipo === 'cotizacion') pipeline.push({ $match: { tipoReserva: tipo } });
    pipeline.push(
      { $addFields: { fechaLocal: { $dateToString: { date: "$fecha", format: "%Y-%m-%d", timezone: TZ } } } },
      { $sort: { fecha: 1, horaInicio: 1 } }
    );
    const reservas = await Reserva.aggregate(pipeline);
    return res.json(reservas);
  } catch (e) {
    console.error('Error al obtener reservas:', e);
    return res.status(500).json({ msg: 'Error del servidor' });
  }
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

router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) return res.status(400).json({ msg: 'ID inválido' });

    const prev = await Reserva.findById(id);
    if (!prev) return res.status(404).json({ msg: 'Reserva no encontrada' });

    req.body.fecha = normalizeFechaNoonUTC(req.body.fecha);
    if (!req.body.fecha || isNaN(req.body.fecha)) return res.status(400).json({ msg: 'Fecha inválida' });

    const nextTipo = req.body.tipoReserva || prev.tipoReserva || 'evento';
    if (nextTipo === 'evento') {
      const disp = await checarDisponibilidad({ ...req.body, excluirId: id });
      if (!disp.disponible) return res.status(409).json({ msg: disp.motivo });
    }
    const actualizada = await Reserva.findByIdAndUpdate(id, { ...req.body, tipoReserva: nextTipo }, { new: true, runValidators: true });
    if (!actualizada) return res.status(404).json({ msg: 'Reserva no encontrada' });
    return res.json(actualizada);
  } catch (e) {
    console.error('Error al actualizar:', e);
    return res.status(500).json({ msg: 'Error del servidor' });
  }
});

router.delete('/:id', async (req, res) => {
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
router.put('/:id/utensilios', async (req, res) => {
  try {
    const { id } = req.params;
    const { items = [] } = req.body;
    if (!mongoose.isValidObjectId(id)) return res.status(400).json({ msg: 'ID inválido' });
    if (!Array.isArray(items)) return res.status(400).json({ msg: 'items debe ser un arreglo' });

    const reservaActual = await Reserva.findById(id).lean();
    if (!reservaActual) return res.status(404).json({ msg: 'Reserva no encontrada' });

    const prevById = new Map((reservaActual.utensilios || []).map(u => [String(u.itemId || u._id || u.id), u]));

    const saneados = [];
    const idsParaPrecio = [];
    for (const it of items) {
      const itemId = it.itemId || it.id || it._id;
      const cantidad = Number(it.cantidad ?? it.qty ?? 0);
      if (!it.nombre || !Number.isFinite(cantidad) || cantidad < 0) {
        return res.status(400).json({ msg: 'Ítem inválido' });
      }
      let castId = null;
      if (itemId) {
        if (!mongoose.isValidObjectId(itemId)) return res.status(400).json({ msg: 'itemId inválido' });
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
      const prods = await Producto.find({ _id: { $in: idsParaPrecio } }).select('precio descripcion').lean();
      invById = new Map(prods.map(p => [String(p._id), { precio: Number(p.precio ?? 0), descripcion: p.descripcion || '' }]));
    }

    const snapshot = saneados.map(s => {
      const key = s.itemId ? String(s.itemId) : null;
      const prev = key && prevById.get(key);
      const prevPrice = prev ? Number(prev.precio) : undefined;
      const prevDesc  = prev ? (prev.descripcion || '') : '';
      const inv = key && invById.get(key);
      const invPrice = inv ? inv.precio : undefined;
      const invDesc  = inv ? inv.descripcion : '';
      const finalPrice =
        Number.isFinite(Number(s._precioInput)) ? Number(s._precioInput)
        : (Number.isFinite(prevPrice) && prevPrice > 0) ? prevPrice
        : (Number.isFinite(invPrice) && invPrice > 0) ? invPrice
        : 0;
      const hasInputDesc = s._descInput != null && String(s._descInput).trim() !== '';
      const finalDesc = hasInputDesc ? String(s._descInput) : (prevDesc || invDesc || '');
      const { _precioInput, _descInput, ...rest } = s;
      return { ...rest, precio: finalPrice, descripcion: finalDesc };
    });

    const updated = await Reserva.findByIdAndUpdate(id, { $set: { utensilios: snapshot } }, { new: true });
    const subtotal = calcSubtotalFromUtensilios(updated.utensilios || []);
    const precios  = applyDiscount(subtotal, updated.precios?.descuento || { tipo:'monto', valor:0 });
    updated.precios = precios;
    await updated.save();

    return res.json({ ok: true, reserva: updated });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ msg: 'Error interno' });
  }
});

router.patch('/:id/utensilios/:lineId', async (req, res) => {
  try {
    const { id, lineId } = req.params;
    if (!mongoose.isValidObjectId(id) || !mongoose.isValidObjectId(lineId)) {
      return res.status(400).json({ msg: 'ID inválido' });
    }
    const set = {};
    if (req.body.cantidad != null) set['utensilios.$.cantidad'] = Number(req.body.cantidad);
    if (req.body.precio   != null) set['utensilios.$.precio']   = Number(req.body.precio);
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

router.patch('/:id/utensilios/:itemId/precio', async (req, res) => {
  try {
    const { id, itemId } = req.params;
    if (!mongoose.isValidObjectId(id) || !mongoose.isValidObjectId(itemId)) {
      return res.status(400).json({ msg: 'ID inválido' });
    }
    const p = Number((req.body && req.body.precio) ?? req.query.precio);
    if (!Number.isFinite(p) || p < 0) return res.status(400).json({ msg: 'Precio inválido' });

    const updated = await Reserva.findOneAndUpdate(
      { _id: id, 'utensilios.itemId': itemId },
      { $set: { 'utensilios.$.precio': p } },
      { new: true }
    ).lean();
    if (updated) return res.json({ ok: true, utensilios: updated.utensilios });

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

// ===== Descuento y totales =====
function calcularSubTotal(utensilios = []) {
  return (utensilios || []).reduce((acc, it) => {
    const p = Number(it?.precio || 0);
    const q = Number(it?.cantidad || 0);
    return acc + (p * q);
  }, 0);
}
function calcularDescuento(subTotal, descuento) {
  if (!descuento || !Number.isFinite(Number(descuento.valor)) || Number(descuento.valor) <= 0) return 0;
  if (descuento.tipo === 'porcentaje') {
    const pct = Math.max(0, Math.min(100, Number(descuento.valor)));
    return Math.min(subTotal, subTotal * (pct / 100));
    }
  const monto = Math.max(0, Number(descuento.valor));
  return Math.min(subTotal, monto);
}
router.put('/:id/descuento', async (req, res) => {
  try {
    const { id } = req.params;
    const { tipo, valor, motivo = '' } = req.body || {};
    if (!mongoose.isValidObjectId(id)) return res.status(400).json({ msg: 'ID inválido' });
    if (!['monto', 'porcentaje'].includes(tipo)) return res.status(400).json({ msg: 'tipo debe ser "monto" o "porcentaje"' });

    let v = Number(valor);
    if (!Number.isFinite(v) || v < 0) return res.status(400).json({ msg: 'valor inválido' });
    if (tipo === 'porcentaje' && v > 100) v = 100;

    const r = await Reserva.findById(id);
    if (!r) return res.status(404).json({ msg: 'Reserva no encontrada' });

    r.precios = r.precios || {};
    r.precios.descuento = { tipo, valor: v, motivo: String(motivo || '') };
    await r.save();

    const subTotal = calcularSubTotal(r.utensilios);
    const descuento = calcularDescuento(subTotal, r.precios.descuento);
    const total = Math.max(0, subTotal - descuento);

    return res.json({ ok: true, precios: r.precios, subTotal, descuento, total, moneda: r.precios?.moneda || 'MXN' });
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
    const descuento = calcularDescuento(subTotal, r.precios?.descuento);
    const total = Math.max(0, subTotal - descuento);
    return res.json({ subTotal, descuento, total, precios: r.precios || { moneda: 'MXN', descuento: { tipo: 'monto', valor: 0, motivo: '' } } });
  } catch (e) {
    console.error('GET /reservas/:id/totales error:', e);
    return res.status(500).json({ msg: 'Error interno' });
  }
});

// ===== Convertir cotización a evento =====
router.put('/:id/aceptar-cotizacion', async (req, res) => {
  try {
    const { id } = req.params;

    // 1) ID válido
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ msg: 'ID inválido', debug: { id } });
    }

    // 2) Cargar reserva
    const r = await Reserva.findById(id);
    if (!r) return res.status(404).json({ msg: 'Reserva no encontrada' });

    // 3) Determinar si es cotización (soporte a docs viejos/sin campo)
    const tipo = String(r.tipoReserva ?? '').toLowerCase().trim();
    const esCotizacion =
      tipo === 'cotizacion' ||
      (!!r.cotizacion && r.cotizacion.aceptada !== true);

    // Si ya es evento, no rompas: devuelve OK idempotente
    if (!esCotizacion && tipo === 'evento') {
      return res.json({ ok: true, reserva: r, alreadyEvent: true });
    }

    if (!esCotizacion) {
      return res.status(400).json({
        msg: 'La reserva no es una cotización',
        debug: { tipoReserva: r.tipoReserva ?? null, cotizacion: r.cotizacion ?? null }
      });
    }

    // 4) Revalidar disponibilidad SOLO contra EVENTOS (o docs sin tipoReserva)
    const fechaStr = ymd(r.fecha) || ymd(new Date());
    const ini = timeToMinutes(r.horaInicio);
    let fin = timeToMinutes(r.horaFin);

    // Fallbacks de horas por si vienen vacías o mal formateadas
    const iniOK = Number.isFinite(ini) ? ini : 9 * 60;     // 09:00
    const finOK = Number.isFinite(fin) ? fin : iniOK + 60; // +1h

    const delDia = await Reserva.find({
      ...sameDayFilter(fechaStr),
      _id: { $ne: r._id },
      $or: [
        { tipoReserva: 'evento' },
        { tipoReserva: { $exists: false } },
        { tipoReserva: null }
      ]
    }).lean();

    const choca = delDia.some(x =>
      overlap(
        iniOK,
        finOK,
        timeToMinutes(x.horaInicio),
        timeToMinutes(x.horaFin)
      )
    );

    if (choca) {
      return res.status(409).json({
        msg: 'Empalme con otro evento',
        debug: { fecha: fechaStr, horaInicio: r.horaInicio, horaFin: r.horaFin }
      });
    }

    // 5) Convertir
    r.tipoReserva = 'evento';
    r.cotizacion = {
      ...(r.cotizacion || {}),
      aceptada: true,
      aceptadaEn: new Date()
    };

    await r.save();
    return res.json({ ok: true, reserva: r });
  } catch (e) {
    console.error('aceptar-cotizacion error:', e);
    return res.status(500).json({ msg: 'Error al convertir cotización' });
  }
});


// Alias: PATCH /reservas/:id/precios  → guarda descuento igual que /:id/descuento
router.patch('/:id/precios', async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) return res.status(400).json({ msg: 'ID inválido' });

    // Espera { descuento: { tipo, valor, motivo? } }
    const nuevoDesc = req.body?.descuento || {};
    const tipo = (nuevoDesc.tipo === 'porcentaje') ? 'porcentaje' : 'monto';
    let valor = Number(nuevoDesc.valor || 0);
    if (!Number.isFinite(valor) || valor < 0) return res.status(400).json({ msg: 'valor inválido' });
    if (tipo === 'porcentaje' && valor > 100) valor = 100;

    const r = await Reserva.findById(id);
    if (!r) return res.status(404).json({ msg: 'Reserva no encontrada' });

    r.precios = r.precios || { moneda: 'MXN' };
    r.precios.descuento = { tipo, valor, motivo: String(nuevoDesc.motivo || '') };

    const subTotal = (r.utensilios || []).reduce((a,u)=>a + Number(u.precio||0)*Number(u.cantidad||0), 0);
    const descuento = tipo === 'porcentaje'
      ? Math.min(subTotal, subTotal * (Math.max(0, Math.min(100, valor)) / 100))
      : Math.min(subTotal, Math.max(0, valor));
    const total = Math.max(0, subTotal - descuento);

    // si quieres mantener todo en precios:
    r.precios.subtotal = subTotal;
    r.precios.total = total;

    await r.save();
    return res.json({ ok: true, precios: r.precios, subTotal, descuento, total });
  } catch (e) {
    console.error('PATCH /reservas/:id/precios', e);
    return res.status(500).json({ msg: 'Error al guardar descuento' });
  }
});

module.exports = router;
