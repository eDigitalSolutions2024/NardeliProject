const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Reserva = require('../models/Reservas');

const TZ = process.env.APP_TIMEZONE || 'Amrica/Denver';

// Convierte "YYYY-MM-DD" (o cualquier input) a Date en 12:00:00 Z
function normalizeFechaNoonUTC(input) {
  let ymd;
  if (typeof input === 'string') {
    ymd = input.slice(0, 10);
  } else {
    // Date u otro: lo pasamos a ISO y tomamos el YYYY-MM-DD
    ymd = new Date(input).toISOString().slice(0, 10);
  }
  return new Date(`${ymd}T12:00:00Z`);
}

// --- helpers de fecha/horario ---
function timeToMinutes(t) {
  const [h, m] = String(t).split(':').map(Number);
  return h * 60 + m;
}
function overlap(s1, e1, s2, e2) {
  return Math.max(s1, s2) < Math.min(e1, e2);
}
// YYYY-MM-DD a partir de Date o string
function ymd(input) {
  if (!input) return null;
  return (typeof input === 'string' ? input : input.toISOString()).slice(0, 10);
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
  if (excluirId) {
    expr._id = { $ne: new mongoose.Types.ObjectId(excluirId) };
  }
  return expr;
}

async function checarDisponibilidad({ fecha, horaInicio, horaFin, excluirId = null }) {
  const fechaStr = ymd(fecha);
  if (!fechaStr || !horaInicio || !horaFin) return { disponible: false, motivo: 'Datos incompletos' };

  const ini = timeToMinutes(horaInicio);
  const fin = timeToMinutes(horaFin);
  if (fin <= ini) return { disponible: false, motivo: 'Rango de horas inválido' };

  const delDia = await Reserva.find(sameDayFilter(fechaStr, excluirId)).lean();
  const choca = delDia.some(r => overlap(ini, fin, timeToMinutes(r.horaInicio), timeToMinutes(r.horaFin)));
  return choca ? { disponible: false, motivo: 'Empalme con otra reserva' } : { disponible: true };
}

// Crear
router.post('/', async (req, res) => {
  try {
    req.body.fecha = normalizeFechaNoonUTC(req.body.fecha);
    const disp = await checarDisponibilidad(req.body);
    if (!disp.disponible) return res.status(409).json({ error: disp.motivo });
    const nueva = new Reserva(req.body);
    const guardada = await nueva.save();
    res.status(201).json(guardada);
  } catch (e) {
    console.error('Error al guardar la reserva:', e);
    res.status(500).json({ message: 'Error del servidor' });
  }
});

// Listar (devuelve también fechaLocal ya calculada)
router.get('/', async (_req, res) => {
  try {
    const reservas = await Reserva.aggregate([
      {
        $addFields: {
          fechaLocal: { $dateToString: { date: "$fecha", format: "%Y-%m-%d", timezone: TZ } }
        }
      },
      { $sort: { fecha: 1, horaInicio: 1 } }
    ]);
    res.json(reservas);
  } catch (e) {
    console.error('Error al obtener reservas:', e);
    res.status(500).json({ message: 'Error del servidor' });
  }
});

// Ver disponibilidad sin crear
router.post('/disponibilidad', async (req, res) => {
  try {
    const resp = await checarDisponibilidad(req.body);
    res.json(resp);
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: 'Error del servidor' });
  }
});

// Actualizar
router.put('/:id', async (req, res) => {
  try {
    req.body.fecha = normalizeFechaNoonUTC(req.body.fecha);
    const disp = await checarDisponibilidad({ ...req.body, excluirId: req.params.id });
    if (!disp.disponible) return res.status(409).json({ error: disp.motivo });

    const actualizada = await Reserva.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json(actualizada);
  } catch (e) {
    console.error('Error al actualizar:', e);
    res.status(500).json({ message: 'Error del servidor' });
  }
});

// Eliminar
router.delete('/:id', async (req, res) => {
  try {
    await Reserva.findByIdAndDelete(req.params.id);
    res.json({ message: 'Reserva eliminada' });
  } catch (e) {
    console.error('Error al eliminar:', e);
    res.status(500).json({ message: 'Error del servidor' });
  }
});

module.exports = router;
