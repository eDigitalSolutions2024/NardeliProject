const PDFDocument = require('pdfkit');

const PRIMARY = '#6d28d9';
const GREEN   = '#b7db2d';
const MUTED   = '#64748b';
const BORDER  = '#e2e8f0';

const M = 40; // margin

// ── helpers ──────────────────────────────────────────────────────────────
function chk(v) { return v ? '☑' : '☐'; }

function extrasSection(doc, extras) {
  if (!Array.isArray(extras) || extras.length === 0) return;
  const filled = extras.filter(e => e.label || e.value);
  if (!filled.length) return;
  sectionHeader(doc, 'Campos adicionales');
  for (let i = 0; i < filled.length; i += 2) {
    if (filled[i + 1]) {
      fieldPair(doc, filled[i].label || '—', filled[i].value, filled[i + 1].label || '—', filled[i + 1].value);
    } else {
      field(doc, filled[i].label || '—', filled[i].value, { fullWidth: true });
    }
  }
}

function pageTitle(doc, text) {
  doc.rect(0, 0, doc.page.width, 52).fill(PRIMARY);
  doc.font('Helvetica-Bold').fontSize(20).fillColor('#fff');
  doc.text('NARDELI CENTRO DE EVENTOS', M, 10, { align: 'center' });
  doc.font('Helvetica').fontSize(12).fillColor('#d8b4fe');
  doc.text(text, M, 30, { align: 'center' });
  doc.y = 64;
}

function sectionHeader(doc, text) {
  ensureSpace(doc, 30);
  doc.moveDown(0.4);
  const y = doc.y;
  doc.rect(M, y, doc.page.width - M * 2, 18).fill('#f3e8ff');
  doc.font('Helvetica-Bold').fontSize(9).fillColor(PRIMARY)
    .text(text.toUpperCase(), M + 6, y + 4, { width: doc.page.width - M * 2 - 6 });
  doc.y = y + 22;
}

function field(doc, label, value, opts = {}) {
  const w = opts.fullWidth ? doc.page.width - M * 2 : (doc.page.width - M * 2 - 10) / 2;
  const indent = opts.col2 ? M + w + 10 : M;
  ensureSpace(doc, 20);
  const y = doc.y;
  doc.font('Helvetica-Bold').fontSize(8).fillColor(MUTED)
    .text(label, indent, y, { width: w, lineBreak: false });
  doc.font('Helvetica').fontSize(9).fillColor('#1e293b')
    .text(String(value || '—'), indent, y + 10, { width: w, lineBreak: false, ellipsis: true });
  doc.moveTo(indent, y + 18).lineTo(indent + w - 6, y + 18)
    .strokeColor(BORDER).lineWidth(0.5).stroke();
  if (!opts.col2) doc.y = y + 22;
}

function fieldPair(doc, label1, val1, label2, val2) {
  ensureSpace(doc, 26);
  const w = (doc.page.width - M * 2 - 10) / 2;
  const y = doc.y;
  // col 1
  doc.font('Helvetica-Bold').fontSize(8).fillColor(MUTED).text(label1, M, y, { width: w });
  doc.font('Helvetica').fontSize(9).fillColor('#1e293b').text(String(val1 || '—'), M, y + 10, { width: w, lineBreak: false });
  doc.moveTo(M, y + 18).lineTo(M + w - 6, y + 18).strokeColor(BORDER).lineWidth(0.5).stroke();
  // col 2
  const x2 = M + w + 10;
  doc.font('Helvetica-Bold').fontSize(8).fillColor(MUTED).text(label2, x2, y, { width: w });
  doc.font('Helvetica').fontSize(9).fillColor('#1e293b').text(String(val2 || '—'), x2, y + 10, { width: w, lineBreak: false });
  doc.moveTo(x2, y + 18).lineTo(x2 + w - 6, y + 18).strokeColor(BORDER).lineWidth(0.5).stroke();
  doc.y = y + 26;
}

function checkRow(doc, items) {
  ensureSpace(doc, 20);
  const y = doc.y;
  const colW = (doc.page.width - M * 2) / items.length;
  items.forEach(({ label, checked }, i) => {
    const x = M + i * colW;
    // box
    doc.rect(x, y + 1, 10, 10).lineWidth(0.8).strokeColor('#666').stroke();
    if (checked) {
      doc.moveTo(x + 1, y + 6).lineTo(x + 4, y + 9).lineTo(x + 9, y + 3)
        .lineWidth(1.5).strokeColor(PRIMARY).stroke();
    }
    doc.font('Helvetica').fontSize(8).fillColor('#1e293b')
      .text(label, x + 14, y + 1, { width: colW - 16, lineBreak: false });
  });
  doc.y = y + 18;
}

