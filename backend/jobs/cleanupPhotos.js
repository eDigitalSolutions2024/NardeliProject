const fs = require('fs');
const path = require('path');
const EventChecklist = require('../models/EventChecklist');
const Reserva = require('../models/Reservas');

const UPLOADS_DIR = path.join(__dirname, '..', 'uploads', 'checklists');
const DAYS_AFTER_EVENT = 7;

async function cleanupOldEventPhotos() {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - DAYS_AFTER_EVENT);

  // Eventos cuya fecha fue hace más de 7 días
  const oldEvents = await Reserva.find({ fecha: { $lt: cutoff } }).select('_id').lean();
  if (!oldEvents.length) return;

  const eventIds = oldEvents.map(e => e._id.toString());

  // Checklists de esos eventos que aún tienen evidencias
  const checklists = await EventChecklist.find({
    eventExternalId: { $in: eventIds },
    'items.evidence.0': { $exists: true }
  });

  if (!checklists.length) return;

  let deletedFiles = 0;
  let deletedBytes = 0;

  for (const checklist of checklists) {
    let modified = false;
    for (const item of checklist.items) {
      if (!item.evidence.length) continue;
      for (const ev of item.evidence) {
        if (ev.filename) {
          const filePath = path.join(UPLOADS_DIR, ev.filename);
          try {
            if (fs.existsSync(filePath)) {
              deletedBytes += ev.size || 0;
              fs.unlinkSync(filePath);
              deletedFiles++;
            }
          } catch (e) {
            console.error(`[cleanup] Error al borrar ${ev.filename}:`, e.message);
          }
        }
      }
      item.evidence = [];
      modified = true;
    }
    if (modified) await checklist.save();
  }

  if (deletedFiles > 0) {
    const mb = (deletedBytes / (1024 * 1024)).toFixed(1);
    console.log(`[cleanup] ${new Date().toISOString()} — ${deletedFiles} fotos eliminadas (${mb} MB) de ${checklists.length} checklists`);
  } else {
    console.log(`[cleanup] ${new Date().toISOString()} — Sin fotos antiguas que limpiar`);
  }
}

function startCleanupJob() {
  console.log(`[cleanup] Job activo: fotos de eventos eliminadas ${DAYS_AFTER_EVENT} días después del evento`);
  // Primera ejecución 30 segundos después del arranque (DB ya conectada)
  setTimeout(cleanupOldEventPhotos, 30_000);
  // Luego cada 24 horas
  setInterval(cleanupOldEventPhotos, 24 * 60 * 60 * 1000);
}

module.exports = { startCleanupJob, cleanupOldEventPhotos };
