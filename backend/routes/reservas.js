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

// ===== Helpers de fecha/horario =====
function normalizeFechaNoonUTC(input) {
  if (!input) return null;
  let ymd;
  if (typeof input === 'string') ymd = input.slice(0, 10);
  else ymd = new Date(input).toISOString().slice(0, 10);
  return new Date(`${ymd}T12:00:00Z`);
}
function timeToMinutes(t) {
  const [h, m] = String(t || '').split(':').map(Number);
  return h * 60 + m;
}
function overlap(s1, e1, s2, e2) {
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

// ===== Mailer para contraseñas temporales =====
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT || 587),
  secure: false, // true si usas 465
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
    user = await Usuario.create({
      fullname: fullname || 'Cliente',
      email: correo,
      role: 'user',
      password: hash,
    });

    const loginUrl = `${process.env.FRONTEND_BASE_URL || 'http://localhost:3000'}/login`;
    await transporter.sendMail({
      from: process.env.FROM_EMAIL,
      to: correo,
      subject: 'Tu acceso a Nardeli',
      html: `
        <p>Hola ${fullname || 'cliente'},</p>
        <p>Tu reserva se registró correctamente. Aquí tienes tu acceso:</p>
        <ul>
          <li><b>Correo:</b> ${correo}</li>
          <li><b>Contraseña temporal:</b> ${plain}</li>
        </ul>
        <p>Puedes iniciar sesión aquí: <a href="${loginUrl}">${loginUrl}</a></p>
        <p>Por seguridad, cambia tu contraseña al ingresar.</p>
        <br/>
        <small>Si no solicitaste este acceso, ignora este correo.</small>
      `,
    });

    return { created: true, sentPassword: true };
  }

  if (!user.password) {
    const plain = genPassword(10);
    const hash = await bcrypt.hash(plain, 10);
    user.password = hash;
    await user.save();

    const loginUrl = `${process.env.FRONTEND_BASE_URL || 'http://localhost:3000'}/login`;
    await transporter.sendMail({
      from: process.env.FROM_EMAIL,
      to: correo,
      subject: 'Tu acceso a Nardeli',
      html: `
        <p>Hola ${user.fullname || 'cliente'},</p>
        <p>Actualizamos tu acceso. Contraseña temporal:</p>
        <ul>
          <li><b>Correo:</b> ${correo}</li>
          <li><b>Contraseña temporal:</b> ${plain}</li>
        </ul>
        <p>Inicia sesión aquí: <a href="${loginUrl}">${loginUrl}</a></p>
      `,
    });

    return { created: false, sentPassword: true };
  }

  return { created: false, sentPassword: false };
}

// ====== Rutas públicas ======

// POST /reservas/public (crea y envía contraseña si aplica)
router.post('/public', async (req, res) => {
  try {
    const {
      cliente,
      correo,
      tipoEvento,
      fecha,
      horaInicio,
      horaFin,
      telefono,
      cantidadPersonas,
      descripcion = ''
    } = req.body || {};

    if (!cliente || !correo || !tipoEvento || !fecha || !horaInicio || !horaFin || !telefono || !cantidadPersonas) {
      return res.status(400).json({ msg: 'Faltan campos obligatorios' });
    }

    const fechaNorm = normalizeFechaNoonUTC(fecha);
    if (!fechaNorm || isNaN(fechaNorm)) {
      return res.status(400).json({ msg: 'Fecha inválida' });
    }

    const disp = await checarDisponibilidad({ fecha: fechaNorm, horaInicio, horaFin });
    if (!disp.disponible) return res.status(409).json({ msg: disp.motivo });

    const nueva = await new Reserva({
      cliente,
      correo: correo.toLowerCase().trim(),
      tipoEvento,
      fecha: fechaNorm,
      horaInicio,
      horaFin,
      telefono,
      cantidadPersonas,
      descripcion
    }).save();

    const emailResult = await ensureUserAndMaybeSendPassword({
      email: correo,
      fullname: cliente
    });

    return res.status(201).json({
      msg: 'Reserva creada',
      reserva: nueva,
      userNotice: emailResult
    });
  } catch (e) {
    console.error('Error en /reservas/public:', e);
    return res.status(500).json({ msg: 'Error del servidor' });
  }
});

// ===== Lógica de disponibilidad =====
async function checarDisponibilidad({ fecha, horaInicio, horaFin, excluirId = null }) {
  const fechaStr = ymd(fecha);
  if (!fechaStr || !horaInicio || !horaFin) return { disponible: false, motivo: 'Datos incompletos' };

  const ini = timeToMinutes(horaInicio);
  const fin = timeToMinutes(horaFin);
  if (isNaN(ini) || isNaN(fin) || fin <= ini) return { disponible: false, motivo: 'Rango de horas inválido' };

  const delDia = await Reserva.find(sameDayFilter(fechaStr, excluirId)).lean();
  const choca = delDia.some(r => overlap(ini, fin, timeToMinutes(r.horaInicio), timeToMinutes(r.horaFin)));
  return choca ? { disponible: false, motivo: 'Empalme con otra reserva' } : { disponible: true };
}

