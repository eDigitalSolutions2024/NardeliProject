// backend/services/reservaPdf.js
const PDFDocument = require('pdfkit');

function money(n) {
  return Number.isFinite(n)
    ? n.toLocaleString('es-MX', { style: 'currency', currency: 'MXN', minimumFractionDigits: 2 })
    : '—';
}
const sum = (arr) => arr.reduce((a, b) => a + b, 0);

// ======= Estilos de marca (ajusta a tu gusto) =======
const COLORS = {
  brand: '#ab38d8ff',         // banda superior (tu celeste)
  text: '#111111',
  mute: '#6b7280',          // gris etiquetas
  tableHeadBg: '#f3f4f6',
  zebra: '#fafafa',
  border: '#e5e7eb',
  noteBg: '#f9fafb',
  totalBg: '#eef2ff',
  totalText: '#1f2937'
};
const FONTS = {
  base: 10,
  small: 8,
  h1: 16,
  h2: 12
};

// ======= Helpers de dibujo =======
function labelValue(doc, { x, y, wLabel = 85, wValue = 180, label, value }) {
  doc.font('Helvetica').fontSize(FONTS.base).fillColor(COLORS.mute);
  doc.text(label, x, y, { width: wLabel });
  doc.fillColor(COLORS.text).font('Helvetica-Bold');
  doc.text(value ?? '—', x + wLabel + 8, y, { width: wValue });
  return Math.max(
    doc.heightOfString(label, { width: wLabel }),
    doc.heightOfString(String(value ?? '—'), { width: wValue })
  );
}

function sectionTitle(doc, text, x, y) {
  doc.fillColor(COLORS.text).font('Helvetica-Bold').fontSize(FONTS.h2);
  doc.text(text, x, y);
  doc.fontSize(FONTS.base);
}

function drawHeaderRow(doc, { x, y, widths, headers }) {
  const H = 22;
  doc.save();
  doc.roundedRect(x, y, sum(widths), H, 6).fill(COLORS.tableHeadBg);
  doc.fillColor(COLORS.text).font('Helvetica-Bold').fontSize(FONTS.base);

  let cx = x;
  headers.forEach((h, i) => {
    doc.text(h, cx + 10, y + 6, {
      width: widths[i] - 20,
      align: i >= headers.length - 2 ? 'right' : 'left'
    });
    cx += widths[i];
  });
  doc.restore();
  return y + H;
}

function drawRow(doc, { x, y, widths, values, zebra = false }) {
  const PADX = 10, PADY = 6;
  const heights = values.map((v, i) =>
    doc.heightOfString(String(v ?? ''), { width: widths[i] - PADX * 2 })
  );
  const rowH = Math.max(20, ...heights) + PADY * 2;

  // salto de página
  if (y + rowH > doc.page.height - doc.page.margins.bottom - 60) {
    doc.addPage();
    return drawRow(doc, { x, y: doc.y, widths, values, zebra }); // recursivo en nueva página
  }

  doc.save();
  if (zebra) doc.rect(x, y, sum(widths), rowH).fill(COLORS.zebra);

  let cx = x;
  doc.fillColor(COLORS.text).font('Helvetica').fontSize(FONTS.base);
  values.forEach((val, i) => {
    doc.text(String(val ?? ''), cx + PADX, y + PADY, {
      width: widths[i] - PADX * 2,
      align: i >= values.length - 2 ? 'right' : 'left'
    });
    cx += widths[i];
  });

  // línea inferior
  doc.moveTo(x, y + rowH).lineTo(x + sum(widths), y + rowH).strokeColor(COLORS.border).lineWidth(0.7).stroke();
  doc.restore();
  return y + rowH;
}

