// backend/services/receiptPdf.js
const PDFDocument = require('pdfkit');
const path = require('path');
const fs = require('fs');
const mongoose = require('mongoose');

const Receipt = require('../models/Receipt');
const Reserva = require('../models/Reservas');

/** ============ Utils básicos ============ */
function drawLabeledLine(doc, { label, value = '', x, y, w, labelW = 150, lineH = 18 }) {
  const vStr = value == null ? '' : String(value);
  doc.font('Helvetica-Bold').fontSize(10).fillColor('#111').text(label, x, y, { width: labelW });
  const lineX = x + labelW + 8;
  const lineY = y + lineH - 4;
  doc.moveTo(lineX, lineY).lineTo(lineX + w - labelW - 8, lineY).strokeColor('#999').lineWidth(0.7).stroke();
  doc.font('Helvetica').fontSize(10).fillColor('#000').text(vStr, lineX + 2, y, {
    width: w - labelW - 12,
    height: lineH,
    ellipsis: true,
  });
}

function drawCheckbox(doc, { label, checked = false, x, y }) {
  const size = 10;
  doc.rect(x, y, size, size).lineWidth(0.7).strokeColor('#333').stroke();
  if (checked) {
    doc.moveTo(x + 2, y + size / 2)
      .lineTo(x + size / 2, y + size - 2)
      .lineTo(x + size - 2, y + 2)
      .lineWidth(1.5)
      .strokeColor('#c53030')
      .stroke();
  }
  doc.font('Helvetica').fontSize(10).fillColor('#111').text(label, x + size + 6, y - 1);
}

