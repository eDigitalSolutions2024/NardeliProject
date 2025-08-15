// backend/services/reservaPdf.js
const PDFDocument = require('pdfkit');

function money(n) {
  return Number.isFinite(n)
    ? n.toLocaleString('es-MX', { style: 'currency', currency: 'MXN', minimumFractionDigits: 2 })
    : '—';
}
const sum = (arr) => arr.reduce((a, b) => a + b, 0);

// ======= Paleta de colores inspirada en tu aplicación Nardeli =======
const COLORS = {
  primary: '#7c3aed',        // Púrpura principal (similar al de tu app)
  primaryDark: '#5b21b6',    // Púrpura más oscuro para contraste
  primaryLight: '#a855f7',   // Púrpura claro para acentos
  secondary: '#ec4899',      // Rosa/magenta complementario
  background: '#f8fafc',     // Fondo principal muy suave
  cardBg: '#ffffff',         // Fondo de tarjetas
  text: '#1e293b',          // Texto principal (azul muy oscuro)
  textMuted: '#64748b',     // Texto secundario
  border: '#e2e8f0',        // Bordes suaves
  success: '#10b981',       // Verde para elementos positivos
  warning: '#f59e0b',       // Amarillo/naranja para alertas
  tableHeader: '#f1f5f9',   // Fondo de encabezados de tabla
  tableZebra: '#f8fafc',    // Filas alternadas
  gradient: {
    start: '#7c3aed',
    end: '#ec4899'
  }
};

const FONTS = {
  tiny: 7,
  small: 8,
  base: 10,
  medium: 11,
  large: 12,
  h3: 13,
  h2: 14,
  h1: 18,
  title: 22
};

// ======= Helpers de dibujo mejorados =======
function drawGradientRect(doc, x, y, width, height, startColor, endColor, radius = 0) {
  // Gradiente horizontal más suave
  const steps = 50;
  const stepWidth = width / steps;
  
  for (let i = 0; i < steps; i++) {
    const ratio = i / (steps - 1);
    const color = interpolateColor(startColor, endColor, ratio);
    
    if (radius > 0 && (i === 0 || i === steps - 1)) {
      if (i === 0) {
        doc.roundedRect(x + i * stepWidth, y, stepWidth + 1, height, radius, true, false, true, false).fill(color);
      } else {
        doc.roundedRect(x + i * stepWidth, y, stepWidth + 1, height, radius, false, true, false, true).fill(color);
      }
    } else {
      doc.rect(x + i * stepWidth, y, stepWidth + 1, height).fill(color);
    }
  }
}