// ===== CRUD de reservas =====

// Crear
router.post('/', async (req, res) => {
  try {
    req.body.fecha = normalizeFechaNoonUTC(req.body.fecha);
    if (!req.body.fecha || isNaN(req.body.fecha)) {
      return res.status(400).json({ msg: 'Fecha inválida' });
    }
    const disp = await checarDisponibilidad(req.body);
    if (!disp.disponible) return res.status(409).json({ msg: disp.motivo });

    const guardada = await new Reserva(req.body).save();

    return res.status(201).json({
      ok: true,
      id: guardada._id,
      reserva: guardada
    });
  } catch (e) {
    console.error('Error al guardar la reserva:', e);
    return res.status(500).json({ msg: 'Error del servidor' });
  }
});

// Listar (con fechaLocal) + filtro opcional por correo
router.get('/', async (req, res) => {
  try {
    const { correo } = req.query;
    const pipeline = [];

    if (correo) {
      pipeline.push({ $match: { correo: correo.toLowerCase().trim() } });
    }

    pipeline.push(
      {
        $addFields: {
          fechaLocal: {
            $dateToString: { date: "$fecha", format: "%Y-%m-%d", timezone: TZ }
          }
        }
      },
      { $sort: { fecha: 1, horaInicio: 1 } }
    );

    const reservas = await Reserva.aggregate(pipeline);
    return res.json(reservas);
  } catch (e) {
    console.error('Error al obtener reservas:', e);
    return res.status(500).json({ msg: 'Error del servidor' });
  }
});

// Ver disponibilidad sin crear
router.post('/disponibilidad', async (req, res) => {
  try {
    const resp = await checarDisponibilidad(req.body);
    return res.json(resp);
  } catch (e) {
    console.error(e);
    return res.status(500).json({ msg: 'Error del servidor' });
  }
});

// Actualizar
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ msg: 'ID inválido' });
    }
    req.body.fecha = normalizeFechaNoonUTC(req.body.fecha);
    if (!req.body.fecha || isNaN(req.body.fecha)) {
      return res.status(400).json({ msg: 'Fecha inválida' });
    }

    const disp = await checarDisponibilidad({ ...req.body, excluirId: id });
    if (!disp.disponible) return res.status(409).json({ msg: disp.motivo });

    const actualizada = await Reserva.findByIdAndUpdate(id, req.body, { new: true, runValidators: true });
    if (!actualizada) return res.status(404).json({ msg: 'Reserva no encontrada' });

    return res.json(actualizada);
  } catch (e) {
    console.error('Error al actualizar:', e);
    return res.status(500).json({ msg: 'Error del servidor' });
  }
});

// Eliminar
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ msg: 'ID inválido' });
    }
    const out = await Reserva.findByIdAndDelete(id);
    if (!out) return res.status(404).json({ msg: 'Reserva no encontrada' });
    return res.json({ msg: 'Reserva eliminada' });
  } catch (e) {
    console.error('Error al eliminar:', e);
    return res.status(500).json({ msg: 'Error del servidor' });
  }
});

// Ver una reserva por id (debug)
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

// ===== Utensilios (selección del cliente) =====

// PUT /reservas/:id/utensilios  (reemplaza snapshot)
router.put('/:id/utensilios', async (req, res) => {
  try {
    const { id } = req.params;
    const { items = [] } = req.body;

    if (!mongoose.isValidObjectId(id)) return res.status(400).json({ msg: 'ID inválido' });
    if (!Array.isArray(items)) return res.status(400).json({ msg: 'items debe ser un arreglo' });

    // 1) reserva actual para preservar datos (precio/descripcion, etc)
    const reservaActual = await Reserva.findById(id).lean();
    if (!reservaActual) return res.status(404).json({ msg: 'Reserva no encontrada' });

    const prevById = new Map(
      (reservaActual.utensilios || []).map(u => [String(u.itemId || u._id || u.id), u])
    );

    // 2) saneo de entrada + recolectar ids para consultar inventario
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
        _precioInput: it.precio,          // temporal para decidir prioridad
        _descInput: it.descripcion         // ⬅️ NUEVO: descripción enviada desde el front (si vino)
      });
    }

    // 3) consulta inventario: precio + descripcion
    let invById = new Map();
    if (idsParaPrecio.length) {
      const prods = await Producto.find({ _id: { $in: idsParaPrecio } })
        .select('precio descripcion')
        .lean();

      invById = new Map(
        prods.map(p => [
          String(p._id),
          { precio: Number(p.precio ?? 0), descripcion: p.descripcion || '' }
        ])
      );
    }

    // 4) decidir precio/descripcion final por prioridad
    const snapshot = saneados.map(s => {
      const key = s.itemId ? String(s.itemId) : null;

      const prev = key && prevById.get(key);
      const prevPrice = prev ? Number(prev.precio) : undefined;
      const prevDesc  = prev ? (prev.descripcion || '') : '';

      const inv = key && invById.get(key);
      const invPrice = inv ? inv.precio : undefined;
      const invDesc  = inv ? inv.descripcion : '';

      const hasInputPrice = s._precioInput !== undefined && s._precioInput !== null && s._precioInput !== '';
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

    // 5) guardar snapshot
    const updated = await Reserva.findByIdAndUpdate(
      id,
      { $set: { utensilios: snapshot } },
      { new: true }
    );

    return res.json({ ok: true, reserva: updated });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ msg: 'Error interno' });
  }
});

