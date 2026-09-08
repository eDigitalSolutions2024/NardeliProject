// backend/services/encuestaPdf.js
const PDFDocument = require('pdfkit');
const path = require('path');
const fs = require('fs');

const EncuestaSatisfaccion = require('../models/EncuestaSatisfaccion');
const { LOMEJOR_TAGS, QUEMEJORAR_TAGS, COMIDA_TAGS, CANDYBAR_TAGS } = require('../constants/surveyTags');

function tagsToLabel(tags, catalog) {
  if (!Array.isArray(tags) || tags.length === 0) return '';
  return tags.map(t => catalog.find(c => c.tag === t)?.etiqueta || t).join(', ');
}

/** ================== Tema Nardeli (morados) ================== */
const THEME = {
  primary:   '#6D28D9',
  primaryDk: '#4C1D95',
  text:      '#1f2937',
  muted:     '#4b5563',
  border:    '#e5e7eb',
  success:   '#16A34A',
  error:     '#DC2626',
  star:      '#F59E0B',
  starEmpty: '#D9D9E3',
};

function fmtDate(d) {
  try {
    const date = new Date(d);
    if (isNaN(date.getTime())) return '';
    return date.toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' });
  } catch {
    return '';
  }
}

function fmtDateTime(d) {
  try {
    const date = new Date(d);
    if (isNaN(date.getTime())) return '';
    return fmtDate(date) + ' ' + date.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
}

function drawLogoIfAny(doc, logoPath, x, y, w) {
  try {
    if (logoPath && fs.existsSync(logoPath)) doc.image(logoPath, x, y, { width: w });
  } catch {}
}

// Estrellas dibujadas como polígonos vectoriales — evita depender de que la
// fuente base de PDFKit (Helvetica) tenga el glifo ★, que no lo tiene y
// renderiza como un carácter roto.
function starPolygonPoints(cx, cy, outerR, innerR) {
  const pts = [];
  for (let i = 0; i < 10; i++) {
    const angle = -Math.PI / 2 + (i * Math.PI) / 5;
    const r = i % 2 === 0 ? outerR : innerR;
    pts.push([cx + r * Math.cos(angle), cy + r * Math.sin(angle)]);
  }
  return pts;
}

function drawStars(doc, { value, x, y, size = 12, gap = 3 }) {
  const outerR = size / 2;
  const innerR = outerR * 0.42;
  for (let i = 0; i < 5; i++) {
    const cx = x + i * (size + gap) + outerR;
    const cy = y + outerR;
    doc.polygon(...starPolygonPoints(cx, cy, outerR, innerR)).fill(i < value ? THEME.star : THEME.starEmpty);
  }
}

function ensureSpace(doc, needed, margins) {
  const bottom = doc.page.height - margins.bottom;
  if (doc.y + needed > bottom) {
    doc.addPage();
    return true;
  }
  return false;
}

function sectionLabel(doc, text, margins, contentW) {
  ensureSpace(doc, 15, margins);
  doc.font('Helvetica-Bold').fontSize(10).fillColor(THEME.primaryDk).text(text, margins.left, doc.y, { width: contentW });
  doc.y += 1;
}

function sectionText(doc, text, margins, contentW) {
  ensureSpace(doc, 12, margins);
  doc.font('Helvetica').fontSize(9).fillColor(THEME.text).text(text, margins.left, doc.y, { width: contentW });
  doc.y += 5;
}

// Fila compacta "Pregunta   Respuesta" en una sola línea (para Sí/No y respuestas cortas)
function answerRow(doc, label, value, margins, contentW, valueColor) {
  if (!value) return;
  ensureSpace(doc, 14, margins);
  doc.font('Helvetica-Bold').fontSize(9.5).fillColor(THEME.primaryDk)
    .text(label, margins.left, doc.y, { continued: true });
  doc.font('Helvetica-Bold').fontSize(9.5).fillColor(valueColor || THEME.text).text('  ' + value);
  doc.y += 4;
}

/** ================== Export principal ================== */
async function streamEncuestaPdf(res, reservaId) {
  const encuesta = await EncuestaSatisfaccion.findOne({ reservaId });
  if (!encuesta) {
    res.status(404).send('Encuesta no encontrada');
    return;
  }

  const margins = { top: 34, left: 38, right: 38, bottom: 34 };
  const doc = new PDFDocument({ size: 'LETTER', margins });

  res.setHeader('Content-Type', 'application/pdf');
  const nameSafe = (encuesta.cliente || 'cliente').replace(/[^\w\d\-_\. ]+/g, '').slice(0, 40);
  res.setHeader('Content-Disposition', `inline; filename="Encuesta-${nameSafe}.pdf"`);

  doc.pipe(res);

  const pageW = doc.page.width;
  const contentW = pageW - margins.left - margins.right;

  // ===== Encabezado =====
  drawLogoIfAny(doc, path.join(__dirname, '..', 'uploads', 'Nardeli-05.png'), margins.left, margins.top, 56);

  doc.font('Helvetica-Bold').fontSize(16).fillColor(THEME.primaryDk)
    .text('ENCUESTA DE SATISFACCIÓN', margins.left + 68, margins.top + 2, { width: contentW - 68 });

  doc.font('Helvetica').fontSize(9).fillColor(THEME.muted)
    .text(`Respondida: ${fmtDateTime(encuesta.createdAt)}`, margins.left + 68, margins.top + 20);

  let y = margins.top + 52;
  doc.moveTo(margins.left, y).lineTo(pageW - margins.right, y).strokeColor(THEME.border).lineWidth(1).stroke();
  y += 10;
  doc.y = y;

  // ===== Datos del evento =====
  const infoRow = (label, value) => {
    if (!value) return;
    ensureSpace(doc, 13, margins);
    doc.font('Helvetica-Bold').fontSize(9).fillColor('#111').text(label, margins.left, doc.y, { width: 100, continued: true });
    doc.font('Helvetica').fontSize(9).fillColor(THEME.text).text(' ' + value);
    doc.y += 1;
  };

  infoRow('Cliente:', encuesta.cliente);
  infoRow('Tipo de evento:', encuesta.tipoEvento);
  infoRow('Fecha del evento:', encuesta.fecha ? fmtDate(encuesta.fecha) : '');
  infoRow('Salón:', encuesta.salon);
  infoRow('Correo:', encuesta.correo);
  infoRow('Teléfono:', encuesta.telefono);
  doc.y += 6;

  // ===== Calificación general =====
  sectionLabel(doc, 'Calificación general', margins, contentW);
  ensureSpace(doc, 18, margins);
  drawStars(doc, { value: encuesta.calificacionGeneral, x: margins.left, y: doc.y, size: 14 });
  doc.font('Helvetica-Bold').fontSize(10).fillColor(THEME.text)
    .text(`${encuesta.calificacionGeneral}/5`, margins.left + 98, doc.y + 1);
  doc.y += 20;

  // ===== Calificaciones por categoría (2 columnas para ahorrar espacio) =====
  if (encuesta.calificaciones && encuesta.calificaciones.length > 0) {
    sectionLabel(doc, 'Calificación por categoría', margins, contentW);
    doc.y += 2;
    const colGap = 16;
    const colW = (contentW - colGap) / 2;
    const cals = encuesta.calificaciones;
    for (let i = 0; i < cals.length; i += 2) {
      ensureSpace(doc, 14, margins);
      const rowY = doc.y;
      const left = cals[i];
      const right = cals[i + 1];

      doc.font('Helvetica').fontSize(8.5).fillColor(THEME.text).text(left.etiqueta, margins.left, rowY, { width: colW - 70 });
      drawStars(doc, { value: left.valor, x: margins.left + colW - 66, y: rowY - 1, size: 9 });

      if (right) {
        const rightX = margins.left + colW + colGap;
        doc.font('Helvetica').fontSize(8.5).fillColor(THEME.text).text(right.etiqueta, rightX, rowY, { width: colW - 70 });
        drawStars(doc, { value: right.valor, x: rightX + colW - 66, y: rowY - 1, size: 9 });
      }
      doc.y = rowY + 13;
    }
    doc.y += 6;
  }

  // ===== Preguntas Sí/No y canal =====
  answerRow(doc, '¿Recomendaría Nardeli?', encuesta.recomendaria ? 'Sí' : 'No', margins, contentW, encuesta.recomendaria ? THEME.success : THEME.error);
  answerRow(doc, '¿Volvería a contratar Nardeli?', encuesta.volveriaContratar ? 'Sí' : 'No', margins, contentW, encuesta.volveriaContratar ? THEME.success : THEME.error);
  answerRow(doc, '¿Cómo se enteró de Nardeli?', encuesta.canalReferencia, margins, contentW);
  doc.y += 4;

  // ===== Aspectos destacados / a mejorar =====
  if (encuesta.comidaTags && encuesta.comidaTags.length > 0) {
    sectionLabel(doc, 'Lo que destacó de la comida', margins, contentW);
    sectionText(doc, tagsToLabel(encuesta.comidaTags, COMIDA_TAGS), margins, contentW);
  }
  if (encuesta.candybarTags && encuesta.candybarTags.length > 0) {
    sectionLabel(doc, 'Lo que destacó del candy bar', margins, contentW);
    sectionText(doc, tagsToLabel(encuesta.candybarTags, CANDYBAR_TAGS), margins, contentW);
  }
  if (encuesta.loMejor && encuesta.loMejor.length > 0) {
    sectionLabel(doc, 'Lo mejor de la experiencia', margins, contentW);
    sectionText(doc, tagsToLabel(encuesta.loMejor, LOMEJOR_TAGS), margins, contentW);
  }
  if (encuesta.queMejorar && encuesta.queMejorar.length > 0) {
    sectionLabel(doc, 'Qué podríamos mejorar', margins, contentW);
    sectionText(doc, tagsToLabel(encuesta.queMejorar, QUEMEJORAR_TAGS), margins, contentW);
  }

  if (encuesta.testimonioAutorizado) {
    ensureSpace(doc, 13, margins);
    doc.circle(margins.left + 3, doc.y + 5, 3).fill(THEME.success);
    doc.font('Helvetica-Bold').fontSize(8.5).fillColor(THEME.success)
      .text('Autorizó usar su valoración como testimonio', margins.left + 12, doc.y, { width: contentW - 12 });
    doc.y += 12;
  }

  // ===== Firma =====
  doc.y += 4;
  sectionLabel(doc, `Firma de ${encuesta.firmante}`, margins, contentW);
  ensureSpace(doc, 78, margins);
  const firmaPath = encuesta.firmaUrl ? path.join(__dirname, '..', 'uploads', 'encuestas', encuesta.firmaUrl.split('/').pop()) : null;
  try {
    if (firmaPath && fs.existsSync(firmaPath)) {
      doc.roundedRect(margins.left, doc.y, 200, 70, 4).lineWidth(1).strokeColor(THEME.border).stroke();
      doc.image(firmaPath, margins.left + 4, doc.y + 4, { fit: [192, 62] });
      doc.y += 78;
    }
  } catch {}

  // Footer contacto — se coloca en el flujo normal (no en una posición absoluta
  // más allá del margen inferior), ya que eso hace que PDFKit añada una página extra.
  doc.y += 16;
  ensureSpace(doc, 12, margins);
  doc.font('Helvetica').fontSize(8).fillColor('#6b7280')
    .text('Tel: 656 105 6717   •   eventosnardeli@gmail.com', margins.left, doc.y, {
      width: contentW, align: 'right',
    });

  doc.end();
}

module.exports = { streamEncuestaPdf };