function fmtDate(d) {
  try { return new Date(d).toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric' }); }
  catch { return ''; }
}

function money(n) {
  const v = Number(n || 0);
  return '$' + v.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function drawFolioBox(doc, { folio, x, y, w = 120, h = 64 }) {
  doc.save();
  doc.roundedRect(x, y, w, h, 8).lineWidth(1).strokeColor('#777').stroke();
  doc.font('Helvetica-Bold').fontSize(11).fillColor('#111').text('FOLIO:', x + 10, y + 8);
  doc.font('Helvetica-Bold').fontSize(18).fillColor('#c53030').text(String(folio || ''), x + 10, y + 28);
  doc.restore();
}

function drawSideTitle(doc, { text, x, y, h, color = '#b91c1c' }) {
  doc.save();
  doc.rect(x, y, 26, h).fillColor(color).fill();
  doc.rotate(90, { origin: [x + 26, y] });
  doc.font('Helvetica-Bold').fontSize(16).fillColor('#fff')
     .text(text || '', y + 8, -(x + 22) - 6, { width: h - 16, align: 'center' });
  doc.restore();
}

function drawLogoIfAny(doc, logoPath, x, y, w) {
  try { if (logoPath && fs.existsSync(logoPath)) doc.image(logoPath, x, y, { width: w }); } catch {}
}

/** ============ Totales ============ */
// Suma de recibos (pagos) para una reserva
async function sumPaid(orderId) {
  const rows = await Receipt.aggregate([
    { $match: { orderId: new mongoose.Types.ObjectId(orderId) } },
    { $group: { _id: '$orderId', paid: { $sum: '$amount' } } }
  ]);
  return rows[0]?.paid || 0;
}

// Dibuja una caja de totales
function drawTotalsBox(doc, { x, y, w, subtotal, discount, total, paid, paidBeforeThis, remaining }) {
  const lh = 16;
  const row = (label, val, bold = false, color = '#111') => {
    doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(10).fillColor(color);
    doc.text(label, x + 10, yCur);
    doc.text(val, x, yCur, { width: w - 10, align: 'right' });
    yCur += lh;
  };

  const h = 6 * lh + 16; // 6 filas aprox + padding
  doc.roundedRect(x, y, w, h, 8).lineWidth(1).strokeColor('#e5e7eb').stroke();
  let yCur = y + 10;

  row('Subtotal', money(subtotal));
  row('Descuento aplicado', `- ${money(discount)}`, false, '#b91c1c');
  row('Total de la reserva', money(total), true);

  yCur += 6; // pequeño espacio

  row('Pagado ANTES de este recibo', money(paidBeforeThis));
  row('Pagado acumulado', money(paid), true);
  row('Saldo restante', money(remaining), true, remaining > 0 ? '#111' : '#065f46');
}

/** ============ Export principal ============ */
async function streamReceiptPdf(res, receiptId) {
  const receipt = await Receipt.findById(receiptId);
  if (!receipt) { res.status(404).send('Recibo no encontrado'); return; }

  const reserva = receipt.orderId ? await Reserva.findById(receipt.orderId) : null;

  // Datos reserva y recibo
  const folio = receipt.folio || (receipt._id ? String(receipt._id).slice(-6).toUpperCase() : '');
  const cliente = receipt.customerName || reserva?.cliente || 'Cliente';
  const tel = reserva?.telefono || '';
  const fechaEvento = reserva?.fecha ? fmtDate(reserva.fecha) : '';
  const horario = (reserva?.horaInicio && reserva?.horaFin) ? `${reserva.horaInicio}–${reserva.horaFin}` : '';
  const personas = Number(reserva?.cantidadPersonas || 0) || '';
  const tipoReserv = reserva?.tipoEvento || reserva?.tipoReserva || '';
  const area = reserva?.descripcion || '';
  const metodo = (receipt.paymentMethod || '').toUpperCase();
  const amount = Number(receipt.amount || 0);
  const issuedAt = receipt.issuedAt ? fmtDate(receipt.issuedAt) : fmtDate(new Date());

  // Totales (usando tus virtuales de Reserva)
  const subtotal = Number(reserva?.subTotal || 0);
  const discount = Number(reserva?.descuentoCalculado || 0);
  const total = Math.max(0, subtotal - discount);

  // Pagos: acumulado incluyendo este recibo
  const paid = reserva?._id ? await sumPaid(reserva._id) : amount;
  const paidBeforeThis = Math.max(0, paid - amount); // útil para contextualizar este recibo
  const remaining = Math.max(0, total - paid);

  // Documento
  const doc = new PDFDocument({
    size: 'LETTER',
    margins: { top: 36, left: 36, right: 36, bottom: 36 }
  });

  res.setHeader('Content-Type', 'application/pdf');
  const nameSafe = (cliente || 'cliente').replace(/[^\w\d\-_\. ]+/g, '').slice(0, 40);
  res.setHeader('Content-Disposition', `inline; filename="Recibo-${folio}-${nameSafe}.pdf"`);

  doc.pipe(res);

  // ===== Layout base =====
  const pageW = doc.page.width;
  const pageH = doc.page.height;
  const contentX = 36 + 30; // margen izq + franja
  const contentW = pageW - contentX - 36 - 140; // deja espacio a la derecha para FOLIO
  const colGap = 18;

  drawSideTitle(doc, { text: 'EL TORO BRONCO REAL', x: 36, y: 36, h: pageH - 72 });
  drawLogoIfAny(doc, path.join(__dirname, '..', 'uploads', 'N12.png'), contentX, 36, 90);

  doc.font('Helvetica-Bold').fontSize(18).fillColor('#1f2937').text('RECIBO DE RESERVACIÓN', contentX + 100, 40);
  doc.font('Helvetica').fontSize(10).fillColor('#4b5563')
     .text(`Emitido: ${issuedAt}`, contentX + 100, 64);
  if (reserva?._id) doc.text(`Reserva: ${String(reserva._id)}`, contentX + 100, 78, { width: 260, ellipsis: true });

  drawFolioBox(doc, { folio, x: pageW - 36 - 120, y: 36 });

  doc.moveTo(contentX, 100).lineTo(pageW - 36, 100).strokeColor('#e5e7eb').lineWidth(1).stroke();

  // ===== Cuerpo tipo talonario =====
  let y = 116;

  drawLabeledLine(doc, { label: 'Nombre:', value: cliente, x: contentX, y, w: contentW }); y += 20;
  drawLabeledLine(doc, { label: 'Reservación para el día:', value: fechaEvento, x: contentX, y, w: contentW }); y += 20;
  drawLabeledLine(doc, { label: 'Área de reservación:', value: area, x: contentX, y, w: contentW }); y += 20;
  drawLabeledLine(doc, { label: 'Tipo de reservación:', value: tipoReserv, x: contentX, y, w: contentW }); y += 20;
  drawLabeledLine(doc, { label: 'Número de personas:', value: personas ? String(personas) : '', x: contentX, y, w: contentW }); y += 20;
  drawLabeledLine(doc, { label: 'Hora de evento:', value: horario, x: contentX, y, w: contentW }); y += 20;
  drawLabeledLine(doc, { label: 'Anticipo:', value: money(amount), x: contentX, y, w: contentW }); y += 20;
  drawLabeledLine(doc, { label: 'Teléfono:', value: tel, x: contentX, y, w: contentW }); y += 26;

  doc.font('Helvetica-Bold').fontSize(10).fillColor('#111').text('Método de pago:', contentX, y);
  const isEfectivo = metodo === 'EFECTIVO';
  const isVoucher = metodo === 'VOUCHER' || metodo === 'TARJETA' || metodo === 'TPV';
  const isTransfer = metodo === 'TRANSFERENCIA';
  let payX = contentX + 110;
  drawCheckbox(doc, { label: 'Efectivo', checked: isEfectivo, x: payX, y }); payX += 90;
  drawCheckbox(doc, { label: 'Voucher',  checked: isVoucher,  x: payX, y });   payX += 110;
  drawCheckbox(doc, { label: 'Transferencia', checked: isTransfer, x: payX, y });
  y += 28;

  const concepto = receipt.concept || '';
  doc.font('Helvetica-Bold').fontSize(10).fillColor('#111').text('Concepto:', contentX, y);
  doc.font('Helvetica').fontSize(10).fillColor('#000')
     .text(concepto, contentX + 80, y, { width: pageW - (contentX + 80) - 36 - 6 });
  y += 16;

  if (receipt.notes) {
    doc.font('Helvetica-Bold').fontSize(10).fillColor('#111').text('Notas:', contentX, y);
    doc.font('Helvetica').fontSize(10).fillColor('#000')
       .text(String(receipt.notes), contentX + 80, y, { width: pageW - (contentX + 80) - 36 - 6 });
    y += 14;
  }

  y += 8;
  doc.moveTo(contentX, y).lineTo(pageW - 36, y).strokeColor('#e5e7eb').lineWidth(1).stroke();
  y += 14;

  // ===== Caja de Totales =====
  const totalsBoxW = Math.min(340, pageW - contentX - 36);
  drawTotalsBox(doc, {
    x: pageW - 36 - totalsBoxW,
    y,
    w: totalsBoxW,
    subtotal,
    discount,
    total,
    paid,
    paidBeforeThis,
    remaining
  });

  // Firmas a la izquierda
  const leftW = (pageW - 36 - contentX) - totalsBoxW - 20;
  drawLabeledLine(doc, { label: 'Le atendió:', value: receipt.issuedBy || '—', x: contentX, y, w: leftW }); y += 26;
  drawLabeledLine(doc, { label: 'Firma del cliente:', value: '', x: contentX, y, w: leftW });

  // Footer contacto
  doc.font('Helvetica').fontSize(9).fillColor('#6b7280');
  doc.text('Tel: 656 170 5946   •   @empresastelotorobronco@yahoo.com.mx',
    contentX, pageH - 50, { width: pageW - contentX - 36, align: 'right' });

  doc.end();
}

module.exports = { streamReceiptPdf };
