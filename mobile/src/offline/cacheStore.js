import { getDb } from './db';

// Incorpora los query params (si hay) a la clave de cache, ordenados por
// nombre, para que /reservas, /reservas?tipo=evento y /reservas?correo=x
// no colisionen en la misma entrada.
export function cacheKeyFor(method, url, params) {
  const base = `${String(method).toUpperCase()} ${url}`;
  if (!params || typeof params !== 'object' || Object.keys(params).length === 0) return base;
  const qs = Object.keys(params)
    .sort()
    .map((k) => `${k}=${params[k]}`)
    .join('&');
  return `${base}?${qs}`;
}

// Guarda/actualiza la última respuesta buena de un GET.
export async function putCache({ method, url, params, entityType, entityId, data, status, updatedAtRemote }) {
  const db = await getDb();
  const key = cacheKeyFor(method, url, params);
  await db.runAsync(
    `INSERT INTO offline_cache (cache_key, url, entity_type, entity_id, response_json, updated_at_remote, fetched_at)
     VALUES ($key, $url, $entity_type, $entity_id, $response_json, $updated_at_remote, $fetched_at)
     ON CONFLICT(cache_key) DO UPDATE SET
       response_json = excluded.response_json,
       updated_at_remote = excluded.updated_at_remote,
       fetched_at = excluded.fetched_at,
       entity_type = excluded.entity_type,
       entity_id = excluded.entity_id`,
    {
      $key: key,
      $url: url,
      $entity_type: entityType || null,
      $entity_id: entityId || null,
      $response_json: JSON.stringify({ data, status }),
      $updated_at_remote: updatedAtRemote || null,
      $fetched_at: Date.now(),
    }
  );
}

export async function getCache(method, url, params) {
  const db = await getDb();
  const key = cacheKeyFor(method, url, params);
  const row = await db.getFirstAsync(
    'SELECT * FROM offline_cache WHERE cache_key = $key',
    { $key: key }
  );
  if (!row) return null;
  const parsed = JSON.parse(row.response_json);
  return {
    data: parsed.data,
    status: parsed.status,
    updatedAtRemote: row.updated_at_remote,
    fetchedAt: row.fetched_at,
  };
}

// Última respuesta cacheada de una entidad conocida (para leer su
// updatedAt sin depender de recordar la URL exacta que la trajo).
export async function getCacheByEntity(entityType, entityId) {
  const db = await getDb();
  const row = await db.getFirstAsync(
    `SELECT * FROM offline_cache WHERE entity_type = $t AND entity_id = $id
     ORDER BY fetched_at DESC LIMIT 1`,
    { $t: entityType, $id: entityId }
  );
  if (!row) return null;
  const parsed = JSON.parse(row.response_json);
  return {
    data: parsed.data,
    status: parsed.status,
    updatedAtRemote: row.updated_at_remote,
    fetchedAt: row.fetched_at,
  };
}

// TODAS las entradas de cache de una entidad (puede haber varias GET
// distintas cacheadas para el mismo recurso, ej. /reservas/:id y
// /reservas/:id/utensilios). Se usa para actualización optimista tras una
// mutación offline.
export async function getAllCacheByEntity(entityType, entityId) {
  const db = await getDb();
  const rows = await db.getAllAsync(
    `SELECT * FROM offline_cache WHERE entity_type = $t AND entity_id = $id`,
    { $t: entityType, $id: entityId }
  );
  return rows.map((row) => {
    const parsed = JSON.parse(row.response_json);
    return {
      cacheKey: row.cache_key,
      url: row.url,
      data: parsed.data,
      status: parsed.status,
      updatedAtRemote: row.updated_at_remote,
      fetchedAt: row.fetched_at,
    };
  });
}

// Sobreescribe solo el campo `data` de una entrada de cache ya existente
// (identificada por su cache_key), sin tocar updated_at_remote — se usa
// para reflejar optimistamente un cambio local mientras no hay red.
export async function updateCacheDataByKey(cacheKey, newData, newStatus) {
  const db = await getDb();
  await db.runAsync(
    `UPDATE offline_cache SET response_json = $response_json WHERE cache_key = $key`,
    { $key: cacheKey, $response_json: JSON.stringify({ data: newData, status: newStatus }) }
  );
}

// Reemplaza por completo la entrada de cache de una entidad con un
// documento fresco del servidor (usado al resolver un conflicto a favor
// del servidor, o tras aplicar una mutación exitosa durante el sync).
export async function replaceCacheForEntity(entityType, entityId, freshData, updatedAtRemote) {
  const rows = await getAllCacheByEntity(entityType, entityId);
  for (const row of rows) {
    await updateCacheDataByKey(row.cacheKey, freshData, row.status);
  }
  const db = await getDb();
  await db.runAsync(
    `UPDATE offline_cache SET updated_at_remote = $u WHERE entity_type = $t AND entity_id = $id`,
    { $t: entityType, $id: entityId, $u: updatedAtRemote || null }
  );
}
