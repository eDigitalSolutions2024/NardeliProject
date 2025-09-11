// services/reservaPdf.js
const PDFDocument = require('pdfkit');

/** === Helpers numéricos/formatos === **/
function money(n) {
  const v = Number(n);
  return Number.isFinite(v)
    ? v.toLocaleString('es-MX', { style: 'currency', currency: 'MXN', minimumFractionDigits: 2 })
    : '—';
}
function pct(n) {
  const v = Number(n);
  if (!Number.isFinite(v)) return '0%';
  const s = Math.round(v * 100) % 100 === 0 ? v.toFixed(0) : v.toFixed(2);
  return `${s}%`;
}
function ymd(d) {
  try { return new Date(d).toISOString().slice(0,10); } catch { return ''; }
}

/** === Paleta / fuentes === **/
const COLORS = {
  primary: '#7c3aed',
  primaryDark: '#5b21b6',
  primaryLight: '#a855f7',
  background: '#f8fafc',
  cardBg: '#ffffff',
  text: '#1e293b',
  textMuted: '#64748b',
  border: '#e2e8f0',
  tableZebra: '#f8fafc',
};
const FONTS = {
  tiny: 7,
  small: 8,
  base: 10,
  medium: 11,
  h2: 14,
  title: 22,
};

/** === Helpers de layout === **/
const sum = (arr) => arr.reduce((a, b) => a + b, 0);

function sectionTitle(doc, text, x, y, icon = null) {
  doc.fillColor(COLORS.text).font('Helvetica-Bold').fontSize(FONTS.h2);
  if (icon) {
    doc.save();
    doc.circle(x, y + 8, 8).fill(COLORS.primary);
    doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(FONTS.small);
    doc.text(icon, x - 3, y + 4);
    doc.restore();
    doc.fillColor(COLORS.text).font('Helvetica-Bold').fontSize(FONTS.h2);
    doc.text(text, x + 24, y);
    const tw = doc.widthOfString(text);
    doc.moveTo(x + 24, y + 18).lineTo(x + 24 + tw, y + 18)
      .strokeColor(COLORS.primary).lineWidth(2).stroke();
  } else {
    doc.text(text, x, y);
    const tw = doc.widthOfString(text);
    doc.moveTo(x, y + 18).lineTo(x + tw, y + 18)
      .strokeColor(COLORS.primary).lineWidth(2).stroke();
  }
  doc.fontSize(FONTS.base).fillColor(COLORS.text);
}

function drawCard(doc, { x, y, width, height, padding = 14 }) {
  doc.save();
  doc.rect(x + 2, y + 2, width, height).fill('#0000000A');
  doc.roundedRect(x, y, width, height, 8).fill(COLORS.cardBg).strokeColor(COLORS.border).stroke();
  doc.restore();
  return {
    x: x + padding,
    y: y + padding,
    w: width - padding * 2,
    h: height - padding * 2
  };
}

function labelValue(doc, { x, y, wLabel = 80, wValue = 180, label, value, boldValue = false }) {
  doc.font('Helvetica').fontSize(FONTS.base).fillColor(COLORS.textMuted);
  doc.text(label, x, y, { width: wLabel, lineBreak: false, ellipsis: true });
  doc.fillColor(COLORS.text).font(boldValue ? 'Helvetica-Bold' : 'Helvetica');
  doc.text(String(value ?? '—'), x + wLabel + 8, y, { width: wValue, lineBreak: false, ellipsis: true });
  const h1 = doc.heightOfString(label, { width: wLabel });
  const h2 = doc.heightOfString(String(value ?? '—'), { width: wValue });
  return Math.max(h1, h2);
}

/** === Tabla === **/
const HEADER_H = 28;
const ROW_H = 26;
const PADX = 10;

function drawTableHeader(doc, { x, y, widths, headers }) {
  doc.save();
  doc.roundedRect(x, y, sum(widths), HEADER_H, 6).fill(COLORS.primary);
  doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(FONTS.medium);
  let cx = x;
  headers.forEach((h, i) => {
    doc.text(h, cx + PADX, y + 7, {
      width: widths[i] - PADX * 2,
      align: i >= headers.length - 2 ? 'right' : 'left',
      lineBreak: false,
      ellipsis: true
    });
    cx += widths[i];
  });
  doc.restore();
  return y + HEADER_H;
}