// PATCH /reservas/:id/utensilios/:lineId  (editar campos de una línea)
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
    if (req.body.descripcion != null) set['utensilios.$.descripcion'] = String(req.body.descripcion); // ⬅️ NUEVO

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

// GET /reservas/:id/utensilios
router.get('/:id/utensilios', async (req, res) => {
  const { id } = req.params;
  if (!mongoose.isValidObjectId(id)) return res.status(400).json({ msg: 'ID inválido' });
  const r = await Reserva.findById(id).select('utensilios').lean();
  if (!r) return res.status(404).json({ msg: 'Reserva no encontrada' });
  res.json(r.utensilios || []);
});

// PATCH /reservas/:id/utensilios/:itemId/precio  (upsert si no existe)
router.patch('/:id/utensilios/:itemId/precio', async (req, res) => {
  try {
    const { id, itemId } = req.params;

    if (!mongoose.isValidObjectId(id) || !mongoose.isValidObjectId(itemId)) {
      return res.status(400).json({ msg: 'ID inválido' });
    }

    const precioRaw = (req.body && req.body.precio) ?? req.query.precio;
    const p = Number(precioRaw);
    if (!Number.isFinite(p) || p < 0) {
      return res.status(400).json({ msg: 'Precio inválido' });
    }

    const updated = await Reserva.findOneAndUpdate(
      { _id: id, 'utensilios.itemId': itemId },
      { $set: { 'utensilios.$.precio': p } },
      { new: true }
    ).lean();

    if (updated) {
      return res.json({ ok: true, utensilios: updated.utensilios });
    }

    // upsert: crear línea con info del producto (incluye descripcion)
    const prod = await Producto.findById(itemId)
      .select('nombre categoria unidad imagen descripcion')
      .lean();

    const nuevaLinea = {
      itemId: new mongoose.Types.ObjectId(itemId),
      nombre: prod?.nombre || 'Ítem',
      categoria: (prod?.categoria || 'general').toLowerCase(),
      unidad: prod?.unidad || 'pza',
      cantidad: 0,
      precio: p,
      descripcion: prod?.descripcion || '',    // ⬅️ NUEVO
      ...(prod?.imagen ? { imagen: prod.imagen } : {})
    };

    const afterPush = await Reserva.findByIdAndUpdate(
      id,
      { $push: { utensilios: nuevaLinea } },
      { new: true }
    ).lean();

    if (!afterPush) return res.status(404).json({ msg: 'Reserva no encontrada' });
    return res.json({ ok: true, utensilios: afterPush.utensilios });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ msg: 'Error interno' });
  }
});

// GET /reservas/:id/pdf
router.get('/:id/pdf', async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ msg: 'ID inválido' });
    }

    const reserva = await Reserva.findById(id).lean();
    if (!reserva) {
      return res.status(404).json({ msg: 'Reserva no encontrada' });
    }

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

// ===== Reserva activa (borrador) del cliente autenticado =====
// OJO: si montas este router en /reservas, la ruta final es /reservas/activa
router.get('/reservas/activa', auth, async (req, res) => {
  try {
    const clienteId = req.user.sub;
    let r = await Reserva.findOne({ clienteId, estado: 'borrador' });
    if (!r) {
      r = await Reserva.create({
        clienteId,
        estado: 'borrador',
        createdAt: new Date(),
      });
    }
    res.json({ ok: true, reservaId: String(r._id) });
  } catch (e) {
    console.error('reservas/activa error:', e);
    res.status(500).json({ ok: false, msg: 'No se pudo obtener la reserva activa' });
  }
});

module.exports = router;
