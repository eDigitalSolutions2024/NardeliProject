// backend/services/receiptPdf.js
const PDFDocument = require('pdfkit');
const path = require('path');
const fs = require('fs');
const mongoose = require('mongoose');

const Receipt = require('../models/Receipt');
const Reserva = require('../models/Reservas');

/** ================== Tema Nardeli (morados) ================== */
const THEME = {
  primary:   '#6D28D9', // morado principal
  primaryLt: '#A78BFA', // morado claro (acento)
  primaryDk: '#4C1D95', // morado oscuro
  text:      '#1f2937', // gris oscuro para títulos
  muted:     '#4b5563', // gris para metadata
  border:    '#e5e7eb', // gris de bordes
};

/** ================== Utils básicos ================== */
function drawLabeledLine(doc, { label, value = '', x, y, w, labelW = 150, lineH = 18 }) {
  const vStr = value == null ? '' : String(value);
  doc.font('Helvetica-Bold').fontSize(10).fillColor('#111').text(label, x, y, { width: labelW });
  const lineX = x + labelW + 8;
  const lineY = y + lineH - 4;
  doc
    .moveTo(lineX, lineY)
    .lineTo(lineX + w - labelW - 8, lineY)
    .strokeColor(THEME.border)
    .lineWidth(0.7)
    .stroke();
  doc
    .font('Helvetica')
    .fontSize(10)
    .fillColor('#000')
    .text(vStr, lineX + 2, y, {
      width: w - labelW - 12,
      height: lineH,
      ellipsis: true,
    });
}

function drawCheckbox(doc, { label, checked = false, x, y }) {
  const size = 10;
  doc.rect(x, y, size, size).lineWidth(0.7).strokeColor('#333').stroke();
  if (checked) {
    doc
      .moveTo(x + 2, y + size / 2)
      .lineTo(x + size / 2, y + size - 2)
      .lineTo(x + size - 2, y + 2)
      .lineWidth(1.5)
      .strokeColor(THEME.primary)
      .stroke();
  }
  doc.font('Helvetica').fontSize(10).fillColor('#111').text(label, x + size + 6, y - 1);
}