function radioRow(doc, groupLabel, options, selected) {
  ensureSpace(doc, 20);
  const y = doc.y;
  doc.font('Helvetica-Bold').fontSize(8).fillColor(MUTED).text(groupLabel + ':', M, y);
  doc.y = y + 12;
  options.forEach(({ label, value }) => {
    ensureSpace(doc, 16);
    const ry = doc.y;
    const isSelected = selected === value;
    doc.circle(M + 5, ry + 5, 5).lineWidth(0.8).strokeColor('#666').stroke();
    if (isSelected) doc.circle(M + 5, ry + 5, 3).fill(PRIMARY);
    doc.font('Helvetica').fontSize(8.5).fillColor('#1e293b')
      .text(label, M + 14, ry + 1, { width: doc.page.width - M * 2 - 14 });
    doc.y = ry + 16;
  });
}

// Renders a dynamic array of { label, checked } items as a checklist.
// When single=true uses a radio circle instead of a checkbox square.
function checklistSection(doc, items, single = false) {
  if (!Array.isArray(items) || items.length === 0) {
    ensureSpace(doc, 14);
    doc.font('Helvetica').fontSize(8).fillColor(MUTED).text('Sin opciones', M, doc.y);
    doc.y += 14;
    return;
  }
  items.forEach(({ label, checked }) => {
    ensureSpace(doc, 16);
    const y = doc.y;
    if (single) {
      doc.circle(M + 5, y + 5, 5).lineWidth(0.8).strokeColor('#666').stroke();
      if (checked) doc.circle(M + 5, y + 5, 3).fill(PRIMARY);
    } else {
      doc.rect(M, y + 1, 10, 10).lineWidth(0.8).strokeColor('#666').stroke();
      if (checked) {
        doc.moveTo(M + 1, y + 6).lineTo(M + 4, y + 9).lineTo(M + 9, y + 3)
          .lineWidth(1.5).strokeColor(PRIMARY).stroke();
      }
    }
    doc.font('Helvetica').fontSize(8.5).fillColor(checked ? PRIMARY : '#1e293b')
      .text(label || '—', M + 14, y + 1, { width: doc.page.width - M * 2 - 14 });
    doc.y = Math.max(doc.y, y + 14);
  });
}

function signatureLine(doc, label, name, x, y, w = 150) {
  doc.moveTo(x, y).lineTo(x + w, y).strokeColor('#555').lineWidth(0.7).stroke();
  if (name) {
    doc.font('Helvetica').fontSize(8.5).fillColor('#1e293b')
      .text(name, x, y - 12, { width: w, align: 'center' });
  }
  doc.font('Helvetica').fontSize(7.5).fillColor(MUTED)
    .text(label, x, y + 4, { width: w, align: 'center' });
}

function ensureSpace(doc, need) {
  if (doc.y + need > doc.page.height - doc.page.margins.bottom) doc.addPage();
}

function menuSection(doc, items, single = false) {
  if (!Array.isArray(items) || items.length === 0) return;
  const totalW = doc.page.width - M * 2;
  const itemH = 22;
  const blockH = items.length * itemH + 10;
  ensureSpace(doc, blockH);
  const startY = doc.y;
  doc.rect(M, startY, totalW, blockH).lineWidth(0.5).strokeColor('#888').stroke();
  let cy = startY + 6;
  items.forEach((item) => {
    const x = M + 8;
    const y = cy;
    if (single) {
      doc.circle(x + 4, y + 5, 5).lineWidth(0.8).strokeColor('#555').stroke();
      if (item.checked) doc.circle(x + 4, y + 5, 3).fill(PRIMARY);
    } else {
      doc.rect(x, y + 1, 10, 10).lineWidth(0.8).strokeColor('#555').stroke();
      if (item.checked) {
        doc.moveTo(x + 1, y + 6).lineTo(x + 4, y + 9).lineTo(x + 9, y + 3)
          .lineWidth(1.4).strokeColor(PRIMARY).stroke();
      }
    }
    doc.font(item.checked ? 'Helvetica-Bold' : 'Helvetica')
       .fontSize(8).fillColor(item.checked ? PRIMARY : '#1e293b')
       .text(item.label || '', x + 16, y + 1, { width: totalW - 30, lineBreak: false });
    cy += itemH;
  });
  doc.y = startY + blockH;
}