function ensureSpace(doc, need, onNewPage) {
  const bottom = doc.page.height - doc.page.margins.bottom;
  if (doc.y + need > bottom) {
    doc.addPage();
    if (onNewPage) onNewPage();
  }
}

function drawTableRow(doc, { x, y, widths, values, zebra = false, isTotal = false }) {
  const w = sum(widths);
  doc.save();

  if (isTotal) {
    doc.roundedRect(x, y, w, ROW_H, 6).fill(COLORS.primary);
    doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(FONTS.medium);
  } else {
    if (zebra) {
      doc.rect(x, y, w, ROW_H).fill(COLORS.tableZebra);
    }
    doc.fillColor(COLORS.text).font('Helvetica').fontSize(FONTS.base);
  }

  let cx = x;
  values.forEach((v, i) => {
    const align = i >= values.length - 2 ? 'right' : 'left';
    doc.text(String(v ?? ''), cx + PADX, y + 6, {
      width: widths[i] - PADX * 2,
      align,
      lineBreak: false,
      ellipsis: true
    });
    cx += widths[i];
  });

  if (!isTotal) {
    doc.moveTo(x, y + ROW_H).lineTo(x + w, y + ROW_H)
      .strokeColor(COLORS.border).lineWidth(0.5).stroke();
  }

  doc.restore();
  return y + ROW_H;
}

/** === Cálculos de importes === **/
function precioFila(u, productosById) {
  if (Number.isFinite(u?.precio)) return Number(u.precio);
  const p = u?.itemId ? productosById.get(String(u.itemId)) : null;
  return Number.isFinite(p?.precio) ? Number(p.precio) : null;
}
function calcularSubTotal(utensilios, productosById) {
  return (Array.isArray(utensilios) ? utensilios : []).reduce((acc, u) => {
    const p = precioFila(u, productosById);
    const q = Number(u?.cantidad || 0);
    return acc + (Number.isFinite(p) ? (p * q) : 0);
  }, 0);
}
function calcularDescuento(subTotal, descuento) {
  const d = descuento || {};
  const tipo = d.tipo || 'monto';
  const valor = Number(d.valor || 0);
  if (!Number.isFinite(valor) || valor <= 0) return { tipo, valor, monto: 0 };
  if (tipo === 'porcentaje') {
    const pctVal = Math.max(0, Math.min(100, valor));
    const monto = Math.min(subTotal, subTotal * (pctVal / 100));
    return { tipo, valor: pctVal, monto };
  }
  const monto = Math.min(subTotal, Math.max(0, valor));
  return { tipo, valor, monto };
}

/** === Accesorios seleccionados (para contrato) === **/
function getAccesoriosSeleccionados(reserva) {
  const a1 = Array.isArray(reserva?.resumenSeleccion?.accesorios)
    ? reserva.resumenSeleccion.accesorios
    : [];
  if (a1.length) {
    return a1.map(a => ({
      nombre: a.nombre || 'Accesorio',
      categoria: a.categoria || 'Accesorio',
      unidad: a.unidad || 'pza',
      cantidad: Number(a.cantidad || 0),
      precioReposicion: Number(a.precioReposicion || 0),
    })).filter(x => x.cantidad > 0);
  }
  // Fallback: líneas de préstamo en utensilios
  const a2 = (reserva?.utensilios || [])
    .filter(u => u?.esPrestamo === true || String(u?.categoria || '').toLowerCase() === 'accesorio')
    .map(u => ({
      nombre: u.nombre || 'Accesorio',
      categoria: u.categoria || 'Accesorio',
      unidad: u.unidad || 'pza',
      cantidad: Number(u.cantidad || 0),
      precioReposicion: Number(u.precioReposicion || 0),
    }))
    .filter(x => x.cantidad > 0);
  return a2;
}

