const express = require('express');
const router = express.Router();

const dayjs = require('dayjs');
const utc = require('dayjs/plugin/utc');
const timezone = require('dayjs/plugin/timezone');
dayjs.extend(utc);
dayjs.extend(timezone);

const Reserva = require('../models/Reservas');
const InvitacionQR = require('../models/InvitacionQR');

const TZ = process.env.APP_TIMEZONE || 'America/Ciudad_Juarez';

// Margen de gracia tras la hora de fin antes de pedir confirmación de cierre
const HORAS_GRACIA_FIN = 2;

// Calcula el instante real de fin del evento, considerando eventos
// que cruzan la medianoche (ej. 21:00 -> 02:00 del día siguiente)
function calcularFinReal(fecha, horaInicio, horaFin) {
  const fechaStr = dayjs(fecha).tz(TZ).format('YYYY-MM-DD');

  const inicio = dayjs.tz(`${fechaStr} ${horaInicio}`, 'YYYY-MM-DD HH:mm', TZ);
  let fin = dayjs.tz(`${fechaStr} ${horaFin}`, 'YYYY-MM-DD HH:mm', TZ);

  if (!fin.isAfter(inicio)) {
    fin = fin.add(1, 'day');
  }

  return fin;
}

function calcularRequiereConfirmarFin(reserva, finReal) {
  if (reserva.estado !== 'confirmada') return false;

  const pospuestoHasta = reserva.finalizacion?.pospuestoHasta;
  if (pospuestoHasta && dayjs().isBefore(dayjs(pospuestoHasta))) {
    return false;
  }

  return dayjs().isAfter(finReal.add(HORAS_GRACIA_FIN, 'hour'));
}

function conInfoFin(reservaDoc) {
  const reserva = reservaDoc.toObject({ virtuals: true });
  const finReal = calcularFinReal(reserva.fecha, reserva.horaInicio, reserva.horaFin);

  reserva.finReal = finReal.toISOString();
  reserva.requiereConfirmarFin = calcularRequiereConfirmarFin(reserva, finReal);

  return reserva;
}

router.get('/reservas', async (req, res) => {
  try {
    const hoy = new Date();

    hoy.setHours(
      0,
      0,
      0,
      0
    );

    const limiteInferior = new Date(hoy);

    limiteInferior.setDate(
      limiteInferior.getDate() - 2
    );

    const reservas =
      await Reserva.find({
        tipoReserva: 'evento',
        estado: { $in: ['confirmada', 'finalizado'] },
        fecha: {
          $gte: limiteInferior,
        },
      })
        .sort({
          fecha: 1,
        })
        .limit(100);

    return res.json(
      reservas.map(conInfoFin)
    );

  } catch (error) {

    console.error(
      'GET app reservas error:',
      error
    );

    return res
      .status(500)
      .json({
        msg:
          'Error al obtener eventos',
      });

  }
});

