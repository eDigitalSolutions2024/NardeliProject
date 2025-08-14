// backend/services/reservaPdf.js
const PDFDocument = require('pdfkit');

function money(n) {
  return Number.isFinite(n)
    ? n.toLocaleString('es-MX', { style: 'currency', currency: 'MXN', minimumFractionDigits: 2 })
    : '—';
}
const sum = (arr) => arr.reduce((a, b) => a + b, 0);

function drawHeaderRow(doc, { x, y, widths, headers }) {
  const H = 20;
  doc.save();
  doc.rect(x, y, sum(widths), H).fill('#f3f4f6').fillColor('#000');

  let cx = x;
  doc.font('Helvetica-Bold').fontSize(10);
  headers.forEach((h, i) => {
    doc.text(h, cx + 6, y + 5, {
      width: widths[i] - 12,
      align: i >= headers.length - 2 ? 'right' : 'left',
    });
    cx += widths[i];
  });

  doc.moveTo(x, y + H).lineTo(x + sum(widths), y + H).strokeColor('#ddd').stroke();
  doc.restore();
}

function drawRow(doc, { x, y, widths, values, zebra = false }) {
  const PAD = 6;
  doc.save();

  // alto dinámico por contenido
  const heights = values.map((val, i) => {
    const cellW = widths[i] - PAD * 2;
    return doc.heightOfString(String(val ?? ''), {
      width: cellW,
      align: i >= values.length - 2 ? 'right' : 'left',
    }) + PAD * 2;
  });
  let rowH = Math.max(18, ...heights);

  // salto de página si no cabe
  if (y + rowH > doc.page.height - 60) {
    doc.addPage();
    y = 50;
  }

  // zebra
  if (zebra) doc.rect(x, y, sum(widths), rowH).fill('#fafafa');

  // texto celda por celda
  let cx = x;
  doc.fillColor('#000').font('Helvetica').fontSize(10);
  values.forEach((val, i) => {
    doc.text(String(val ?? ''), cx + PAD, y + PAD, {
      width: widths[i] - PAD * 2,
      align: i >= values.length - 2 ? 'right' : 'left',
    });
    cx += widths[i];
  });

  doc.moveTo(x, y + rowH).lineTo(x + sum(widths), y + rowH).strokeColor('#eee').stroke();
  doc.restore();
  return y + rowH;
}

/**
 * Genera y envía el PDF al response (stream).
 * @param {object} res - Express Response
 * @param {object} options
 * @param {object} options.reserva - Documento de la reserva (lean)
 * @param {Map<string,object>} [options.productosById] - Map _id -> { nombre, precio }
 */
function streamReservaPDF(res, { reserva, productosById = new Map() }) {
  const MARGIN = 40;
  const PAGE_W = 595.28;
  const CONTENT_W = PAGE_W - MARGIN * 2;
  const startX = MARGIN;

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="Reserva-${reserva?._id || 'N'}.pdf"`);

  const doc = new PDFDocument({ size: 'A4', margin: MARGIN, bufferPages: true });
  doc.pipe(res);

  // Barra de título
  const PURPLE = '#813eeeff';
  doc.save();
  doc.rect(MARGIN, MARGIN - 25, CONTENT_W, 24).fill(PURPLE);
  doc.fill('#fff').font('Helvetica-Bold').fontSize(13)
    .text('Nardeli · Confirmación de Reserva', MARGIN + 12, MARGIN - 22);
  doc.restore();

  // Bloque de datos
  const textBlock = (label, value) => {
    doc.font('Helvetica').fontSize(10).fillColor('#000')
      .text(`${label}: ${value || '—'}`, { width: CONTENT_W });
  };

  doc.moveDown(1.2);
  textBlock('Reserva ID', reserva?._id);
  textBlock('Cliente', reserva?.cliente);
  textBlock('Correo', reserva?.correo);
  textBlock('Tipo de evento', reserva?.tipoEvento);
  textBlock('Fecha', reserva?.fecha ? new Date(reserva.fecha).toLocaleDateString('es-MX') : '—');
  textBlock('Horario', `${reserva?.horaInicio || '—'} - ${reserva?.horaFin || '—'}`);
  textBlock('Teléfono', reserva?.telefono);

  if (reserva?.descripcion) {
    doc.moveDown(0.5);
    doc.font('Helvetica-Bold').text('Notas', { continued: false });
    doc.font('Helvetica').text(reserva.descripcion, { width: CONTENT_W });
  }

  doc.moveDown(1);

  // Tabla
  const lista = Array.isArray(reserva?.utensilios) ? reserva.utensilios : [];
  const showPrices = lista.some(u => {
    const p = u.itemId && productosById.get(String(u.itemId));
    return Number.isFinite(p?.precio);
  });

  const widths = showPrices ? [220, 110, 60, 50, 70, 80] : [260, 140, 70, 60];
  const headers = showPrices
    ? ['Nombre', 'Categoría', 'Unidad', 'Cant.', 'P. Unit.', 'Total']
    : ['Nombre', 'Categoría', 'Unidad', 'Cant.'];

  let y = doc.y + 8;
  doc.font('Helvetica-Bold').fontSize(12).text('Utensilios seleccionados', startX, y);
  y = doc.y + 6;

  drawHeaderRow(doc, { x: startX, y, widths, headers });
  y += 22;

  let grandTotal = 0;

  lista.forEach((u, idx) => {
    const prod = u.itemId && productosById.get(String(u.itemId));
    const pu = Number.isFinite(prod?.precio) ? prod.precio : null;
    const cant = Number(u.cantidad || 0);
    const sub = Number.isFinite(pu) ? pu * cant : null;
    if (Number.isFinite(sub)) grandTotal += sub;

    const row = showPrices
      ? [u.nombre || prod?.nombre || '—', u.categoria || 'general', u.unidad || 'pza', String(cant), money(pu), money(sub)]
      : [u.nombre || prod?.nombre || '—', u.categoria || 'general', u.unidad || 'pza', String(cant)];

    y = drawRow(doc, { x: startX, y, widths, values: row, zebra: idx % 2 === 1 });
  });

  if (showPrices) {
    doc.moveDown(0.6);
    doc.font('Helvetica-Bold').fontSize(11)
      .text(`TOTAL: ${money(grandTotal)}`, MARGIN, doc.y, { width: CONTENT_W, align: 'right' });
    doc.font('Helvetica').fontSize(8).fillColor('#666')
      .text('Los precios mostrados son referenciales; favor de confirmar con administración.', {
        width: CONTENT_W, align: 'right',
      })
      .fillColor('#000');
  } else {
    doc.moveDown(0.6);
    doc.font('Helvetica').fontSize(9).fillColor('#666')
      .text('Sin precios: se muestra solo el desglose de utensilios seleccionados.', { width: CONTENT_W })
      .fillColor('#000');
  }

  // Paginación
  const pageCount = doc.bufferedPageRange().count;
  for (let i = 0; i < pageCount; i++) {
    doc.switchToPage(i);
    doc.font('Helvetica').fontSize(8).fillColor('#666')
      .text(`Página ${i + 1} de ${pageCount}`, MARGIN, doc.page.height - MARGIN + 10, {
        width: CONTENT_W, align: 'right',
      })
      .fillColor('#000');
  }

  doc.end();
}

module.exports = { streamReservaPDF };