// ======= Generación principal =======
function streamReservaPDF(res, { reserva, productosById = new Map(), brand = {} }) {
  const MARGIN = 40;
  const PAGE_W = 595.28;
  const CONTENT_W = PAGE_W - MARGIN * 2;
  const startX = MARGIN;

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="Reserva-${reserva?._id || 'N'}.pdf"`);

  const doc = new PDFDocument({ size: 'A4', margin: MARGIN, bufferPages: true });
  doc.pipe(res);

  // ===== Encabezado =====
  const topY = MARGIN - 18;
  doc.save();
  doc.roundedRect(MARGIN, topY, CONTENT_W, 28, 6).fill(COLORS.brand);
  doc.fill('#ffffff').font('Helvetica-Bold').fontSize(FONTS.h1);
  doc.text(`${brand.title || 'Nardeli'} · Confirmación de Reserva`, MARGIN + 14, topY + 7);
  doc.restore();

  // Logo opcional (si pasas brand.logoPath con ruta absoluta/valida)
  // try { doc.image(brand.logoPath, PAGE_W - MARGIN - 90, topY - 2, { width: 88 }); } catch (_) {}

  doc.moveDown(1.2);

  // ===== Datos en dos columnas =====
  const col1x = startX, col2x = startX + CONTENT_W / 2 + 10;
  let y1 = doc.y, y2 = doc.y;

  y1 += labelValue(doc, { x: col1x, y: y1, label: 'Reserva ID', value: String(reserva?._id || '—') }) + 8;
  y1 += labelValue(doc, { x: col1x, y: y1, label: 'Cliente', value: reserva?.cliente }) + 8;
  y1 += labelValue(doc, { x: col1x, y: y1, label: 'Correo', value: reserva?.correo }) + 8;

  const fechaTxt = reserva?.fecha ? new Date(reserva.fecha).toLocaleDateString('es-MX') : '—';
  y2 += labelValue(doc, { x: col2x, y: y2, label: 'Tipo de evento', value: reserva?.tipoEvento }) + 8;
  y2 += labelValue(doc, { x: col2x, y: y2, label: 'Fecha', value: fechaTxt }) + 8;
  y2 += labelValue(doc, { x: col2x, y: y2, label: 'Horario', value: `${reserva?.horaInicio || '—'} - ${reserva?.horaFin || '—'}` }) + 8;
  y2 += labelValue(doc, { x: col2x, y: y2, label: 'Teléfono', value: reserva?.telefono }) + 8;

  const afterInfoY = Math.max(y1, y2) + 6;

  // ===== Notas (panel) =====
  if (reserva?.descripcion) {
    const panelH = Math.max(
      40,
      doc.heightOfString(reserva.descripcion, { width: CONTENT_W - 16 }) + 20
    );
    doc.save();
    doc.roundedRect(startX, afterInfoY, CONTENT_W, panelH, 8).fill(COLORS.noteBg);
    doc.fillColor(COLORS.text).font('Helvetica-Bold').fontSize(FONTS.h2)
      .text('Notas', startX + 12, afterInfoY + 10);
    doc.font('Helvetica').fontSize(FONTS.base).fillColor(COLORS.text)
      .text(reserva.descripcion, startX + 12, afterInfoY + 30, { width: CONTENT_W - 24 });
    doc.restore();
  }

  let y = reserva?.descripcion ? afterInfoY +  (doc.heightOfString(reserva.descripcion, { width: CONTENT_W - 16 }) + 40) : afterInfoY + 10;
  y += 8;

  // ===== Tabla =====
  sectionTitle(doc, 'Utensilios seleccionados', startX, y);
  y = doc.y + 8;

  const lista = Array.isArray(reserva?.utensilios) ? reserva.utensilios : [];
  const showPrices = lista.some(u => {
    const p = u.itemId && productosById.get(String(u.itemId));
    return Number.isFinite(p?.precio);
  });

  const widths = showPrices ? [240, 110, 60, 50, 70, 65] : [300, 140, 70, 60];
  const headers = showPrices
    ? ['Nombre', 'Categoría', 'Unidad', 'Cant.', 'P. Unit.', 'Total']
    : ['Nombre', 'Categoría', 'Unidad', 'Cant.'];

  y = drawHeaderRow(doc, { x: startX, y, widths, headers });

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

  // ===== Total destacado =====
  if (showPrices) {
    const boxW = 220, boxH = 46, boxX = startX + CONTENT_W - boxW, boxY = y + 10;
    doc.save();
    doc.roundedRect(boxX, boxY, boxW, boxH, 8).fill(COLORS.totalBg);
    doc.fillColor(COLORS.totalText).font('Helvetica-Bold').fontSize(FONTS.h2)
      .text(`TOTAL`, boxX + 14, boxY + 10);
    doc.font('Helvetica-Bold').fontSize(FONTS.h2)
      .text(money(grandTotal), boxX + 14, boxY + 10, { width: boxW - 28, align: 'right' });
    doc.font('Helvetica').fontSize(FONTS.small).fillColor(COLORS.mute)
      .text('Precios referenciales, confirmar con administración.', boxX + 14, boxY + 28, { width: boxW - 28, align: 'right' });
    doc.restore();
  } else {
    doc.moveDown(0.6);
    doc.font('Helvetica').fontSize(FONTS.small).fillColor(COLORS.mute)
      .text('Sin precios: se muestra solo el desglose de utensilios seleccionados.', { width: CONTENT_W })
      .fillColor(COLORS.text);
  }

  // ===== Pie de página: contacto + paginación =====
  const pageRange = doc.bufferedPageRange();
  for (let i = 0; i < pageRange.count; i++) {
    doc.switchToPage(i);
    const footerY = doc.page.height - doc.page.margins.bottom + 8;
    doc.font('Helvetica').fontSize(FONTS.small).fillColor(COLORS.mute);
    const contacto = brand.footer || 'Nardeli · contacto@nardeli.mx · +52 000 000 0000';
    doc.text(contacto, startX, footerY, { width: CONTENT_W / 2 });
    doc.text(`Página ${i + 1} de ${pageRange.count}`, startX, footerY, { width: CONTENT_W, align: 'right' });
  }

  doc.end();
}

module.exports = { streamReservaPDF };
