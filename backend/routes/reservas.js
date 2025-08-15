const bcrypt = require('bcryptjs');
const nodemailer = require('nodemailer');
const Usuario = require('../models/Usuario');
const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Reserva = require('../models/Reservas');
const Producto = require('../models/Producto'); // asegúrate que está importado
const { streamReservaPDF } = require('../services/reservaPdf');

const TZ = process.env.APP_TIMEZONE || 'America/Ciudad_Juarez';

// Convierte "YYYY-MM-DD" (o cualquier input) a Date en 12:00:00 Z
function normalizeFechaNoonUTC(input) {
  if (!input) return null;
  let ymd;
  if (typeof input === 'string') ymd = input.slice(0, 10);
  else ymd = new Date(input).toISOString().slice(0, 10);
  return new Date(`${ymd}T12:00:00Z`);
}

// --- helpers de fecha/horario ---
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
// Filtro “reservas del mismo día LOCAL”
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

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT || 587),
  secure: false, // true si usas 465
  auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
});

// genera una contraseña aleatoria simple (ajusta política si quieres)
function genPassword(len = 10) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789@$!%*?&';
  return Array.from({ length: len }, () => chars[Math.floor(Math.random()*chars.length)]).join('');
}

async function ensureUserAndMaybeSendPassword({ email, fullname }) {
  const correo = email.toLowerCase().trim();
  let user = await Usuario.findOne({ email: correo });

  if (!user) {
    // crear usuario con rol user y password random
    const plain = genPassword(10);
    const hash = await bcrypt.hash(plain, 10);
    user = await Usuario.create({
      fullname: fullname || 'Cliente',
      email: correo,
      role: 'user',
      password: hash,
    });

    // enviar contraseña
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

  // usuario existe
  if (!user.password) {
    // tenía cuenta sin password: asignar una
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

  // ya tiene password; no reenviamos la contraseña (opcional: notificar)
  return { created: false, sentPassword: false };
}

// Crear reserva pública y enviar contraseña al cliente
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

    // Validación básica
    if (!cliente || !correo || !tipoEvento || !fecha || !horaInicio || !horaFin || !telefono || !cantidadPersonas) {
      return res.status(400).json({ msg: 'Faltan campos obligatorios' });
    }

    // Normalizar fecha y checar disponibilidad
    const fechaNorm = normalizeFechaNoonUTC(fecha);
    if (!fechaNorm || isNaN(fechaNorm)) {
      return res.status(400).json({ msg: 'Fecha inválida' });
    }

    const disp = await checarDisponibilidad({ fecha: fechaNorm, horaInicio, horaFin });
    if (!disp.disponible) return res.status(409).json({ msg: disp.motivo });

    // Guardar reserva
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

    // Asegurar usuario y enviar contraseña si aplica
    const emailResult = await ensureUserAndMaybeSendPassword({
      email: correo,
      fullname: cliente
    });

    return res.status(201).json({
      msg: 'Reserva creada',
      reserva: nueva,
      userNotice: emailResult // {created, sentPassword}
    });
  } catch (e) {
    console.error('Error en /reservas/public:', e);
    return res.status(500).json({ msg: 'Error del servidor' });
  }
});


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

// Crear
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

    // 👇 respuesta estandarizada: trae id y la reserva
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


// Listar (con fechaLocal) y filtro opcional por correo
router.get('/', async (req, res) => {
  try {
    const { correo } = req.query;   // ?correo=cliente@dominio.com
    const pipeline = [];

    if (correo) {
      pipeline.push({
        $match: { correo: correo.toLowerCase().trim() }
      });
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

// Ver una reserva por id (para depurar)
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


router.put('/:id/utensilios', async (req, res) => {
  try {
    const { id } = req.params;
    const { items = [] } = req.body;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ msg: 'ID inválido' });
    }
    if (!Array.isArray(items)) {
      return res.status(400).json({ msg: 'items debe ser un arreglo' });
    }

    const saneados = [];
    for (const it of items) {
      const itemId = it.itemId || it.id;
      const cantidad = Number(it.cantidad ?? it.qty ?? 0);

      if (!it.nombre || !Number.isFinite(cantidad) || cantidad < 0) {
        return res.status(400).json({ msg: 'Ítem inválido' });
      }

      // itemId es opcional para el PDF (solo se usa para precio). Si viene, valida:
      let castId;
      if (itemId) {
        if (!mongoose.isValidObjectId(itemId)) {
          return res.status(400).json({ msg: 'itemId inválido' });
        }
        castId = new mongoose.Types.ObjectId(itemId);
      }

      saneados.push({
        ...(castId ? { itemId: castId } : {}),
        nombre: it.nombre,
        cantidad,
        unidad: it.unidad || 'pza',
        categoria: it.categoria || 'general'
      });
    }

    const updated = await Reserva.findByIdAndUpdate(
      id,
      { $set: { utensilios: saneados } },
      { new: true }
    );

    if (!updated) return res.status(404).json({ msg: 'Reserva no encontrada' });
    return res.json({ ok: true, reserva: updated });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ msg: 'Error interno' });
  }
});

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

    let productosPorId = {};
    const idsProductos = (reserva.utensilios || [])
      .map(u => u.itemId)
      .filter(Boolean);

    if (idsProductos.length) {
      const productos = await Producto.find({ _id: { $in: idsProductos } }).lean();
      productosPorId = Object.fromEntries(productos.map(p => [String(p._id), p]));
    }

    await streamReservaPDF(res, { reserva, productosPorId });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ msg: 'Error interno al generar PDF' });
  }
});



module.exports = router;