function drawTableHeader(doc, cols) {
  ensureSpace(doc, 22);
  const totalW = cols.reduce((s, c) => s + c.w, 0);
  const y = doc.y;
  doc.rect(M, y, totalW, 18).fill(PRIMARY);
  let cx = M;
  cols.forEach(({ label, w }) => {
    doc.font('Helvetica-Bold').fontSize(7.5).fillColor('#fff')
      .text(label, cx + 3, y + 5, { width: w - 6, lineBreak: false, ellipsis: true });
    cx += w;
  });
  doc.y = y + 18;
}

function drawTableRow(doc, cols, values, zebra) {
  const totalW = cols.reduce((s, c) => s + c.w, 0);
  // Estimate height based on the longest cell
  const cellH = Math.max(...cols.map((c, i) => {
    const lines = Math.ceil((String(values[i] || '').length * 5.5) / (c.w - 8));
    return Math.max(1, lines) * 10 + 8;
  }));
  ensureSpace(doc, cellH + 2);
  const y = doc.y;
  if (zebra) doc.rect(M, y, totalW, cellH).fill('#f8f4ff');
  let cx = M;
  cols.forEach(({ w }, i) => {
    doc.font('Helvetica').fontSize(7.5).fillColor('#1e293b')
      .text(String(values[i] || ''), cx + 3, y + 4, { width: w - 8, height: cellH - 8 });
    cx += w;
  });
  doc.moveTo(M, y + cellH).lineTo(M + totalW, y + cellH).strokeColor(BORDER).lineWidth(0.3).stroke();
  doc.y = y + cellH;
}



// ── Helpers nuevos para Tabla de Trabajo ─────────────────────────────────
function sectionRow(doc, text) {
  ensureSpace(doc, 20);
  const y = doc.y;
  const totalW = doc.page.width - M * 2;
  doc.rect(M, y, totalW, 20).fill('#f3e8ff');
  doc.rect(M, y, totalW, 20).lineWidth(0.5).strokeColor('#888').stroke();
  doc.font('Helvetica-Bold').fontSize(9).fillColor(PRIMARY)
    .text(text.toUpperCase(), M + 6, y + 6, { width: totalW - 12 });
  doc.y = y + 20;
}

function gridRow(doc, cells, rowH) {
  ensureSpace(doc, rowH);
  const y = doc.y;
  const totalW = doc.page.width - M * 2;
  const fixedW = cells.reduce((s, c) => s + (c.w || 0), 0);
  const flexCount = cells.filter(c => !c.w).length;
  const flexW = flexCount > 0 ? (totalW - fixedW) / flexCount : 0;
  let cx = M;
  cells.forEach((cell) => {
    const cw = cell.w || flexW;
    const pad = 4;
    doc.rect(cx, y, cw, rowH).lineWidth(0.5).strokeColor('#888').stroke();
    if (cell.label) {
      doc.font('Helvetica-Bold').fontSize(7).fillColor(MUTED)
        .text(cell.label, cx + pad, y + pad, { width: cw - pad * 2, lineBreak: false });
    }
    if (cell.value !== undefined && cell.value !== null) {
      doc.font('Helvetica').fontSize(8.5).fillColor('#1e293b')
        .text(String(cell.value || ''), cx + pad, y + (cell.label ? 14 : pad),
          { width: cw - pad * 2, height: rowH - 20, ellipsis: true });
    }
    cx += cw;
  });
  doc.y = y + rowH;
}