function interpolateColor(color1, color2, ratio) {
  // Conversión hex a RGB
  const hex1 = color1.replace('#', '');
  const hex2 = color2.replace('#', '');
  
  const r1 = parseInt(hex1.substr(0, 2), 16);
  const g1 = parseInt(hex1.substr(2, 2), 16);
  const b1 = parseInt(hex1.substr(4, 2), 16);
  
  const r2 = parseInt(hex2.substr(0, 2), 16);
  const g2 = parseInt(hex2.substr(2, 2), 16);
  const b2 = parseInt(hex2.substr(4, 2), 16);
  
  const r = Math.round(r1 + (r2 - r1) * ratio);
  const g = Math.round(g1 + (g2 - g1) * ratio);
  const b = Math.round(b1 + (b2 - b1) * ratio);
  
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

function labelValue(doc, { x, y, wLabel = 90, wValue = 180, label, value, style = 'default' }) {
  const styles = {
    default: { labelColor: COLORS.textMuted, valueColor: COLORS.text, labelFont: 'Helvetica', valueFont: 'Helvetica-Bold' },
    highlight: { labelColor: COLORS.primary, valueColor: COLORS.text, labelFont: 'Helvetica-Bold', valueFont: 'Helvetica-Bold' },
    subtle: { labelColor: COLORS.textMuted, valueColor: COLORS.textMuted, labelFont: 'Helvetica', valueFont: 'Helvetica' }
  };
  
  const currentStyle = styles[style] || styles.default;
  
  doc.font(currentStyle.labelFont).fontSize(FONTS.base).fillColor(currentStyle.labelColor);
  doc.text(label, x, y, { width: wLabel });
  doc.fillColor(currentStyle.valueColor).font(currentStyle.valueFont);
  doc.text(value ?? '—', x + wLabel + 8, y, { width: wValue });
  
  return Math.max(
    doc.heightOfString(label, { width: wLabel }),
    doc.heightOfString(String(value ?? '—'), { width: wValue })
  );
}

function sectionTitle(doc, text, x, y, icon = null) {
  doc.fillColor(COLORS.text).font('Helvetica-Bold').fontSize(FONTS.h2);
  
  if (icon) {
    // Dibuja un pequeño círculo con ícono (puedes mejorarlo con íconos reales)
    doc.save();
    doc.circle(x, y + 8, 8).fill(COLORS.primary);
    doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(FONTS.small);
    doc.text(icon, x - 3, y + 4);
    doc.restore();
    doc.fillColor(COLORS.text).font('Helvetica-Bold').fontSize(FONTS.h2);
    doc.text(text, x + 24, y);
  } else {
    doc.text(text, x, y);
  }
  
  // Línea decorativa debajo del título
  const textWidth = doc.widthOfString(text);
  doc.moveTo(x + (icon ? 24 : 0), y + 18).lineTo(x + (icon ? 24 : 0) + textWidth, y + 18)
     .strokeColor(COLORS.primary).lineWidth(2).stroke();
  
  doc.fontSize(FONTS.base);
}

function drawCard(doc, { x, y, width, height, content, padding = 16 }) {
  // Sombra sutil
  doc.save();
  doc.rect(x + 2, y + 2, width, height).fill('#00000008');
  
  // Tarjeta principal
  doc.roundedRect(x, y, width, height, 8).fill(COLORS.cardBg);
  doc.roundedRect(x, y, width, height, 8).stroke(COLORS.border);
  doc.restore();
  
  // Contenido
  if (content) content(doc, x + padding, y + padding, width - padding * 2, height - padding * 2);
  
  return { x: x + padding, y: y + padding, contentWidth: width - padding * 2, contentHeight: height - padding * 2 };
}

function drawHeaderRow(doc, { x, y, widths, headers }) {
  const H = 28;
  
  // Fondo con gradiente sutil
  doc.save();
  doc.roundedRect(x, y, sum(widths), H, 8).fill(COLORS.primary);
  
  // Texto del encabezado
  doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(FONTS.medium);

  let cx = x;
  headers.forEach((h, i) => {
    doc.text(h, cx + 12, y + 8, {
      width: widths[i] - 24,
      align: i >= headers.length - 2 ? 'right' : 'left'
    });
    cx += widths[i];
  });
  doc.restore();
  return y + H;
}

function drawRow(doc, { x, y, widths, values, zebra = false, isTotal = false }) {
  const PADX = 12, PADY = 8;
  const heights = values.map((v, i) =>
    doc.heightOfString(String(v ?? ''), { width: widths[i] - PADX * 2 })
  );
  const rowH = Math.max(24, ...heights) + PADY * 2;

  // NO hacer salto de página automático para mantener todo en una sola página
  doc.save();
  
  if (isTotal) {
    // Fila de total con estilo especial
    doc.roundedRect(x, y, sum(widths), rowH, 6).fill(COLORS.primary);
    doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(FONTS.medium);
  } else {
    // Fila normal
    if (zebra) doc.rect(x, y, sum(widths), rowH).fill(COLORS.tableZebra);
    doc.fillColor(COLORS.text).font('Helvetica').fontSize(FONTS.base);
  }

  let cx = x;
  values.forEach((val, i) => {
    const align = i >= values.length - 2 ? 'right' : 'left';
    doc.text(String(val ?? ''), cx + PADX, y + PADY, {
      width: widths[i] - PADX * 2,
      align: align
    });
    cx += widths[i];
  });

  // Línea inferior sutil
  if (!isTotal) {
    doc.moveTo(x, y + rowH - 1).lineTo(x + sum(widths), y + rowH - 1)
       .strokeColor(COLORS.border).lineWidth(0.5).stroke();
  }
  
  doc.restore();
  return y + rowH;
}

// ======= Generación principal mejorada =======
function streamReservaPDF(res, { reserva, productosById = new Map(), brand = {} }) {
  const MARGIN = 40;
  const PAGE_W = 595.28;
  const CONTENT_W = PAGE_W - MARGIN * 2;
  const startX = MARGIN;

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="Reserva-${reserva?._id || 'N'}.pdf"`);

  const doc = new PDFDocument({ size: 'A4', margin: MARGIN, bufferPages: true });
  doc.pipe(res);

  // ===== Encabezado moderno con color sólido =====
  const headerH = 65;
  const topY = MARGIN - 25;
  
  // Encabezado con color sólido púrpura
  doc.save();
  doc.roundedRect(MARGIN - 20, topY, CONTENT_W + 40, headerH, 12).fill(COLORS.primary);
  
  // Título principal
  doc.fill('#ffffff').font('Helvetica-Bold').fontSize(FONTS.title);
  doc.text(`${brand.title || 'Nardeli'}`, MARGIN, topY + 12);
  doc.font('Helvetica').fontSize(FONTS.h2);
  doc.text('Confirmación de Reserva', MARGIN, topY + 38);
  doc.restore();

  doc.y = topY + headerH + 25;

  // ===== Información principal en tarjetas (más compactas) =====
  const cardHeight = 110;
  const cardY = doc.y;
  
  // Tarjeta 1: Información del cliente
  const card1 = drawCard(doc, {
    x: startX,
    y: cardY,
    width: (CONTENT_W - 20) / 2,
    height: cardHeight
  });
  
  let y1 = card1.y;
  sectionTitle(doc, 'Cliente', card1.x, y1, '👤');
  y1 += 22;
  y1 += labelValue(doc, { x: card1.x, y: y1, wLabel: 70, wValue: 140, label: 'Nombre:', value: reserva?.cliente, style: 'highlight' }) + 8;
  y1 += labelValue(doc, { x: card1.x, y: y1, wLabel: 70, wValue: 140, label: 'Correo:', value: reserva?.correo }) + 8;
  y1 += labelValue(doc, { x: card1.x, y: y1, wLabel: 70, wValue: 140, label: 'Teléfono:', value: reserva?.telefono }) + 8;
  
  // Tarjeta 2: Información del evento
  const card2 = drawCard(doc, {
    x: startX + (CONTENT_W + 20) / 2,
    y: cardY,
    width: (CONTENT_W - 20) / 2,
    height: cardHeight
  });
  
  let y2 = card2.y;
  sectionTitle(doc, 'Evento', card2.x, y2, '🎉');
  y2 += 22;
  
  const fechaTxt = reserva?.fecha ? new Date(reserva.fecha).toLocaleDateString('es-MX', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  }) : '—';
  
  y2 += labelValue(doc, { x: card2.x, y: y2, wLabel: 70, wValue: 140, label: 'Tipo:', value: reserva?.tipoEvento, style: 'highlight' }) + 8;
  y2 += labelValue(doc, { x: card2.x, y: y2, wLabel: 70, wValue: 140, label: 'Fecha:', value: fechaTxt }) + 8;
  y2 += labelValue(doc, { x: card2.x, y: y2, wLabel: 70, wValue: 140, label: 'Horario:', value: `${reserva?.horaInicio || '—'} - ${reserva?.horaFin || '—'}` }) + 8;

  doc.y = cardY + cardHeight + 20;

  // ===== ID de reserva destacado (más compacto) =====
  const idCard = drawCard(doc, {
    x: startX,
    y: doc.y,
    width: CONTENT_W,
    height: 40
  });
  
  doc.save();
  doc.fillColor(COLORS.primary).font('Helvetica-Bold').fontSize(FONTS.h3);
  doc.text('ID de Reserva:', idCard.x, idCard.y + 6);
  doc.fillColor(COLORS.text).fontSize(FONTS.h2);
  doc.text(`#${String(reserva?._id || 'N/A').slice(-8).toUpperCase()}`, idCard.x + 120, idCard.y + 6);
  doc.restore();

  doc.y = idCard.y + 50;

  // ===== Notas mejoradas (más compactas) =====
  if (reserva?.descripcion) {
    const notesCard = drawCard(doc, {
      x: startX,
      y: doc.y,
      width: CONTENT_W,
      height: Math.max(60, doc.heightOfString(reserva.descripcion, { width: CONTENT_W - 32 }) + 35)
    });
    
    sectionTitle(doc, 'Notas Especiales', notesCard.x, notesCard.y, '📝');
    doc.font('Helvetica').fontSize(FONTS.base).fillColor(COLORS.text);
    doc.text(reserva.descripcion, notesCard.x, notesCard.y + 20, { width: notesCard.contentWidth, lineGap: 1 });
    
    doc.y = notesCard.y + Math.max(60, doc.heightOfString(reserva.descripcion, { width: CONTENT_W - 32 }) + 35) + 15;
  }

  // ===== Tabla de utensilios mejorada =====
  sectionTitle(doc, 'Utensilios Reservados', startX, doc.y, '🍽️');
  doc.y += 30;

  const lista = Array.isArray(reserva?.utensilios) ? reserva.utensilios : [];
  const showPrices = lista.some(u => {
    const p = u.itemId && productosById.get(String(u.itemId));
    return Number.isFinite(p?.precio);
  });

  const widths = showPrices ? [200, 90, 60, 65, 75, 85] : [260, 110, 70, 85];
  const headers = showPrices
    ? ['Nombre', 'Categoría', 'Unidad', 'Cantidad', 'P. Unit.', 'Subtotal']
    : ['Nombre', 'Categoría', 'Unidad', 'Cantidad'];

  let y = drawHeaderRow(doc, { x: startX, y: doc.y, widths, headers });

  let grandTotal = 0;
  lista.forEach((u, idx) => {
    const prod = u.itemId && productosById.get(String(u.itemId));
    const pu = Number.isFinite(prod?.precio) ? prod.precio : null;
    const cant = Number(u.cantidad || 0);
    const sub = Number.isFinite(pu) ? pu * cant : null;
    if (Number.isFinite(sub)) grandTotal += sub;

    const row = showPrices
      ? [
          u.nombre || prod?.nombre || '—',
          u.categoria || 'General',
          u.unidad || 'pza',
          String(cant),
          pu ? money(pu) : '—',
          sub ? money(sub) : '—'
        ]
      : [
          u.nombre || prod?.nombre || '—',
          u.categoria || 'General',
          u.unidad || 'pza',
          String(cant)
        ];

    y = drawRow(doc, { x: startX, y, widths, values: row, zebra: idx % 2 === 1 });
  });

  // ===== Total destacado mejorado =====
  if (showPrices) {
    y += 10;
    const totalRow = ['', '', '', '', 'TOTAL ESTIMADO', money(grandTotal)];
    y = drawRow(doc, { x: startX, y, widths, values: totalRow, isTotal: true });
    
    // Nota de disclaimer
    doc.font('Helvetica').fontSize(FONTS.small).fillColor(COLORS.textMuted);
    doc.text('* Precios estimados sujetos a confirmación. Pueden aplicar cargos adicionales por servicios extras.', 
             startX, y + 10, { width: CONTENT_W, align: 'right' });
  }

  // ===== Información adicional (más compacta) =====
  doc.y += 25;
  
  const infoCard = drawCard(doc, {
    x: startX,
    y: doc.y,
    width: CONTENT_W,
    height: 75
  });
  
  doc.save();
  doc.fillColor(COLORS.primaryLight).font('Helvetica-Bold').fontSize(FONTS.h3);
  doc.text('Información Importante', infoCard.x, infoCard.y);
  doc.font('Helvetica').fontSize(FONTS.small).fillColor(COLORS.text);
  doc.text('• Favor de confirmar su asistencia 48 hrs antes del evento', infoCard.x, infoCard.y + 20);
  doc.text('• Los utensilios deben ser devueltos en las mismas condiciones', infoCard.x, infoCard.y + 32);
  doc.text('• Para cambios o cancelaciones, contactar con 24 hrs de anticipación', infoCard.x, infoCard.y + 44);
  doc.restore();

  // ===== Pie de página mejorado (solo una página) =====
  const footerY = doc.page.height - doc.page.margins.bottom + 15;
  
  // Línea decorativa
  doc.moveTo(startX, footerY - 5).lineTo(startX + CONTENT_W, footerY - 5)
     .strokeColor(COLORS.primary).lineWidth(2).stroke();
  
  doc.font('Helvetica-Bold').fontSize(FONTS.small).fillColor(COLORS.primary);
  const contacto = brand.footer || 'Nardeli - Salón de Eventos';
  doc.text(contacto, startX, footerY + 5);
  
  doc.font('Helvetica').fontSize(FONTS.tiny).fillColor(COLORS.textMuted);
  doc.text('contacto@nardeli.mx • +52 000 000 0000', startX, footerY + 18);

  doc.end();
}

module.exports = { streamReservaPDF };