function fmtDate(d) {
  try {
    return new Date(d).toLocaleDateString('es-MX', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  } catch {
    return '';
  }
}

function money(n) {
  const v = Number(n || 0);
  return (
    '$' +
    v.toLocaleString('es-MX', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
  );
}

function drawFolioBox(doc, { folio, x, y, w = 120, h = 64 }) {
  doc.save();
  doc.roundedRect(x, y, w, h, 8).lineWidth(1).strokeColor(THEME.border).stroke();
  doc.font('Helvetica-Bold').fontSize(11).fillColor(THEME.text).text('FOLIO:', x + 10, y + 8);
  doc.font('Helvetica-Bold').fontSize(18).fillColor(THEME.primary).text(String(folio || ''), x + 10, y + 28);
  doc.restore();
}

function drawSideTitle(doc, { text, x, y, h, color = THEME.primaryDk }) {
  doc.save();
  doc.rect(x, y, 26, h).fillColor(color).fill();
  doc.rotate(90, { origin: [x + 26, y] });
  doc
    .font('Helvetica-Bold')
    .fontSize(16)
    .fillColor('#fff')
    .text(text || '', y + 8, -(x + 22) - 6, { width: h - 16, align: 'center' });
  doc.restore();
}

function drawLogoIfAny(doc, logoPath, x, y, w) {
  try {
    if (logoPath && fs.existsSync(logoPath)) doc.image(logoPath, x, y, { width: w });
  } catch {}
}

/** ================== Totales / Pagos ================== */
// Suma de recibos (pagos) para una reserva
async function sumPaid(orderId) {
  const rows = await Receipt.aggregate([
    { $match: { orderId: new mongoose.Types.ObjectId(orderId) } },
    { $group: { _id: '$orderId', paid: { $sum: '$amount' } } },
  ]);
  return rows[0]?.paid || 0;
}

// Caja de totales
function drawTotalsBox(
  doc,
  { x, y, w, subtotal, discount, total, paid, paidBeforeThis, remaining, currentPayment }
) {
  const lh = 16;
  let yCur = y + 10;

  const row = (label, val, bold = false, color = '#111') => {
    doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(10).fillColor(color);
    doc.text(label, x + 10, yCur);
    doc.text(val, x, yCur, { width: w - 10, align: 'right' });
    yCur += lh;
  };

  // ahora calculamos la altura según las filas que realmente mostraremos
  const rowsCount = 6 + (currentPayment ? 1 : 0); // 3 superiores + 1 anticipo + 3 inferiores
  const h = rowsCount * lh + 16;
  doc.roundedRect(x, y, w, h, 8).lineWidth(1).strokeColor(THEME.border).stroke();

  row('Subtotal', money(subtotal));
  row(
    'Descuento aplicado',
    discount ? '-' + money(discount) : money(0),
    false,
    THEME.primaryDk
  );
  row('Total de la reserva', money(total), true);

  yCur += 6; // pequeño espacio

  // 🔹 Anticipo de ESTE recibo
  if (currentPayment != null && !Number.isNaN(Number(currentPayment))) {
    row('Anticipo de este recibo', money(currentPayment));
  }

  row('Pagado ANTES de este recibo', money(paidBeforeThis));
  row('Pagado acumulado', money(paid), true, THEME.primary);
  row('Saldo restante', money(remaining), true, remaining > 0 ? THEME.primaryDk : '#065f46');
}


/** ================== Export principal ================== */
async function streamReceiptPdf(res, receiptId) {
  const receipt = await Receipt.findById(receiptId);
  if (!receipt) {
    res.status(404).send('Recibo no encontrado');
    return;
  }

  const reserva = receipt.orderId ? await Reserva.findById(receipt.orderId) : null;

  // Datos reserva y recibo
  const folio = receipt.folio || (receipt._id ? String(receipt._id).slice(-6).toUpperCase() : '');
  const cliente = receipt.customerName || reserva?.cliente || 'Cliente';
  const tel = reserva?.telefono || '';
  const fechaEvento = reserva?.fecha ? fmtDate(reserva.fecha) : '';
  const horario =
    reserva?.horaInicio && reserva?.horaFin
      ? `${reserva.horaInicio}–${reserva.horaFin}`
      : '';
  const personas = Number(reserva?.cantidadPersonas || 0) || '';
  const tipoReserv = reserva?.tipoEvento || reserva?.tipoReserva || '';
  const metodo = (receipt.paymentMethod || '').toUpperCase();
  const amount = Number(receipt.amount || 0);
  const issuedAt = receipt.issuedAt ? fmtDate(receipt.issuedAt) : fmtDate(new Date());

  // Totales (usando virtuales de Reserva si existen)
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
    margins: { top: 36, left: 36, right: 36, bottom: 36 },
  });

  res.setHeader('Content-Type', 'application/pdf');
  const nameSafe = (cliente || 'cliente').replace(/[^\w\d\-_\. ]+/g, '').slice(0, 40);
  res.setHeader(
    'Content-Disposition',
    `inline; filename="Recibo-${folio}-${nameSafe}.pdf"`
  );

  doc.pipe(res);

  // ===== Layout base =====
  const pageW = doc.page.width;
  const pageH = doc.page.height;
  const contentX = 36 + 30; // margen izq + franja
  const contentW = pageW - contentX - 36 - 140; // deja espacio a la derecha para FOLIO

  drawSideTitle(doc, { text: 'EL TORO BRONCO REAL', x: 36, y: 36, h: pageH - 72 });

  drawLogoIfAny(
    doc,
    path.join(__dirname, '..', 'uploads', 'Nardeli-05.png'),
    contentX,
    36,
    90
  );

  doc
    .font('Helvetica-Bold')
    .fontSize(18)
    .fillColor(THEME.primaryDk)
    .text('RECIBO DE RESERVACIÓN', contentX + 100, 40);

  doc
    .font('Helvetica')
    .fontSize(10)
    .fillColor(THEME.muted)
    .text(`Emitido: ${issuedAt}`, contentX + 100, 64);

  // Id de reserva oculto
  // if (reserva?._id) { ... }

  drawFolioBox(doc, { folio, x: pageW - 36 - 120, y: 36 });

  doc
    .moveTo(contentX, 100)
    .lineTo(pageW - 36, 100)
    .strokeColor(THEME.border)
    .lineWidth(1)
    .stroke();

  // ===== Cuerpo tipo talonario =====
  let y = 116;

  // Nombre
  drawLabeledLine(doc, { label: 'Nombre:', value: cliente, x: contentX, y, w: contentW });
  y += 20;

  // Tipo de reservación
  drawLabeledLine(doc, {
    label: 'Tipo de reservación:',
    value: tipoReserv,
    x: contentX,
    y,
    w: contentW,
  });
  y += 20;

  // Número de personas
  drawLabeledLine(doc, {
    label: 'Número de personas:',
    value: personas ? String(personas) : '',
    x: contentX,
    y,
    w: contentW,
  });
  y += 20;

  // Hora de evento
  drawLabeledLine(doc, {
    label: 'Hora de evento:',
    value: horario,
    x: contentX,
    y,
    w: contentW,
  });
  y += 20;

  // Anticipo
  drawLabeledLine(doc, {
    label: 'Anticipo:',
    value: money(amount),
    x: contentX,
    y,
    w: contentW,
  });
  y += 20;

  // Teléfono
  drawLabeledLine(doc, {
    label: 'Teléfono:',
    value: tel,
    x: contentX,
    y,
    w: contentW,
  });
  y += 20;

  // Fecha del evento
  drawLabeledLine(doc, {
    label: 'Reservación para el día:',
    value: fechaEvento,
    x: contentX,
    y,
    w: contentW,
  });
  y += 26;

  // Método de pago
  doc.font('Helvetica-Bold').fontSize(10).fillColor(THEME.primaryDk).text('Método de pago:', contentX, y);
  const isEfectivo = metodo === 'EFECTIVO';
  const isVoucher = metodo === 'VOUCHER' || metodo === 'TARJETA' || metodo === 'TPV';
  const isTransfer = metodo === 'TRANSFERENCIA';

  let payX = contentX + 110;
  drawCheckbox(doc, { label: 'Efectivo', checked: isEfectivo, x: payX, y });
  payX += 90;
  drawCheckbox(doc, { label: 'Voucher', checked: isVoucher, x: payX, y });
  payX += 110;
  drawCheckbox(doc, { label: 'Transferencia', checked: isTransfer, x: payX, y });
  y += 28;

  // 🔴 QUITAMOS CONCEPTO (ya no se dibuja nada de receipt.concept)

  // Notas en formato de lista + política de fecha límite de pago
  const extraNote = 'La fecha límite de pago es 1 mes antes del evento.';
  const rawNotes = receipt.notes ? String(receipt.notes) : '';

  // Cortamos las notas por el separador "•" si viene así desde el backend
  const notePieces = rawNotes
    .split('•')
    .map((s) => s.trim())
    .filter(Boolean);

  // Agregamos siempre la leyenda de fecha límite
  notePieces.push(extraNote);

  // Título "Notas:"
  doc.font('Helvetica-Bold').fontSize(10).fillColor(THEME.primaryDk).text('Notas:', contentX, y);

  // Lista con bullets
  let listY = y;
  notePieces.forEach((p) => {
    doc
      .font('Helvetica')
      .fontSize(10)
      .fillColor('#000')
      .text(`• ${p}`, contentX + 80, listY, {
        width: pageW - (contentX + 80) - 36 - 6,
      });
    listY += 12;
  });


  

    // Línea gris debajo de las notas
  y = listY + 8;

  doc
    .moveTo(contentX, y)
    .lineTo(pageW - 36, y)
    .strokeColor(THEME.border)
    .lineWidth(1)
    .stroke();
  y += 14;

  // ===== Caja de Totales =====
  const totalsBoxW = Math.min(340, pageW - contentX - 36);
  const totalsBoxX = pageW - 36 - totalsBoxW;
  const totalsBoxY = y;

  drawTotalsBox(doc, {
    x: totalsBoxX,
    y: totalsBoxY,
    w: totalsBoxW,
    subtotal,
    discount,
    total,
    paid,
    paidBeforeThis,
    remaining,
    currentPayment: amount, 
  });

  // Altura del cuadro de totales (la misma que usamos dentro de drawTotalsBox)
  const rowsCount = 6 + (amount ? 1 : 0);
const totalsBoxH = rowsCount * 16 + 16;

  // Firmas A CONTINUACIÓN del cuadro, no a la par
  const leftW = totalsBoxX - contentX - 20;
  let yLeft = totalsBoxY + totalsBoxH + 20; // un margen debajo del cuadro

  drawLabeledLine(doc, {
    label: 'Le atendió:',
    value: receipt.issuedBy || '—',
    x: contentX,
    y: yLeft,
    w: leftW,
  });
  yLeft += 26;

  drawLabeledLine(doc, {
    label: 'Firma del cliente:',
    value: '',
    x: contentX,
    y: yLeft,
    w: leftW,
  });



  // Footer contacto
  doc.font('Helvetica').fontSize(9).fillColor('#6b7280');
  doc.text(
    'Tel: 656 682 4252   •   nardelicentrodeeventos@gmail.com',
    contentX,
    pageH - 50,
    { width: pageW - contentX - 36, align: 'right' }
  );

  doc.end();
}

module.exports = { streamReceiptPdf };
