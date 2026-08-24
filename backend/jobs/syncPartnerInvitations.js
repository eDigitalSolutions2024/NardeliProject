const axios = require('axios');
const InvitacionQR = require('../models/InvitacionQR');
const Setting = require('../models/Setting');

const PARTNER_API_BASE_URL = process.env.PARTNER_API_BASE_URL;
const PARTNER_API_INTERNAL_KEY = process.env.PARTNER_API_INTERNAL_KEY;
const SYNC_INTERVAL_MS = 2 * 60 * 1000; // 2 minutos — tolerante a conectividad intermitente en el venue
const SETTING_KEY = 'lastPartnerInvitationsSyncAt';

async function fetchPartnerInvitations(since) {
  const resp = await axios.get(`${PARTNER_API_BASE_URL}/internal/admin/invitations-sync`, {
    params: since ? { since: since.toISOString() } : {},
    headers: { 'X-Internal-Admin-Key': PARTNER_API_INTERNAL_KEY },
    timeout: 15000,
  });
  return resp.data.data;
}

// item: { id, company_id, event_id, guest_name, authorized_count, status, qr_code, updated_at }
async function upsertOne(item) {
  const estadoDestino = item.status === 'cancelled' || item.status === 'expired' ? 'cancelada' : 'activa';
  const existing = await InvitacionQR.findOne({ partnerInvitationId: item.id });

  if (!existing) {
    await InvitacionQR.create({
      // eventId en la Partner API ES el _id de la Reserva de legacy (ver IssueEventAccessUseCase).
      reservaId: item.event_id,
      nombreFamilia: item.guest_name,
      personasAutorizadas: item.authorized_count,
      entradasRestantes: estadoDestino === 'cancelada' ? 0 : item.authorized_count,
      qrToken: item.qr_code,
      estado: estadoDestino,
      creadoPor: 'empresa-partner',
      partnerInvitationId: item.id,
      partnerCompanyId: item.company_id,
      partnerAuthorizedCount: item.authorized_count,
    });
    return { created: true, updated: false };
  }

  const updates = {};
  if (item.guest_name !== existing.nombreFamilia) {
    updates.nombreFamilia = item.guest_name;
  }
  if (estadoDestino === 'cancelada' && existing.estado !== 'cancelada') {
    updates.estado = 'cancelada';
  }
  // Nunca sobrescribir entradasRestantes/personasAutorizadas directo con lo que manda la
  // Partner API — el admin de Nardeli puede haberlas editado a mano desde entonces. El
  // delta se calcula contra partnerAuthorizedCount (lo último que sabíamos DE LA EMPRESA),
  // no contra personasAutorizadas (lo que Nardeli tiene autorizado ahora mismo), y se aplica
  // ese mismo delta sobre ambos campos — así conviven ediciones de ambos lados sin pisarse.
  const previousPartnerCount = existing.partnerAuthorizedCount ?? existing.personasAutorizadas;
  if (item.authorized_count !== previousPartnerCount) {
    const delta = item.authorized_count - previousPartnerCount;
    updates.personasAutorizadas = Math.max(1, existing.personasAutorizadas + delta);
    updates.entradasRestantes = Math.max(0, existing.entradasRestantes + delta);
    updates.partnerAuthorizedCount = item.authorized_count;
  }

  if (Object.keys(updates).length === 0) {
    return { created: false, updated: false };
  }
  await InvitacionQR.updateOne({ _id: existing._id }, { $set: updates });
  return { created: false, updated: true };
}

async function syncPartnerInvitations({ full = false } = {}) {
  if (!PARTNER_API_BASE_URL || !PARTNER_API_INTERNAL_KEY) {
    console.error('[sync-partner] Faltan PARTNER_API_BASE_URL / PARTNER_API_INTERNAL_KEY en el .env');
    return { ok: false };
  }

  // Se guarda el momento en que ARRANCA este sync, no en el que termina — así, si algo
  // cambia en Partner API mientras se procesa este batch, el próximo `since` lo sigue cubriendo.
  const syncStartedAt = new Date();

  let since = null;
  if (!full) {
    const setting = await Setting.findOne({ key: SETTING_KEY });
    since = setting ? new Date(setting.value) : null;
  }

  let items;
  try {
    items = await fetchPartnerInvitations(since);
  } catch (err) {
    console.error('[sync-partner] Error consultando Partner API:', err?.response?.data || err.message);
    return { ok: false };
  }

  let created = 0;
  let updated = 0;
  let failed = 0;
  for (const item of items) {
    try {
      // eslint-disable-next-line no-await-in-loop
      const r = await upsertOne(item);
      if (r.created) created++;
      if (r.updated) updated++;
    } catch (err) {
      // Un item con problemas (ej. choque de qrToken con un registro viejo/manual) nunca
      // debe tumbar el proceso ni bloquear el resto del batch.
      failed++;
      console.error(`[sync-partner] Error sincronizando invitación ${item.id}:`, err.message);
    }
  }

  await Setting.findOneAndUpdate(
    { key: SETTING_KEY },
    { key: SETTING_KEY, value: syncStartedAt.toISOString() },
    { upsert: true },
  );

  console.log(
    `[sync-partner] ${new Date().toISOString()} — ${items.length} recibidas, ${created} creadas, ${updated} actualizadas, ${failed} con error${full ? ' (resync completo)' : ''}`,
  );
  return { ok: true, received: items.length, created, updated, failed };
}

function syncPartnerInvitationsFull() {
  return syncPartnerInvitations({ full: true });
}

function runSyncSafely() {
  // Red de seguridad adicional: aunque syncPartnerInvitations ya atrapa errores por item
  // y por lote, un setInterval/setTimeout con una promesa rechazada sin capturar puede
  // tumbar el proceso en Node moderno — nunca dejar que este job se lleve el servidor.
  syncPartnerInvitations({ full: false }).catch((err) => {
    console.error('[sync-partner] Error inesperado en el job:', err.message);
  });
}

function startSyncJob() {
  console.log('[sync-partner] Job activo: sincronizando QR de empresas partner cada 2 min');
  setTimeout(runSyncSafely, 30_000);
  setInterval(runSyncSafely, SYNC_INTERVAL_MS);
}

module.exports = { startSyncJob, syncPartnerInvitations, syncPartnerInvitationsFull };
