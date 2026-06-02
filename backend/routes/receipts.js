// backend/routes/receipts.js
const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');

const Reserva = require('../models/Reservas');
const Receipt = require('../models/Receipt');
const { streamReceiptPdf } = require('../services/receiptPdf');

// Helper: totales
async function getTotals(orderId) {
  const reserva = await Reserva.findById(orderId);
  if (!reserva) return null;

  const subtotal = reserva.subTotal || 0;
  const descuento = reserva.descuentoCalculado || 0;
  const total = Math.max(0, subtotal - descuento);

  const pagos = await Receipt.aggregate([
    { $match: { orderId: new mongoose.Types.ObjectId(orderId) } },
    { $group: { _id: '$orderId', paid: { $sum: '$amount' } } }
  ]);
  const paid = pagos[0]?.paid || 0;
  const remaining = Math.max(0, total - paid);

  return { reserva, subtotal, descuento, total, paid, remaining };
}

/** POST /receipts  -> crear recibo/pago parcial */
router.post('/receipts', async (req, res) => {
  try {
    const {
      orderId, amount, paymentMethod='EFECTIVO', currency='MXN',
      concept='', customerName='', issuedAt, notes='',
      issuedBy='sistema', taxRate=0,
      amountOriginal=null, currencyOriginal=null, exchangeRate=null,
    } = req.body || {};

    if (!orderId) return res.status(400).json({ error: 'orderId requerido' });
    if (!Number.isFinite(Number(amount)) || Number(amount) <= 0) {
      return res.status(400).json({ error: 'amount inválido' });
    }

    const totals = await getTotals(orderId);
    if (!totals) return res.status(404).json({ error: 'Reserva no encontrada' });

    const esPagoUSD = currencyOriginal === 'USD';
    const toleranciaBackend = esPagoUSD ? 1.0 : 0.01;
    if (Number(amount) > totals.remaining + toleranciaBackend) {
      return res.status(400).json({ error: `No puedes pagar más del saldo (${totals.remaining.toFixed(2)})` });
    }
    // Ajustar al saldo exacto si está dentro de la tolerancia
    const amountFinal = Math.min(Number(amount), totals.remaining);

   const reserva=totals.reserva;

    const subtotal=Number(reserva.subTotal||0);

    const descuento=Number(reserva.descuentoCalculado||0);

    const total=Math.max(0,subtotal-descuento);

    const nuevoPagado= totals.paid + amountFinal;

    const saldo=
    Math.max(
    0,
    total-
    nuevoPagado
    );

    // detectar productos actuales
  const origen=
reserva.utensilios||
[];

const productos=
Array.isArray(origen)
?origen.map(p=>({

itemId:p.itemId,
nombre:p.nombre,
cantidad:p.cantidad||1,
unidad:p.unidad||'',
categoria:p.categoria||'',
precio:p.precio||0,
descripcion:p.descripcion||'',
fechaAgregado:
p.fechaAgregado||
reserva.createdAt||
new Date()
}))
:[];

    const rc=
    await Receipt.create({

    orderId,

    amount: amountFinal,

    paymentMethod,

    currency,

    concept,

    customerName,

   issuedAt:
issuedAt
?new Date(issuedAt)
:new Date(),

    notes,

    issuedBy,

    taxRate:
    Number(
    taxRate||
    0
    ),

    amountOriginal: amountOriginal != null ? Number(amountOriginal) : null,
    currencyOriginal: currencyOriginal || null,
    exchangeRate: exchangeRate != null ? Number(exchangeRate) : null,

    folio:
    'R-'+
    Math
    .random()
    .toString(36)
    .slice(2,8)
    .toUpperCase(),
    snapshot:{
 fecha:
 issuedAt
 ?new Date(issuedAt)
 :new Date(),

 productos:
 Array.isArray(productos)
 ?productos
 :[],

 subtotal,

 descuento,

 total,

 saldo
}});

    return res.status(201).json({ ok: true, receipt: rc });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'Error interno' });
  }
});

/** GET /reservas/:id/receipts -> historial de recibos */
router.get('/reservas/:id/receipts', async (req, res) => {
  const list = await Receipt.find({ orderId: req.params.id }).sort({ issuedAt: 1, createdAt: 1 });
  res.json(list);
});

/** GET /reservas/:id/saldo -> totales/pagado/saldo */
router.get('/reservas/:id/saldo', async (req, res) => {
  const totals = await getTotals(req.params.id);
  if (!totals) return res.status(404).json({ error: 'Reserva no encontrada' });
  const { subtotal, descuento, total, paid, remaining } = totals;
  res.json({ subtotal, descuento, total, paid, remaining });
});

/** DELETE /receipts/:id -> eliminar un recibo */
router.delete('/receipts/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const rc = await Receipt.findByIdAndDelete(id);

    if (!rc) {
      return res.status(404).json({ ok: false, msg: 'Recibo no encontrado' });
    }

    return res.json({
      ok: true,
      msg: 'Recibo eliminado correctamente',
      receipt: rc,
    });
  } catch (err) {
    console.error('DELETE /receipts/:id', err);
    return res.status(500).json({
      ok: false,
      msg: 'Error interno al eliminar el recibo',
    });
  }
});

/** GET /receipts/:id/pdf -> PDF del recibo */
router.get('/receipts/:id/pdf', async (req, res) => {
  try {
    await streamReceiptPdf(res, req.params.id);
  } catch (e) {
    console.error(e);
    res.status(404).send('No se pudo generar el PDF');
  }
});

module.exports = router;