router.get(
  '/dashboard/:reservaId',

  async (
    req,
    res
  ) => {

    try {

      const {
        reservaId,
      } =
        req.params;

      const reserva =
        await Reserva.findById(
          reservaId
        );

      if (!reserva) {

        return res
          .status(404)
          .json({
            msg:
              'Evento no encontrado',
          });

      }

      const invitaciones =
        await InvitacionQR.find({
          reservaId,
        });

      const totalInvitaciones =
        invitaciones.length;

      let canceladas = 0;

      let personasAutorizadas = 0;

      let entradasRestantes = 0;

      let entradasRegistradas = 0;

      invitaciones.forEach(
        (inv) => {

          if (
            inv.estado ===
            'cancelada'
          ) {

            canceladas++;

            return;
          }

          const autorizadas =
            Number(
              inv.personasAutorizadas ||
                0
            );

          const restantes =
            Number(
              inv.entradasRestantes ||
                0
            );

          personasAutorizadas +=
            autorizadas;

          entradasRestantes +=
            restantes;

          entradasRegistradas +=
            autorizadas -
            restantes;
        }
      );

      const capacidadEvento =
        Number(
          reserva.cantidadPersonas ||
            0
        );

      const disponiblesParaGenerar =
        Math.max(
          capacidadEvento -
            personasAutorizadas,
          0
        );

      const sobreCupo =
        Math.max(
          personasAutorizadas -
            capacidadEvento,
          0
        );

      const porcentajeCapacidad =
        capacidadEvento > 0
          ? Math.min(
              (
                personasAutorizadas /
                capacidadEvento
              ) *
                100,
              100
            )
          : 0;

      // NUEVO:
      const ultimosAccesos =
        invitaciones

          .filter(
            (inv) =>
              Number(
                inv.ultimaCantidadRegistrada ||
                  0
              ) > 0
          )

          .sort(
            (a, b) =>
              new Date(
                b.updatedAt
              ) -
              new Date(
                a.updatedAt
              )
          )

          .slice(
            0,
            5
          )

          .map(
            (
              inv
            ) => ({
              _id:
                inv._id,

              nombreFamilia:
                inv.nombreFamilia,

              personasIngresadas:
                inv.ultimaCantidadRegistrada,

              entradasRestantes:
                inv.entradasRestantes,

              estado:
                inv.estado,

              fechaEntrada:
                inv.updatedAt,
            })
          );

      return res.json({

        reserva: conInfoFin(reserva),

        resumen: {

          invitaciones:
            totalInvitaciones,

          entradas:
            entradasRegistradas,

          restantes:
            entradasRestantes,

          canceladas,

          personasAutorizadas,

          capacidadEvento,

          pasesGenerados:
            personasAutorizadas,

          disponiblesParaGenerar,

          sobreCupo,

          porcentajeCapacidad,
        },

        invitaciones,

        ultimosAccesos,
      });

    } catch (
      error
    ) {

      console.error(
        'GET app dashboard error:',
        error
      );

      return res
        .status(500)
        .json({
          msg:
            'Error al obtener dashboard',
        });

    }
  }
);

// Confirma el cierre del evento (irreversible salvo /reactivar)
router.patch('/reservas/:id/finalizar', async (req, res) => {
  try {
    const reserva = await Reserva.findById(req.params.id);

    if (!reserva) {
      return res.status(404).json({ msg: 'Evento no encontrado' });
    }

    reserva.estado = 'finalizado';
    reserva.finalizacion = {
      confirmadoEn: new Date(),
      confirmadoPor: null,
      pospuestoHasta: null,
    };

    await reserva.save();

    return res.json({ ok: true, reserva: conInfoFin(reserva) });
  } catch (error) {
    console.error('PATCH /app/reservas/:id/finalizar error:', error);
    return res.status(500).json({ msg: 'Error al finalizar el evento' });
  }
});

// Pospone el aviso de cierre unas horas más (por defecto 2)
router.patch('/reservas/:id/posponer-fin', async (req, res) => {
  try {
    const reserva = await Reserva.findById(req.params.id);

    if (!reserva) {
      return res.status(404).json({ msg: 'Evento no encontrado' });
    }

    const horas = Number(req.body?.horas) > 0 ? Number(req.body.horas) : 2;
    const pospuestoHasta = dayjs().add(horas, 'hour').toDate();

    reserva.finalizacion = {
      confirmadoEn: reserva.finalizacion?.confirmadoEn || null,
      confirmadoPor: reserva.finalizacion?.confirmadoPor || null,
      pospuestoHasta,
    };

    await reserva.save();

    return res.json({ ok: true, pospuestoHasta });
  } catch (error) {
    console.error('PATCH /app/reservas/:id/posponer-fin error:', error);
    return res.status(500).json({ msg: 'Error al posponer el cierre' });
  }
});

// Reabre un evento marcado como finalizado por error
router.patch('/reservas/:id/reactivar', async (req, res) => {
  try {
    const reserva = await Reserva.findById(req.params.id);

    if (!reserva) {
      return res.status(404).json({ msg: 'Evento no encontrado' });
    }

    reserva.estado = 'confirmada';
    reserva.finalizacion = {
      confirmadoEn: null,
      confirmadoPor: null,
      pospuestoHasta: null,
    };

    await reserva.save();

    return res.json({ ok: true, reserva: conInfoFin(reserva) });
  } catch (error) {
    console.error('PATCH /app/reservas/:id/reactivar error:', error);
    return res.status(500).json({ msg: 'Error al reactivar el evento' });
  }
});

module.exports =
  router;