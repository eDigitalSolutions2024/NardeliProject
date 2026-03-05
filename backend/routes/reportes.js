// backend/routes/reportes.js
const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');

const Reserva = require('../models/Reservas');

// ===== Helpers fechas (YYYY-MM-DD) usando HORA LOCAL del server =====
function parseYmdToDateStart(ymd) {
  if (!ymd) return null;
  const m = String(ymd).trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const y = Number(m[1]), mo = Number(m[2]) - 1, d = Number(m[3]);
  return new Date(y, mo, d, 0, 0, 0, 0);
}
function parseYmdToDateEnd(ymd) {
  if (!ymd) return null;
  const m = String(ymd).trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const y = Number(m[1]), mo = Number(m[2]) - 1, d = Number(m[3]);
  return new Date(y, mo, d, 23, 59, 59, 999);
}

function escapeRegex(s) {
  return String(s || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * GET /api/reportes/eventos
 * Tabla (historial) por rango usando Reserva.fecha
 *
 * Query:
 * - from=YYYY-MM-DD (req)
 * - to=YYYY-MM-DD   (req)
 * - tipoEvento=...  (opcional)
 * - status=ALL|PAGADO|PARCIAL|PENDIENTE (opcional, default ALL)
 * - q=... (opcional) cliente/correo/teléfono/shortId
 * - page=1 (opcional)
 * - pageSize=20 (opcional)
 */
router.get('/eventos', async (req, res) => {
  try {
    const {
      from, to,
      tipoEvento,
      status = 'ALL',
      q,
      page = 1,
      pageSize = 20,
    } = req.query || {};

    const dtFrom = parseYmdToDateStart(from);
    const dtTo = parseYmdToDateEnd(to);

    if (!dtFrom || !dtTo) {
      return res.status(400).json({
        error: 'from y to son requeridos con formato YYYY-MM-DD',
        example: '/api/reportes/eventos?from=2026-03-01&to=2026-03-31',
      });
    }

    const { tipo = 'ALL' } = req.query || {};
    const tipoNorm = String(tipo || 'ALL').toUpperCase().trim();

    const match = {
        createdAt: { $gte: dtFrom, $lte: dtTo },
        tipoReserva: { $in: ['evento','cotizacion'] },
        };

    if (tipoNorm === 'EVENTO') match.tipoReserva = 'evento';
    else if (tipoNorm === 'COTIZACION') match.tipoReserva = 'cotizacion';
    else match.tipoReserva = { $in: ['evento', 'cotizacion'] };

        if (tipoEvento && String(tipoEvento).trim()) {
        match.tipoEvento = String(tipoEvento).trim();
    }

    if (q && String(q).trim()) {
      const needle = String(q).trim();
      const rx = new RegExp(escapeRegex(needle), 'i');
      match.$or = [
        { cliente: rx },
        { correo: rx },
        { telefono: rx },
        { shortId: rx },
      ];
    }

    const p = Math.max(1, parseInt(page, 10) || 1);
    const ps = Math.min(200, Math.max(1, parseInt(pageSize, 10) || 20));
    const skip = (p - 1) * ps;

    const statusNorm = String(status || 'ALL').toUpperCase().trim();
    const statusFilter = ['PAGADO', 'PARCIAL', 'PENDIENTE'].includes(statusNorm) ? statusNorm : 'ALL';

    const pipeline = [
      { $match: match },

      // Join receipts
      {
        
        $lookup: {
          from: 'receipts',
          localField: '_id',
          foreignField: 'orderId',
          as: 'receipts',
        },
      },

      {
        $addFields: {
            folioCalc: {
            $ifNull: [
                '$shortId',
                { $toUpper: { $substrBytes: [{ $toString: '$_id' }, 16, 8] } }
            ]
            }
        }
    },

      // subtotal calc
      {
        $addFields: {
          subtotalCalc: {
            $reduce: {
              input: { $ifNull: ['$utensilios', []] },
              initialValue: 0,
              in: {
                $add: [
                  '$$value',
                  {
                    $multiply: [
                      { $toDouble: { $ifNull: ['$$this.precio', 0] } },
                      { $toDouble: { $ifNull: ['$$this.cantidad', 0] } },
                    ],
                  },
                ],
              },
            },
          },
        },
      },

      // descuento calc
      {
        $addFields: {
          descTipo: { $ifNull: ['$precios.descuento.tipo', 'monto'] },
          descValor: { $toDouble: { $ifNull: ['$precios.descuento.valor', 0] } },
        },
      },
      {
        $addFields: {
          descuentoCalc: {
            $let: {
              vars: { st: '$subtotalCalc', t: '$descTipo', v: '$descValor' },
              in: {
                $cond: [
                  { $or: [{ $lte: ['$$v', 0] }, { $lte: ['$$st', 0] }] },
                  0,
                  {
                    $cond: [
                      { $eq: ['$$t', 'porcentaje'] },
                      {
                        $min: [
                          '$$st',
                          {
                            $multiply: [
                              '$$st',
                              {
                                $divide: [
                                  { $min: [100, { $max: [0, '$$v'] }] },
                                  100,
                                ],
                              },
                            ],
                          },
                        ],
                      },
                      { $min: ['$$st', { $max: [0, '$$v'] }] },
                    ],
                  },
                ],
              },
            },
          },
        },
      },

      // total calc
      {
        $addFields: {
          totalCalc: { $max: [0, { $subtract: ['$subtotalCalc', '$descuentoCalc'] }] },
        },
      },

      // paid calc
      {
        $addFields: {
          paidCalc: {
            $reduce: {
              input: { $ifNull: ['$receipts', []] },
              initialValue: 0,
              in: { $add: ['$$value', { $toDouble: { $ifNull: ['$$this.amount', 0] } }] },
            },
          },
        },
      },

      // remaining
      {
        $addFields: {
          remainingCalc: { $max: [0, { $subtract: ['$totalCalc', '$paidCalc'] }] },
        },
      },

      // payment status
      {
        $addFields: {
          paymentStatus: {
            $cond: [
              { $lte: ['$remainingCalc', 0.0001] },
              'PAGADO',
              { $cond: [{ $gt: ['$paidCalc', 0.0001] }, 'PARCIAL', 'PENDIENTE'] },
            ],
          },
        },
      },

      // filtrar status si aplica
      ...(statusFilter === 'ALL'
        ? []
        : [{ $match: { paymentStatus: statusFilter } }]),

      // Orden
      { $sort: { fecha: -1, createdAt: -1 } },

      // Facet: total + page items
      {
        $facet: {
          meta: [{ $count: 'total' }],
          items: [
            { $skip: skip },
            { $limit: ps },
            {
              $project: {
                _id: 1,
                shortId: '$folioCalc',
                cliente: 1,
                correo: 1,
                telefono: 1,
                tipoEvento: 1,
                fecha: 1,
                horaInicio: 1,
                horaFin: 1,
                cantidadPersonas: 1,

                subtotal: '$subtotalCalc',
                descuento: '$descuentoCalc',
                total: '$totalCalc',
                paid: '$paidCalc',
                remaining: '$remainingCalc',
                paymentStatus: 1,

                createdAt: 1,
              },
            },
          ],
        },
      },
      {
        $project: {
          total: { $ifNull: [{ $arrayElemAt: ['$meta.total', 0] }, 0] },
          items: 1,
        },
      },
    ];

    const out = await Reserva.aggregate(pipeline).allowDiskUse(true);
    const total = out?.[0]?.total || 0;
    const items = out?.[0]?.items || [];

    return res.json({
      ok: true,
      page: p,
      pageSize: ps,
      total,
      totalPages: Math.max(1, Math.ceil(total / ps)),
      items,
      filters: {
        from, to,
        tipoEvento: tipoEvento || '',
        status: statusFilter,
        q: q || '',
      },
    });
  } catch (err) {
    console.error('GET /reportes/eventos', err);
    return res.status(500).json({ error: 'Error interno' });
  }
});

/**
 * GET /api/reportes/resumen
 * (KPIs) por rango usando Reserva.fecha
 */
router.get('/resumen', async (req, res) => {
  try {
        const { from, to, tipoEvento, q } = req.query || {};

    const dtFrom = parseYmdToDateStart(from);
    const dtTo = parseYmdToDateEnd(to);

    if (!dtFrom || !dtTo) {
      return res.status(400).json({
        error: 'from y to son requeridos con formato YYYY-MM-DD',
        example: '/api/reportes/resumen?from=2026-03-01&to=2026-03-31',
      });
    }

    // ✅ FALTABA ESTO:
    const match = {
        createdAt: { $gte: dtFrom, $lte: dtTo },
        tipoReserva: { $in: ['evento', 'cotizacion'] },
        };

    const { cotStatus = 'ALL' } = req.query || {};
    const cotNorm = String(cotStatus || 'ALL').toUpperCase().trim();

    // Filtra solo cotizaciones SIN romper eventos
    if (cotNorm === 'ACEPTADA') {
      match.$and = (match.$and || []).concat([{
        $or: [
          { tipoReserva: { $ne: 'cotizacion' } },
          { 'cotizacion.aceptada': true }
        ]
      }]);
    } else if (cotNorm === 'PENDIENTE') {
      match.$and = (match.$and || []).concat([{
        $or: [
          { tipoReserva: { $ne: 'cotizacion' } },
          { 'cotizacion.aceptada': { $ne: true } }
        ]
      }]);
    }

    if (tipoEvento && String(tipoEvento).trim()) {
      match.tipoEvento = String(tipoEvento).trim();
    }

    if (q && String(q).trim()) {
      const needle = String(q).trim();
      const rx = new RegExp(escapeRegex(needle), 'i');
      match.$or = [
        { cliente: rx },
        { correo: rx },
        { telefono: rx },
        { shortId: rx },
      ];
    }

    const pipeline = [
      { $match: match },
      {
        $lookup: {
          from: 'receipts',
          localField: '_id',
          foreignField: 'orderId',
          as: 'receipts',
        },
      },
      {
        $addFields: {
          subtotalCalc: {
            $reduce: {
              input: { $ifNull: ['$utensilios', []] },
              initialValue: 0,
              in: {
                $add: [
                  '$$value',
                  {
                    $multiply: [
                      { $toDouble: { $ifNull: ['$$this.precio', 0] } },
                      { $toDouble: { $ifNull: ['$$this.cantidad', 0] } },
                    ],
                  },
                ],
              },
            },
          },
        },
      },
      {
        $addFields: {
          descTipo: { $ifNull: ['$precios.descuento.tipo', 'monto'] },
          descValor: { $toDouble: { $ifNull: ['$precios.descuento.valor', 0] } },
        },
      },
      {
        $addFields: {
          descuentoCalc: {
            $let: {
              vars: { st: '$subtotalCalc', t: '$descTipo', v: '$descValor' },
              in: {
                $cond: [
                  { $or: [{ $lte: ['$$v', 0] }, { $lte: ['$$st', 0] }] },
                  0,
                  {
                    $cond: [
                      { $eq: ['$$t', 'porcentaje'] },
                      {
                        $min: [
                          '$$st',
                          {
                            $multiply: [
                              '$$st',
                              {
                                $divide: [
                                  { $min: [100, { $max: [0, '$$v'] }] },
                                  100,
                                ],
                              },
                            ],
                          },
                        ],
                      },
                      { $min: ['$$st', { $max: [0, '$$v'] }] },
                    ],
                  },
                ],
              },
            },
          },
        },
      },
      {
        $addFields: {
          totalCalc: { $max: [0, { $subtract: ['$subtotalCalc', '$descuentoCalc'] }] },
        },
      },
      {
        $addFields: {
          paidCalc: {
            $reduce: {
              input: { $ifNull: ['$receipts', []] },
              initialValue: 0,
              in: { $add: ['$$value', { $toDouble: { $ifNull: ['$$this.amount', 0] } }] },
            },
          },
        },
      },
      {
        $addFields: {
          remainingCalc: { $max: [0, { $subtract: ['$totalCalc', '$paidCalc'] }] },
        },
      },
      {
            $addFields: {
                paymentStatus: {
                $cond: [
                    { $eq: ['$tipoReserva', 'cotizacion'] },
                    'NA',
                    {
                    $cond: [
                        { $lte: ['$remainingCalc', 0.0001] },
                        'PAGADO',
                        { $cond: [{ $gt: ['$paidCalc', 0.0001] }, 'PARCIAL', 'PENDIENTE'] },
                    ]
                 }
                ]
                }
            }
        },
      {
        $group: {
            _id: null,

            // ✅ separa conteos
            eventos: { $sum: { $cond: [{ $eq: ['$tipoReserva', 'evento'] }, 1, 0] } },
            cotizaciones: { $sum: { $cond: [{ $eq: ['$tipoReserva', 'cotizacion'] }, 1, 0] } },

            // ✅ status SOLO para eventos (cotización queda NA)
            pagados:    { $sum: { $cond: [{ $eq: ['$paymentStatus', 'PAGADO'] }, 1, 0] } },
            parciales:  { $sum: { $cond: [{ $eq: ['$paymentStatus', 'PARCIAL'] }, 1, 0] } },
            pendientes: { $sum: { $cond: [{ $eq: ['$paymentStatus', 'PENDIENTE'] }, 1, 0] } },

            // ✅ dinero SOLO eventos (para que cotizaciones no afecten)
            total:     { $sum: { $cond: [{ $eq: ['$tipoReserva','evento'] }, '$totalCalc', 0] } },
            paid:      { $sum: { $cond: [{ $eq: ['$tipoReserva','evento'] }, '$paidCalc', 0] } },
            remaining: { $sum: { $cond: [{ $eq: ['$tipoReserva','evento'] }, '$remainingCalc', 0] } },
        },
      },
      {
            $project: {
                _id: 0,
                counts: {
                eventos: '$eventos',
                cotizaciones: '$cotizaciones',
                pagados: '$pagados',
                parciales: '$parciales',
                pendientes: '$pendientes',
                },
                money: {
                total: '$total',
                paid: '$paid',
                remaining: '$remaining',
                avgTicket: {
                    $cond: [{ $gt: ['$eventos', 0] }, { $divide: ['$total', '$eventos'] }, 0],
                },
                },
            },
        },
    ];

    const out = await Reserva.aggregate(pipeline).allowDiskUse(true);
    const data =
      out?.[0] || {
        counts: { eventos: 0, pagados: 0, parciales: 0, pendientes: 0 },
        money: { total: 0, paid: 0, remaining: 0, avgTicket: 0 },
      };

    return res.json({
      ok: true,
      range: { from: dtFrom.toISOString(), to: dtTo.toISOString() },
      filters: { tipoEvento: tipoEvento || '', q: q || '' },
      ...data,
    });
  } catch (err) {
    console.error('GET /reportes/resumen', err);
    return res.status(500).json({ error: 'Error interno' });
  }
});

module.exports = router;