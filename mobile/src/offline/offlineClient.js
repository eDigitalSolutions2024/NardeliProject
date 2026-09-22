import client, { setAuthToken, setUnauthorizedHandler } from '../api/client';
import { resolveEntity, ENTITY_REGISTRY } from './entityRegistry';
import { isOnline } from './connectivity';
import { getCache, putCache, getCacheByEntity, getAllCacheByEntity, updateCacheDataByKey } from './cacheStore';
import { enqueueMutation } from './mutationQueue';

export { setAuthToken, setUnauthorizedHandler };

export class OfflineNoCacheError extends Error {
  constructor(url) {
    super('Sin conexión y sin datos guardados localmente para esta pantalla.');
    this.name = 'OfflineNoCacheError';
    this.url = url;
    this.isOfflineNoCache = true;
  }
}

// URLs que NUNCA deben cachearse ni encolarse: siempre requieren red real.
const NEVER_CACHE_NEVER_QUEUE = [
  /^\/login$/,
  /^\/auth\//,
  /^\/scan-invitacion-qr\//,
];

function isExcluded(url) {
  return NEVER_CACHE_NEVER_QUEUE.some((re) => re.test(url));
}

function isNetworkError(error) {
  // axios: error.response existe si el servidor respondió (aunque sea 4xx/5xx).
  // Si no hay response, fue un problema de red/timeout real.
  return !error?.response;
}

async function get(url, config) {
  if (isExcluded(url)) {
    return client.get(url, config);
  }

  const entity = resolveEntity(url);
  const params = config?.params;

  if (isOnline()) {
    try {
      const res = await client.get(url, config);
      await putCache({
        method: 'GET',
        url,
        params,
        entityType: entity?.type,
        entityId: entity?.id,
        data: res.data,
        status: res.status,
        updatedAtRemote: entity ? ENTITY_REGISTRY[entity.type]?.extractUpdatedAt(res.data) : null,
      });
      return res;
    } catch (error) {
      if (isNetworkError(error)) {
        const cached = await getCache('GET', url, params);
        if (cached) return { data: cached.data, status: cached.status, __offlineFromCache: true };
      }
      throw error;
    }
  }

  const cached = await getCache('GET', url, params);
  if (cached) return { data: cached.data, status: cached.status, __offlineFromCache: true };
  throw new OfflineNoCacheError(url);
}

// Actualiza optimistamente todas las entradas de cache conocidas de una
// entidad, mezclando el body de la mutación sobre lo que ya se tenía. Es un
// merge superficial (shallow): suficiente para que la pantalla, al volver a
// leer, vea reflejado su propio cambio mientras espera la sincronización.
async function optimisticMerge(entityType, entityId, body) {
  if (!entityType || !entityId || !body || typeof body !== 'object') return;
  const rows = await getAllCacheByEntity(entityType, entityId);
  for (const row of rows) {
    const merged = row.data && typeof row.data === 'object' && !Array.isArray(row.data)
      ? { ...row.data, ...body }
      : row.data;
    await updateCacheDataByKey(row.cacheKey, merged, row.status);
  }
}

// axios: delete(url, config) toma 2 argumentos; post/put/patch toman 3
// (url, body, config). Sin este caso especial, un DELETE perdería su config.
function callAxios(method, url, body, config) {
  const fn = client[method.toLowerCase()];
  return method === 'DELETE' ? fn(url, config) : fn(url, body, config);
}

async function mutate(method, url, body, config) {
  if (isExcluded(url)) {
    return callAxios(method, url, body, config);
  }

  const entity = resolveEntity(url);

  if (isOnline()) {
    try {
      const res = await callAxios(method, url, body, config);
      if (entity) {
        // Refresca lo que sepamos localmente de esta entidad con la
        // respuesta recién confirmada por el servidor (mejor que nada,
        // aunque no sea el documento completo).
        await optimisticMerge(entity.type, entity.id, body);
      }
      return res;
    } catch (error) {
      if (!isNetworkError(error)) throw error; // error real de negocio, no se encola
      // Se cayó la red justo al mandar: se encola igual, para no perder el cambio.
    }
  }

  const baseline = entity ? await getCacheByEntity(entity.type, entity.id) : null;
  await enqueueMutation({
    method,
    url,
    body,
    entityType: entity?.type,
    entityId: entity?.id,
    baseUpdatedAt: baseline?.updatedAtRemote || null,
  });
  if (entity) await optimisticMerge(entity.type, entity.id, body);

  return { data: { success: true, queued: true }, status: 202, __offlineQueued: true };
}

export default {
  get: (url, config) => get(url, config),
  post: (url, body, config) => mutate('POST', url, body, config),
  put: (url, body, config) => mutate('PUT', url, body, config),
  patch: (url, body, config) => mutate('PATCH', url, body, config),
  delete: (url, config) => mutate('DELETE', url, undefined, config),
};
