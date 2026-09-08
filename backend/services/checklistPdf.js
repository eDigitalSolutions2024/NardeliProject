// backend/services/checklistPdf.js
const PDFDocument = require('pdfkit');
const path = require('path');
const fs = require('fs');

const EventChecklist = require('../models/EventChecklist');

/** ================== Tema Nardeli (morados) ================== */
const THEME = {
  primary:   '#6D28D9',
  primaryLt: '#A78BFA',
  primaryDk: '#4C1D95',
  text:      '#1f2937',
  muted:     '#4b5563',
  border:    '#e5e7eb',
  success:   '#16A34A',
  warning:   '#D97706',
};

function fmtDate(d) {
  try {
    const date = new Date(d);
    if (isNaN(date.getTime())) return '';
    return date.toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' })
      + ' ' + date.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
}

function drawCheckbox(doc, { checked = false, x, y, size = 12 }) {
  doc.roundedRect(x, y, size, size, 2).lineWidth(1).strokeColor(checked ? THEME.success : '#9ca3af').stroke();
  if (checked) {
    doc.save();
    doc
      .moveTo(x + 2, y + size / 2)
      .lineTo(x + size / 2.2, y + size - 3)
      .lineTo(x + size - 2, y + 2.5)
      .lineWidth(1.6)
      .strokeColor(THEME.success)
      .stroke();
    doc.restore();
  }
}

function drawLogoIfAny(doc, logoPath, x, y, w) {
  try {
    if (logoPath && fs.existsSync(logoPath)) doc.image(logoPath, x, y, { width: w });
  } catch {}
}

function ensureSpace(doc, needed, margins) {
  const bottom = doc.page.height - margins.bottom;
  if (doc.y + needed > bottom) {
    doc.addPage();
    return true;
  }
  return false;
}

/** ================== Export principal ================== */
async function streamChecklistPdf(res, checklistId) {
  const cl = await EventChecklist.findById(checklistId);
  if (!cl) {
    res.status(404).send('Checklist no encontrado');
    return;
  }

  const items = [...cl.items].sort((a, b) => a.order - b.order);
  const pct = cl.totalCount > 0 ? Math.round((cl.completedCount / cl.totalCount) * 100) : 0;
  const statusLabel = { pendiente: 'Pendiente', en_progreso: 'En progreso', completado: 'Completado' }[cl.status] || cl.status;
  const statusColor = { pendiente: THEME.warning, en_progreso: THEME.primary, completado: THEME.success }[cl.status] || THEME.text;

  const margins = { top: 40, left: 40, right: 40, bottom: 44 };
  const doc = new PDFDocument({ size: 'LETTER', margins });

  res.setHeader('Content-Type', 'application/pdf');
  const nameSafe = (cl.categoryName || 'checklist').replace(/[^\w\d\-_\. ]+/g, '').slice(0, 40);
  res.setHeader('Content-Disposition', `inline; filename="Checklist-${nameSafe}.pdf"`);

  doc.pipe(res);

  const pageW = doc.page.width;
  const contentW = pageW - margins.left - margins.right;

  // ===== Encabezado =====
  drawLogoIfAny(doc, path.join(__dirname, '..', 'uploads', 'Nardeli-05.png'), margins.left, margins.top, 70);

  doc.font('Helvetica-Bold').fontSize(18).fillColor(THEME.primaryDk)
    .text(`${cl.icon || '📋'}  ${cl.categoryName}`, margins.left + 90, margins.top + 4, { width: contentW - 90 });

  doc.font('Helvetica').fontSize(10).fillColor(THEME.muted)
    .text(`Checklist de evento · Generado: ${fmtDate(new Date())}`, margins.left + 90, margins.top + 28);

  doc.font('Helvetica-Bold').fontSize(10).fillColor(statusColor)
    .text(`Estado: ${statusLabel}  ·  ${cl.completedCount}/${cl.totalCount} completadas (${pct}%)`, margins.left + 90, margins.top + 44);

  let y = margins.top + 74;
  doc.moveTo(margins.left, y).lineTo(pageW - margins.right, y).strokeColor(THEME.border).lineWidth(1).stroke();
  y += 14;
  doc.y = y;

  // ===== Items =====
  for (const item of items) {
    ensureSpace(doc, 40, margins);
    y = doc.y;

    drawCheckbox(doc, { checked: item.completed, x: margins.left, y: y + 2 });

    doc.font('Helvetica-Bold').fontSize(11).fillColor(item.completed ? THEME.text : '#374151')
      .text(item.title, margins.left + 20, y, { width: contentW - 20 });
    y = doc.y + 2;

    if (item.description) {
      doc.font('Helvetica').fontSize(9).fillColor(THEME.muted)
        .text(item.description, margins.left + 20, y, { width: contentW - 20 });
      y = doc.y + 2;
    }

    if (item.observation) {
      doc.font('Helvetica-Oblique').fontSize(9).fillColor(THEME.primaryDk)
        .text(`Observación: ${item.observation}`, margins.left + 20, y, { width: contentW - 20 });
      y = doc.y + 2;
    }

    if (item.completed && item.completedAt) {
      doc.font('Helvetica').fontSize(8).fillColor('#9ca3af')
        .text(`Completado: ${fmtDate(item.completedAt)}`, margins.left + 20, y, { width: contentW - 20 });
      y = doc.y + 2;
    }

    // Evidencias (miniaturas embebidas)
    if (item.evidence && item.evidence.length > 0) {
      const thumbSize = 60;
      const gap = 8;
      const perRow = Math.max(1, Math.floor((contentW - 20) / (thumbSize + gap)));
      const rows = Math.ceil(item.evidence.length / perRow);
      ensureSpace(doc, thumbSize * Math.min(rows, 1) + 10, margins);
      y = doc.y + 4;

      let tx = margins.left + 20;
      let ty = y;
      let col = 0;
      for (const ev of item.evidence) {
        if (ensureSpace(doc, thumbSize + 10, margins)) {
          ty = doc.y;
          tx = margins.left + 20;
          col = 0;
        }
        const filename = ev.url ? ev.url.split('/').pop() : null;
        const filePath = filename ? path.join(__dirname, '..', 'uploads', 'checklists', filename) : null;
        try {
          if (filePath && fs.existsSync(filePath)) {
            doc.image(filePath, tx, ty, { width: thumbSize, height: thumbSize, fit: [thumbSize, thumbSize] });
            doc.roundedRect(tx, ty, thumbSize, thumbSize, 3).lineWidth(0.7).strokeColor(THEME.border).stroke();
          }
        } catch {}
        col++;
        if (col >= perRow) {
          col = 0;
          tx = margins.left + 20;
          ty += thumbSize + gap;
        } else {
          tx += thumbSize + gap;
        }
      }
      doc.y = ty + thumbSize + 6;
      y = doc.y;
    }

    doc.moveTo(margins.left, doc.y + 4).lineTo(pageW - margins.right, doc.y + 4).strokeColor(THEME.border).lineWidth(0.5).stroke();
    doc.y = doc.y + 12;
  }

  // Footer contacto en última página
  doc.font('Helvetica').fontSize(9).fillColor('#6b7280')
    .text('Tel: 656 105 6717   •   eventosnardeli@gmail.com', margins.left, doc.page.height - 34, {
      width: contentW, align: 'right',
    });

  doc.end();
}

module.exports = { streamChecklistPdf };
