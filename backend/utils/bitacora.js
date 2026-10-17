// Bitácora ligera de acciones administrativas (usuarios y permisos).
// Se guarda en Setting para no crear otra colección; conserva las últimas 300.
const Setting = require('../models/Setting');

const KEY = 'bitacora_admin';
const MAX = 300;

async function registrar(actor, accion, detalle = {}) {
  try {
    const entrada = {
      fecha: new Date().toISOString(),
      actor: actor?.email || String(actor?.sub || ''),
      accion,
      detalle,
    };
    await Setting.findOneAndUpdate(
      { key: KEY },
      { $push: { value: { $each: [entrada], $slice: -MAX } } },
      { upsert: true }
    );
  } catch (e) {
    console.error('[bitacora] no se pudo registrar:', e.message);
  }
}

async function listar(limit = 100) {
  const doc = await Setting.findOne({ key: KEY }).lean();
  return (doc?.value || []).slice(-limit).reverse();
}

module.exports = { registrar, listar };