function checkboxGrid(doc, items, numCols = 4) {
  if (!Array.isArray(items) || items.length === 0) return;
  const totalW = doc.page.width - M * 2;
  const colW = totalW / numCols;
  const rowH = 16;
  const rows = Math.ceil(items.length / numCols);
  const blockH = rows * rowH + 6;
  ensureSpace(doc, blockH);
  const startY = doc.y;
  doc.rect(M, startY, totalW, blockH).lineWidth(0.5).strokeColor('#888').stroke();
  for (let c = 1; c < numCols; c++) {
    doc.moveTo(M + c * colW, startY).lineTo(M + c * colW, startY + blockH)
      .lineWidth(0.3).strokeColor('#ccc').stroke();
  }
  items.forEach((item, idx) => {
    const col = idx % numCols;
    const row = Math.floor(idx / numCols);
    const x = M + col * colW + 6;
    const y = startY + 3 + row * rowH;
    doc.rect(x, y + 2, 9, 9).lineWidth(0.7).strokeColor('#555').stroke();
    if (item.checked) {
      doc.moveTo(x + 1, y + 6).lineTo(x + 3.5, y + 9).lineTo(x + 8, y + 3)
        .lineWidth(1.4).strokeColor(PRIMARY).stroke();
    }
    doc.font('Helvetica').fontSize(8).fillColor(item.checked ? PRIMARY : '#1e293b')
      .text(item.label || '', x + 13, y + 2, { width: colW - 22, lineBreak: false });
  });
  doc.y = startY + blockH;
}


// ── Tabla de Trabajo ──────────────────────────────────────────────────────
// ── Tabla de Trabajo ──────────────────────────────────────────────────────
function streamTablaTrabajosPdf(res, data) {
  const doc = new PDFDocument({ size: 'LETTER', margin: M, info: { Title: 'Tabla de Trabajo' } });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', 'inline; filename="tabla-trabajo.pdf"');
  doc.pipe(res);

  pageTitle(doc, 'TABLA DE TRABAJO');

  sectionRow(doc, 'Datos Generales');
  gridRow(doc, [
    { label: 'Fecha de llenado',     value: data.fecha_llenado },
    { label: 'Fecha del evento',     value: data.fecha_evento },
  ], 34);
  gridRow(doc, [
    { label: 'Nombre del cliente',   value: data.nombre_cliente },
    { label: 'Nombre del festejado', value: data.nombre_festejado },
  ], 34);
  gridRow(doc, [
    { label: 'Tipo de evento',       value: data.tipo_evento },
    { label: 'Núm. de invitados',    value: data.num_invitados },
  ], 34);

  sectionRow(doc, 'Montaje');
  gridRow(doc, [
    { label: 'Montaje',              value: data.montaje },
    { label: 'Núm. de mesas',        value: data.num_mesas },
    { label: 'Tipo de mesa',         value: data.tipo_mesa },
  ], 34);
  gridRow(doc, [
    { label: 'Núm. de sillas',       value: data.num_sillas },
    { label: 'Tipo de sillas',       value: data.tipo_sillas },
    { label: 'Color de sillas',      value: data.color_sillas },
  ], 34);

  sectionRow(doc, 'Mantelería y Vajilla');
  gridRow(doc, [
    { label: 'Núm. y tipo de mantel / camino', value: data.mantel_camino },
    { label: 'Núm. y color de servilletas',    value: data.servilletas },
  ], 34);
  gridRow(doc, [
    { label: 'Plaque',               value: data.plaque },
    { label: 'Cubierto',             value: data.cubierto },
    { label: 'Cristalería',          value: data.cristaleria },
  ], 34);
  gridRow(doc, [
    { label: 'Plato Basse',          value: data.plato_basse },
    { label: 'Núm. y tipo de centro de mesa', value: data.centro_mesa },
  ], 34);

  sectionRow(doc, 'Servicio y Alimentos');
  gridRow(doc, [
    { label: 'Horario de servir',    value: data.horario_servir },
    { label: 'Tiempos',              value: data.tiempos },
  ], 34);
  gridRow(doc, [
    { label: 'Alimentos',            value: data.alimentos },
  ], 48);

  sectionRow(doc, 'Bebidas');
  checkboxGrid(doc, data.bebidas, 4);

  sectionRow(doc, 'Requerimientos Técnicos');
  checkboxGrid(doc, data.req_tecnicos, 4);

  sectionRow(doc, 'Programa DJ');
  checkboxGrid(doc, data.programa_dj, 4);

  sectionRow(doc, 'Accesorios');
  checkboxGrid(doc, data.accesorios, 4);

  sectionRow(doc, 'Servicios');
  checkboxGrid(doc, data.servicios, 4);

  sectionRow(doc, 'Proveedores Externos y Logística');
  gridRow(doc, [
    { label: 'Proveedor(es) externo(s)', value: data.proveedores_externos },
    { label: 'Teléfono',                 value: data.telefono },
  ], 34);
  gridRow(doc, [
    { label: 'Horario de montaje',       value: data.horario_montaje },
    { label: 'Horario de desmontaje',    value: data.horario_desmontaje },
  ], 34);

  if (data.notas) {
    sectionRow(doc, 'Notas adicionales');
    gridRow(doc, [{ label: 'Notas', value: data.notas }], 50);
  }

  extrasSection(doc, data.extras);

  doc.end();
}