/** === Documento principal === **/
function streamReservaPDF(res, { reserva, productosById = new Map(), brand = {} }) {
  const MARGIN = 40;
  const PAGE_W = 595.28;
  const CONTENT_W = PAGE_W - MARGIN * 2;
  const X = MARGIN;

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="Reserva-${reserva?._id || 'N'}.pdf"`);

  const doc = new PDFDocument({ size: 'A4', margin: MARGIN, bufferPages: true });
  doc.pipe(res);

  /** Encabezado **/
  const headerH = 64;
  const topY = doc.y - 20;
  doc.save();
  doc.roundedRect(X - 20, topY, CONTENT_W + 40, headerH, 12).fill(COLORS.primary);
  doc.fill('#ffffff').font('Helvetica-Bold').fontSize(FONTS.title);
  doc.text(brand.title || 'Nardeli', X, topY + 10);
  doc.font('Helvetica').fontSize(FONTS.h2);

  const esCotizacion = (reserva?.tipoReserva || 'evento') === 'cotizacion';
  const subtitulo = esCotizacion ? 'Cotización' : 'Confirmación de Reserva';
  doc.text(subtitulo, X, topY + 36);
  doc.restore();

  doc.moveDown();
  doc.y = topY + headerH + 18;

  /** Tarjetas: cliente / evento **/
  const cardH = 110;
  const cardY = doc.y;

  const c1 = drawCard(doc, { x: X, y: cardY, width: (CONTENT_W - 20) / 2, height: cardH });
  sectionTitle(doc, 'Cliente', c1.x, c1.y, '👤');
  let y1 = c1.y + 22;
  y1 += labelValue(doc, { x: c1.x, y: y1, label: 'Nombre:', value: reserva?.cliente, wLabel: 65, wValue: c1.w - 65 - 8, boldValue: true }) + 6;
  y1 += labelValue(doc, { x: c1.x, y: y1, label: 'Correo:', value: reserva?.correo, wLabel: 65, wValue: c1.w - 65 - 8 }) + 6;
  y1 += labelValue(doc, { x: c1.x, y: y1, label: 'Teléfono:', value: reserva?.telefono, wLabel: 65, wValue: c1.w - 65 - 8 }) + 6;

  const c2 = drawCard(doc, { x: X + (CONTENT_W + 20) / 2, y: cardY, width: (CONTENT_W - 20) / 2, height: cardH });
  sectionTitle(doc, 'Evento', c2.x, c2.y, '🎉');
  let y2 = c2.y + 22;
  const fechaTxt = reserva?.fecha
    ? new Date(reserva.fecha).toLocaleDateString('es-MX', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
    : '—';
  y2 += labelValue(doc, { x: c2.x, y: y2, label: 'Tipo:', value: reserva?.tipoEvento, wLabel: 65, wValue: c2.w - 65 - 8, boldValue: true }) + 6;
  y2 += labelValue(doc, { x: c2.x, y: y2, label: 'Fecha:', value: fechaTxt, wLabel: 65, wValue: c2.w - 65 - 8 }) + 6;
  y2 += labelValue(doc, { x: c2.x, y: y2, label: 'Horario:', value: `${reserva?.horaInicio || '—'} – ${reserva?.horaFin || '—'}`, wLabel: 65, wValue: c2.w - 65 - 8 }) + 6;

  doc.y = cardY + cardH + 12;

  /** ID de reserva **/
  const idCard = drawCard(doc, { x: X, y: doc.y, width: CONTENT_W, height: 40 });
  doc.fillColor(COLORS.primary).font('Helvetica-Bold').fontSize(FONTS.medium);
  doc.text('ID de Reserva:', idCard.x, idCard.y + 8, { lineBreak: false, ellipsis: true });
  doc.fillColor(COLORS.text).font('Helvetica-Bold').fontSize(FONTS.h2);
  doc.text(`#${String(reserva?._id || 'N/A').slice(-8).toUpperCase()}`, idCard.x + 110, idCard.y + 6, { lineBreak: false, ellipsis: true });
  doc.y = idCard.y + 48;

  /** Notas (si hay) **/
  if (reserva?.descripcion && String(reserva.descripcion).trim()) {
    const notes = String(reserva.descripcion).trim();
    const h = Math.max(60, doc.heightOfString(notes, { width: CONTENT_W - 28 }) + 28);
    const nCard = drawCard(doc, { x: X, y: doc.y, width: CONTENT_W, height: h });
    sectionTitle(doc, 'Notas', nCard.x, nCard.y, '📝');
    doc.font('Helvetica').fontSize(FONTS.base).fillColor(COLORS.text);
    doc.text(notes, nCard.x, nCard.y + 20, { width: nCard.w, lineGap: 2 });
    doc.y = nCard.y + h - 12;
  }

  /** Tabla de utensilios **/
  doc.moveDown();
  sectionTitle(doc, 'Utensilios / Servicios', X, doc.y, '🍽️');
  doc.y += 14;

  const lista = Array.isArray(reserva?.utensilios) ? reserva.utensilios : [];

  const showPrices = lista.some((u) => Number.isFinite(precioFila(u, productosById)));

  const widths = showPrices
    ? [200, 90, 60, 55, 85, 85]
    : [280, 120, 80, 85];

  const headers = showPrices
    ? ['Nombre', 'Categoría', 'Unidad', 'Cant.', 'P. Unit.', 'Importe']
    : ['Nombre', 'Categoría', 'Unidad', 'Cant.'];

  const gap = CONTENT_W - sum(widths);
  if (Math.abs(gap) > 1) widths[0] += gap;

  const tableStartY = drawTableHeader(doc, { x: X, y: doc.y, widths, headers });
  let y = tableStartY;

  function printHeaderOnNewPage() {
    doc.y = doc.page.margins.top;
    sectionTitle(doc, 'Utensilios / Servicios', X, doc.y, '🍽️');
    doc.y += 14;
    y = drawTableHeader(doc, { x: X, y: doc.y, widths, headers });
  }

  let subTotal = 0;
  lista.forEach((u, i) => {
    const prod = u?.itemId ? productosById.get(String(u.itemId)) : null;
    const nombre = u?.nombre || prod?.nombre || '—';
    const categoria = u?.categoria || 'General';
    const unidad = u?.unidad || 'pza';
    const cant = Number(u?.cantidad || 0);
    const pu = precioFila(u, productosById);
    const importe = Number.isFinite(pu) ? pu * cant : null;
    if (Number.isFinite(importe)) subTotal += importe;

    const rowValues = showPrices
      ? [nombre, categoria, unidad, String(cant), Number.isFinite(pu) ? money(pu) : '—', Number.isFinite(importe) ? money(importe) : '—']
      : [nombre, categoria, unidad, String(cant)];

    ensureSpace(doc, ROW_H + 20, printHeaderOnNewPage);
    y = drawTableRow(doc, { x: X, y, widths, values: rowValues, zebra: i % 2 === 1 });
    doc.y = y;
  });

  let descuentoInfo = { tipo: 'monto', valor: 0, monto: 0 };
  let total = subTotal;

  if (showPrices) {
    const d = reserva?.precios?.descuento || reserva?.descuento;
    descuentoInfo = calcularDescuento(subTotal, d);
    total = Math.max(0, subTotal - descuentoInfo.monto);

    const totalsWidths = widths.slice();
    const labelColSpan = totalsWidths.length - 2;
    const labelWidth = sum(totalsWidths.slice(0, labelColSpan));
    const lastTwo = totalsWidths.slice(labelColSpan);
    const merged = [labelWidth, ...lastTwo];

    const subtotalRow = ['', 'SUBTOTAL', money(subTotal)];
    ensureSpace(doc, ROW_H + 6, printHeaderOnNewPage);
    y = drawTableRow(doc, { x: X, y: y + 6, widths: merged, values: subtotalRow });

    const descLabel = descuentoInfo.tipo === 'porcentaje'
      ? `DESCUENTO (${pct(descuentoInfo.valor)})`
      : 'DESCUENTO';
    const descRow = ['', descLabel, `-${money(descuentoInfo.monto)}`];
    ensureSpace(doc, ROW_H + 4, printHeaderOnNewPage);
    y = drawTableRow(doc, { x: X, y, widths: merged, values: descRow });

    const totalRow = ['', 'TOTAL', money(total)];
    ensureSpace(doc, ROW_H + 10, printHeaderOnNewPage);
    y = drawTableRow(doc, { x: X, y, widths: merged, values: totalRow, isTotal: true });

    doc.y = y + 10;

    const summaryW = 260;
    const summaryH = 90;
    const sx = X + CONTENT_W - summaryW;
    ensureSpace(doc, summaryH + 16, () => {});
    const s = drawCard(doc, { x: sx, y: doc.y, width: summaryW, height: summaryH });
    doc.font('Helvetica-Bold').fontSize(FONTS.medium).fillColor(COLORS.primary);
    doc.text('Resumen de totales', s.x, s.y, { lineBreak: false, ellipsis: true });
    doc.font('Helvetica').fontSize(FONTS.base).fillColor(COLORS.text);

    const lineY = s.y + 24;
    doc.text('Subtotal', s.x, lineY, { width: s.w / 2, lineBreak: false, ellipsis: true });
    doc.text(money(subTotal), s.x + s.w / 2, lineY, { width: s.w / 2, align: 'right', lineBreak: false, ellipsis: true });

    const lineY2 = lineY + 16;
    const dText = descuentoInfo.tipo === 'porcentaje'
      ? `Descuento (${pct(descuentoInfo.valor)})`
      : 'Descuento';
    doc.text(dText, s.x, lineY2, { width: s.w / 2, lineBreak: false, ellipsis: true });
    doc.text(`-${money(descuentoInfo.monto)}`, s.x + s.w / 2, lineY2, { width: s.w / 2, align: 'right', lineBreak: false, ellipsis: true });

    const lineY3 = lineY2 + 16;
    doc.font('Helvetica-Bold');
    doc.text('Total', s.x, lineY3, { width: s.w / 2, lineBreak: false, ellipsis: true });
    doc.text(money(total), s.x + s.w / 2, lineY3, { width: s.w / 2, align: 'right', lineBreak: false, ellipsis: true });

    doc.y = s.y + summaryH + 8;

    doc.font('Helvetica').fontSize(FONTS.small).fillColor(COLORS.textMuted);
    const note = esCotizacion
      ? '* Esta es una cotización. Precios sujetos a cambio hasta su confirmación.'
      : '* Precios estimados sujetos a confirmación. Pueden aplicar cargos adicionales por servicios extras.';
    doc.text(note, X, doc.y, { width: CONTENT_W, align: 'right' });
    doc.y += 10;
  }

  /** Información y condiciones **/
  doc.moveDown();
  const bulletsBase = [
    '• Confirme su evento con al menos 48 horas de anticipación.',
    '• Utensilios y equipo deben devolverse en las mismas condiciones.',
    '• Cambios o cancelaciones: 24 horas de anticipación.',
  ];

  const descBullets = [];
  (lista || []).forEach(u => {
    const p = u?.itemId ? productosById.get(String(u.itemId)) : null;
    const d = (u?.descripcion && String(u.descripcion).trim()) || (p?.descripcion && String(p.descripcion).trim());
    if (d) {
      const name = u?.nombre || p?.nombre || 'Ítem';
      descBullets.push(`• ${name}: ${d}`);
    }
  });

  const infoText = [...bulletsBase, ...descBullets].join('\n');
  const infoH = Math.max(70, doc.heightOfString(infoText, { width: CONTENT_W - 24 }) + 26);
  ensureSpace(doc, infoH + 20, () => {});
  const infoCard = drawCard(doc, { x: X, y: doc.y, width: CONTENT_W, height: infoH });
  doc.fillColor(COLORS.primaryLight).font('Helvetica-Bold').fontSize(FONTS.medium);
  doc.text('Información Importante', infoCard.x, infoCard.y -15 , { lineBreak: false, ellipsis: true });
  doc.font('Helvetica').fontSize(FONTS.small).fillColor(COLORS.text);
  doc.text(infoText, infoCard.x, infoCard.y + 5, { width: infoCard.w, lineGap: 2 });

  // === NUEVO: Contrato de accesorios en préstamo ===
  doc.y = infoCard.y + infoH + 14;

  const accSel = getAccesoriosSeleccionados(reserva);
  if (accSel.length > 0) {
    // Título
    ensureSpace(doc, 40, () => {});
    sectionTitle(doc, 'Accesorios en préstamo (Contrato)', X, doc.y, '🧾');
    doc.y += 14;

    // Tabla de accesorios
    const hasRepos = accSel.some(a => Number(a.precioReposicion) > 0);
    let accHeaders = hasRepos
      ? ['Accesorio','Cant.', 'Unidad', 'Reposición']
      : ['Accesorio', 'Cant.', 'Unidad' ];
    let accWidths = hasRepos
      ? [CONTENT_W - 240, 60, 80, 100]
      : [CONTENT_W - 160, 60, 80];

    const gapAcc = CONTENT_W - sum(accWidths);
    if (Math.abs(gapAcc) > 1) accWidths[0] += gapAcc;

    const printAccHeader = () => {
      doc.y = doc.page.margins.top;
      sectionTitle(doc, 'Accesorios en préstamo (Contrato)', X, doc.y, '🧾');
      doc.y += 14;
      yAcc = drawTableHeader(doc, { x: X, y: doc.y, widths: accWidths, headers: accHeaders });
    };

    let yAcc = drawTableHeader(doc, { x: X, y: doc.y, widths: accWidths, headers: accHeaders });

    accSel.forEach((a, i) => {
      const values = hasRepos
        ? [a.nombre, String(a.cantidad),a.unidad || 'pza',  Number(a.precioReposicion) > 0 ? money(a.precioReposicion) : '—']
        : [a.nombre, String(a.cantidad),a.unidad || 'pza' ];
      ensureSpace(doc, ROW_H + 10, printAccHeader);
      yAcc = drawTableRow(doc, { x: X, y: yAcc, widths: accWidths, values, zebra: i % 2 === 1 });
      doc.y = yAcc;
    });

    // Texto legal de responsabilidad
    const contratoText =
      'Declaro haber recibido los accesorios arriba listados en calidad de préstamo, sin costo de renta. ' +
      'Me comprometo a devolverlos en el mismo estado en que fueron entregados. ' +
      'En caso de daño, pérdida o faltante, AUTORIZO el cobro del costo de reposición correspondiente ' +
      'según precios vigentes, así como cualquier gasto derivado de su sustitución o reparación.';

    const contratoH = Math.max(70, doc.heightOfString(contratoText, { width: CONTENT_W - 24 }) + 26);
    ensureSpace(doc, contratoH + 20, () => {});
    const contratoCard = drawCard(doc, { x: X, y: doc.y + 8, width: CONTENT_W, height: contratoH });
    doc.font('Helvetica-Bold').fontSize(FONTS.medium).fillColor(COLORS.primary);
    doc.text('Acuerdo de Responsabilidad', contratoCard.x, contratoCard.y -15, { lineBreak: false, ellipsis: true });
    doc.font('Helvetica').fontSize(FONTS.base).fillColor(COLORS.text);
    doc.text(contratoText, contratoCard.x, contratoCard.y + 5, { width: contratoCard.w, lineGap: 2 });

    // Bloque de firmas
    const firmasH = 120;
    ensureSpace(doc, firmasH + 10, () => {});
    const fy = contratoCard.y + contratoH + 16;
    const colW = (CONTENT_W - 40) / 2;

    // Línea cliente
    const clienteX = X;
    const clienteLineW = colW;
    const lineY = fy + 50;
    doc.moveTo(clienteX, lineY).lineTo(clienteX + clienteLineW, lineY)
      .strokeColor(COLORS.border).lineWidth(1).stroke();
    doc.font('Helvetica').fontSize(FONTS.small).fillColor(COLORS.text);
    doc.text('Nombre y firma del cliente', clienteX, lineY + 4, { width: clienteLineW, align: 'center' });

    // Línea empresa
    const empX = X + colW + 40;
    doc.moveTo(empX, lineY).lineTo(empX + clienteLineW, lineY)
      .strokeColor(COLORS.border).lineWidth(1).stroke();
    doc.font('Helvetica').fontSize(FONTS.small);
    doc.text('Representante de Nardeli', empX, lineY + 4, { width: clienteLineW, align: 'center' });

    // Fecha
    const fechaLblY = lineY + 34;
    const fechaW = 160;
    doc.text(`Fecha: ${ymd(new Date())}`, clienteX, fechaLblY, { width: 40 });
    doc.moveTo(clienteX + 40, fechaLblY + 10).lineTo(clienteX + 40 + fechaW, fechaLblY + 10)
      .strokeColor(COLORS.border).lineWidth(1).stroke();
    doc.font('Helvetica').fontSize(FONTS.small).fillColor(COLORS.textMuted);
    doc.text(`Sugerido: ${ymd(new Date())}`, clienteX + 42, fechaLblY + 12, { width: fechaW });

    doc.y = fechaLblY + 36;
  }

  /** Pie **/
  const footerY = doc.page.height - doc.page.margins.bottom + 12;
  doc.moveTo(X, footerY - 6).lineTo(X + CONTENT_W, footerY - 6)
    .strokeColor(COLORS.primary).lineWidth(2).stroke();
  doc.font('Helvetica-Bold').fontSize(FONTS.small).fillColor(COLORS.primary);
  doc.text(brand.footer || 'Nardeli - Salón de Eventos', X, footerY + 2, { lineBreak: false, ellipsis: true });
  doc.font('Helvetica').fontSize(FONTS.tiny).fillColor(COLORS.textMuted);
  doc.text('contacto@nardeli.mx • +52 000 000 0000', X, footerY + 14, { lineBreak: false, ellipsis: true });

  doc.end();
}

module.exports = { streamReservaPDF };
