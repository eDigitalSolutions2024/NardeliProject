// backend/services/encuestaPdf.js
const PDFDocument = require('pdfkit');
const path = require('path');
const fs = require('fs');

const EncuestaSatisfaccion = require('../models/EncuestaSatisfaccion');

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

function drawStars(doc, { value, x, y, size = 12, gap = 3 }) {
  for (let i = 0; i < 5; i++) {
    doc.font('Helvetica').fontSize(size).fillColor(i < value ? THEME.star : '#d1d5db')
      .text('★', x + i * (size * 0.85 + gap), y);
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
  ensureSpace(doc, 20, margins);
  doc.font('Helvetica-Bold').fontSize(11).fillColor(THEME.primaryDk).text(text, margins.left, doc.y, { width: contentW });
  doc.y += 2;
}

function sectionText(doc, text, margins, contentW) {
  ensureSpace(doc, 16, margins);
  doc.font('Helvetica').fontSize(10).fillColor(THEME.text).text(text, margins.left, doc.y, { width: contentW });
  doc.y += 8;
}

/** ================== Export principal ================== */
async function streamEncuestaPdf(res, reservaId) {
  const encuesta = await EncuestaSatisfaccion.findOne({ reservaId });
  if (!encuesta) {
    res.status(404).send('Encuesta no encontrada');
    return;
  }

  const margins = { top: 40, left: 40, right: 40, bottom: 44 };
  const doc = new PDFDocument({ size: 'LETTER', margins });

  res.setHeader('Content-Type', 'application/pdf');
  const nameSafe = (encuesta.cliente || 'cliente').replace(/[^\w\d\-_\. ]+/g, '').slice(0, 40);
  res.setHeader('Content-Disposition', `inline; filename="Encuesta-${nameSafe}.pdf"`);

  doc.pipe(res);

  const pageW = doc.page.width;
  const contentW = pageW - margins.left - margins.right;

  // ===== Encabezado =====
  drawLogoIfAny(doc, path.join(__dirname, '..', 'uploads', 'Nardeli-05.png'), margins.left, margins.top, 70);

  doc.font('Helvetica-Bold').fontSize(18).fillColor(THEME.primaryDk)
    .text('ENCUESTA DE SATISFACCIÓN', margins.left + 90, margins.top + 4, { width: contentW - 90 });

  doc.font('Helvetica').fontSize(10).fillColor(THEME.muted)
    .text(`Respondida: ${fmtDateTime(encuesta.createdAt)}`, margins.left + 90, margins.top + 28);

  let y = margins.top + 74;
  doc.moveTo(margins.left, y).lineTo(pageW - margins.right, y).strokeColor(THEME.border).lineWidth(1).stroke();
  y += 14;
  doc.y = y;

  // ===== Datos del evento =====
  const infoRow = (label, value) => {
    if (!value) return;
    ensureSpace(doc, 16, margins);
    doc.font('Helvetica-Bold').fontSize(10).fillColor('#111').text(label, margins.left, doc.y, { width: 140, continued: true });
    doc.font('Helvetica').fontSize(10).fillColor(THEME.text).text(' ' + value);
    doc.y += 2;
  };

  infoRow('Cliente:', encuesta.cliente);
  infoRow('Tipo de evento:', encuesta.tipoEvento);
  infoRow('Fecha del evento:', encuesta.fecha ? fmtDate(encuesta.fecha) : '');
  infoRow('Salón:', encuesta.salon);
  infoRow('Correo:', encuesta.correo);
  infoRow('Teléfono:', encuesta.telefono);
  doc.y += 8;

  // ===== Calificación general =====
  sectionLabel(doc, 'Calificación general', margins, contentW);
  ensureSpace(doc, 20, margins);
  drawStars(doc, { value: encuesta.calificacionGeneral, x: margins.left, y: doc.y, size: 16 });
  doc.font('Helvetica-Bold').fontSize(11).fillColor(THEME.text)
    .text(`${encuesta.calificacionGeneral}/5`, margins.left + 110, doc.y);
  doc.y += 22;

  // ===== Calificaciones por categoría =====
  if (encuesta.calificaciones && encuesta.calificaciones.length > 0) {
    sectionLabel(doc, 'Calificación por categoría', margins, contentW);
    for (const c of encuesta.calificaciones) {
      ensureSpace(doc, 18, margins);
      doc.font('Helvetica').fontSize(10).fillColor(THEME.text).text(c.etiqueta, margins.left, doc.y, { width: 220 });
      drawStars(doc, { value: c.valor, x: margins.left + 230, y: doc.y - 12, size: 12 });
      doc.y += 6;
    }
    doc.y += 8;
  }

  // ===== Preguntas Sí/No =====
  sectionLabel(doc, '¿Recomendaría Nardeli?', margins, contentW);
  sectionText(doc, encuesta.recomendaria ? 'Sí 👍' : 'No 👎', margins, contentW);

  sectionLabel(doc, '¿Volvería a contratar Nardeli?', margins, contentW);
  sectionText(doc, encuesta.volveriaContratar ? 'Sí 👍' : 'No 👎', margins, contentW);

  sectionLabel(doc, '¿Cómo se enteró de Nardeli?', margins, contentW);
  sectionText(doc, encuesta.canalReferencia, margins, contentW);

  // ===== Comentarios abiertos =====
  if (encuesta.opinionComida) {
    sectionLabel(doc, 'Opinión sobre la comida', margins, contentW);
    sectionText(doc, encuesta.opinionComida, margins, contentW);
  }
  if (encuesta.opinionCandybar) {
    sectionLabel(doc, 'Opinión sobre el candy bar', margins, contentW);
    sectionText(doc, encuesta.opinionCandybar, margins, contentW);
  }
  if (encuesta.loMejor) {
    sectionLabel(doc, 'Lo mejor de la experiencia', margins, contentW);
    sectionText(doc, encuesta.loMejor, margins, contentW);
  }
  if (encuesta.queMejorar) {
    sectionLabel(doc, 'Qué podríamos mejorar', margins, contentW);
    sectionText(doc, encuesta.queMejorar, margins, contentW);
  }

  if (encuesta.testimonioAutorizado) {
    ensureSpace(doc, 16, margins);
    doc.font('Helvetica-Bold').fontSize(9).fillColor(THEME.success)
      .text('✓ Autorizó usar su comentario como testimonio', margins.left, doc.y, { width: contentW });
    doc.y += 14;
  }

  // ===== Firma =====
  sectionLabel(doc, `Firma de ${encuesta.firmante}`, margins, contentW);
  ensureSpace(doc, 90, margins);
  const firmaPath = encuesta.firmaUrl ? path.join(__dirname, '..', 'uploads', 'encuestas', encuesta.firmaUrl.split('/').pop()) : null;
  try {
    if (firmaPath && fs.existsSync(firmaPath)) {
      doc.roundedRect(margins.left, doc.y, 220, 80, 4).lineWidth(1).strokeColor(THEME.border).stroke();
      doc.image(firmaPath, margins.left + 4, doc.y + 4, { fit: [212, 72] });
      doc.y += 88;
    }
  } catch {}

  // Footer contacto
  doc.font('Helvetica').fontSize(9).fillColor('#6b7280')
    .text('Tel: 656 105 6717   •   eventosnardeli@gmail.com', margins.left, doc.page.height - 34, {
      width: contentW, align: 'right',
    });

  doc.end();
}

module.exports = { streamEncuestaPdf };