// ── Degustación ───────────────────────────────────────────────────────────
function streamDegustacionPdf(res, data) {
  const doc = new PDFDocument({ size: 'LETTER', margin: M, info: { Title: 'Degustación' } });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', 'inline; filename="degustacion.pdf"');
  doc.pipe(res);

  pageTitle(doc, 'DEGUSTACIÓN');

  sectionRow(doc, 'Datos del Evento');
  gridRow(doc, [
    { label: 'Nombre del cliente',   value: data.nombre_cliente },
    { label: 'Fecha del evento',     value: data.fecha_evento },
  ], 34);
  gridRow(doc, [
    { label: 'Fecha de degustación', value: data.fecha_degustacion },
    { label: 'Hora',                 value: data.hora },
    { label: 'Tipo de evento',       value: data.tipo_evento },
    { label: 'Aforo',                value: data.aforo },
  ], 34);

  sectionRow(doc, 'Elección de Entrada — Crema de Temporada');
  menuSection(doc, data.entradas, false);

  sectionRow(doc, 'Elección de Plato Fuerte');
  menuSection(doc, data.platos_fuertes, true);

  sectionRow(doc, 'Elección de Postre');
  menuSection(doc, data.postres, true);

  sectionRow(doc, 'Observaciones');
  gridRow(doc, [{ label: 'Observaciones', value: data.observaciones }], 50);

  sectionRow(doc, 'Firmas de Conformidad');
  ensureSpace(doc, 60);
  const sigY = doc.y + 40;
  const totalW = doc.page.width - M * 2;
  const sigW = 150;
  const gap = (totalW - sigW * 3) / 2;
  signatureLine(doc, 'Chef',    data.firma_chef,     M,                    sigY, sigW);
  signatureLine(doc, 'Cliente', data.firma_cliente,  M + sigW + gap,       sigY, sigW);
  signatureLine(doc, 'Ventas',  data.firma_ventas,   M + (sigW + gap) * 2, sigY, sigW);
  doc.y = sigY + 30;

  extrasSection(doc, data.extras);

  doc.end();
}
// ── Mis Proveedores ───────────────────────────────────────────────────────


