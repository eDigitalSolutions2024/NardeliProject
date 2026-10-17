// Bitácora ligera de acciones administrativas (usuarios, permisos, reservas, pagos, inventario, formatos y checklists).
// Se guarda en Setting para no crear otra colección; conserva las últimas 1000.
const Setting = require('../models/Setting');

const KEY = 'bitacora_admin';
const MAX = 1000;

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

async function listar(limit = 500) {
  const doc = await Setting.findOne({ key: KEY }).lean();
  return (doc?.value || []).slice(-limit).reverse();
}

// Borra entradas: todas ({ todo: true }) o las de un rango ISO [desde, hasta). Devuelve cuántas quitó.
async function limpiar({ todo = false, desde, hasta } = {}) {
  const doc = await Setting.findOne({ key: KEY }).lean();
  const actuales = doc?.value || [];
  let quedan;
  if (todo) quedan = [];
  else {
    const d = new Date(desde).getTime();
    const h = new Date(hasta).getTime();
    if (Number.isNaN(d) || Number.isNaN(h)) throw new Error('Rango de fechas inválido');
    quedan = actuales.filter((e) => { const t = new Date(e.fecha).getTime(); return t < d || t >= h; });
  }
  await Setting.findOneAndUpdate({ key: KEY }, { $set: { value: quedan } }, { upsert: true });
  return actuales.length - quedan.length;
}

module.exports = { registrar, listar, limpiar };