function streamProveedoresPdf(res, data) {
  const doc = new PDFDocument({ size: 'LETTER', margin: M, info: { Title: 'Mis Proveedores' } });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', 'inline; filename="proveedores.pdf"');
  doc.pipe(res);

  const pageW = doc.page.width;

  // ── TÍTULO ──
  doc.font('Helvetica-Bold').fontSize(18).fillColor(PRIMARY)
    .text('NARDELI CENTRO DE EVENTOS', M, 48, { align: 'center', width: pageW - M * 2 });
  doc.font('Helvetica').fontSize(13).fillColor('#333')
    .text('Mis proveedores', M, 70, { align: 'center', width: pageW - M * 2 });
  const lineY = 88;
  doc.moveTo(M, lineY).lineTo(pageW - M, lineY).strokeColor('#a78bfa').lineWidth(1).stroke();
  doc.y = lineY + 16;

  // ── DATOS GENERALES ──
  doc.font('Helvetica').fontSize(9).fillColor(MUTED)
    .text('Nombre de el o los anfitriones: ', M, doc.y, { continued: true })
    .font('Helvetica-Bold').fillColor('#1e293b')
    .text(data.nombre_anfitriones || '');
  doc.y += 4;
  doc.font('Helvetica').fontSize(9).fillColor(MUTED)
    .text('Tipo de evento: ', M, doc.y, { continued: true })
    .font('Helvetica-Bold').fillColor('#1e293b')
    .text(data.tipo_evento || '', { continued: true })
    .font('Helvetica').fillColor(MUTED)
    .text('     Fecha del evento: ', { continued: true })
    .font('Helvetica-Bold').fillColor('#1e293b')
    .text(data.fecha_evento || '');
  doc.y += 16;

  // ── TABLA ──
  const usableW = pageW - M * 2;
  const cols = [
    { label: 'Categoría',            w: Math.floor(usableW * 0.22) },
    { label: 'Nombre del proveedor', w: Math.floor(usableW * 0.26) },
    { label: 'Teléfono',             w: Math.floor(usableW * 0.22) },
    { label: 'Notas',                w: Math.floor(usableW * 0.30) },
  ];
  const totalW = cols.reduce((s, c) => s + c.w, 0);
  const rowH = 18;

  // Header fila 1: etiquetas de columnas
  ensureSpace(doc, rowH * 2 + 10);
  let y = doc.y;
  doc.rect(M, y, totalW, rowH).fill('#f3e8ff');
  doc.rect(M, y, totalW, rowH).lineWidth(0.5).strokeColor(BORDER).stroke();
  let cx = M;
  cols.forEach(({ label, w }) => {
    doc.font('Helvetica-Bold').fontSize(8).fillColor(PRIMARY)
      .text(label, cx + 4, y + 5, { width: w - 8, lineBreak: false });
    cx += w;
  });
  y += rowH;

  // Header fila 2: "Día del evento"
  const subX = M + cols[0].w;
  const subW = cols[1].w + cols[2].w + cols[3].w;
  doc.rect(M, y, cols[0].w, rowH).lineWidth(0.5).strokeColor(BORDER).stroke();
  doc.rect(subX, y, subW, rowH).fill('#faf5ff');
  doc.rect(subX, y, subW, rowH).lineWidth(0.5).strokeColor(BORDER).stroke();
  doc.font('Helvetica').fontSize(7.5).fillColor(MUTED)
    .text('Día del evento', subX, y + 5, { width: subW, align: 'center' });
  y += rowH;
  doc.y = y;

  // Filas de datos
  const proveedores = Array.isArray(data.proveedores) && data.proveedores.length > 0
    ? data.proveedores
    : CATEGORIAS_DEFAULT.map(cat => ({ categoria: cat, nombre: '', telefono: '', notas: '' }));

  proveedores.forEach((p, i) => {
    ensureSpace(doc, rowH);
    const ry = doc.y;
    if (i % 2 === 1) doc.rect(M, ry, totalW, rowH).fill('#faf5ff');
    let rx = M;
    cols.forEach(({ w }) => {
      doc.rect(rx, ry, w, rowH).lineWidth(0.3).strokeColor(BORDER).stroke();
      rx += w;
    });
    const values = [p.categoria || '', p.nombre || '', p.telefono || '', p.notas || ''];
    rx = M;
    cols.forEach(({ w }, ci) => {
      doc.font('Helvetica').fontSize(8).fillColor('#1e293b')
        .text(values[ci], rx + 4, ry + 5, { width: w - 8, lineBreak: false, ellipsis: true });
      rx += w;
    });
    doc.y = ry + rowH;
  });

  // ── FIRMA CLIENTE ──
  ensureSpace(doc, 40);
  const firmaW = 160;
  const firmaX = pageW - M - firmaW;
  const firmaY = doc.y + 20;
  if (data.firma_cliente) {
    doc.font('Helvetica').fontSize(9).fillColor('#1e293b')
      .text(data.firma_cliente, firmaX, firmaY - 12, { width: firmaW, align: 'center' });
  }
  doc.moveTo(firmaX, firmaY).lineTo(firmaX + firmaW, firmaY)
    .strokeColor('#555').lineWidth(0.7).stroke();
  doc.font('Helvetica-Bold').fontSize(8).fillColor(PRIMARY)
    .text('FIRMA CLIENTE', firmaX, firmaY + 4, { width: firmaW, align: 'center' });

  extrasSection(doc, data.extras);

  doc.end();
}

// ── Dispatch ──────────────────────────────────────────────────────────────
function streamFormatoPdf(res, { tipo, data }) {
  if (tipo === 'tabla-trabajo')  return streamTablaTrabajosPdf(res, data);
  if (tipo === 'degustacion')    return streamDegustacionPdf(res, data);
  if (tipo === 'proveedores')    return streamProveedoresPdf(res, data);
  res.status(400).json({ ok: false, msg: 'Tipo de formato desconocido' });
}

module.exports = { streamFormatoPdf };
