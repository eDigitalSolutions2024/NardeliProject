import client from '../api/client';
import { ENTITY_REGISTRY } from './entityRegistry';
import { isOnline } from './connectivity';
import {
  getPendingMutations,
  getMutation,
  markSyncing,
  setStatus,
  deleteMutation,
} from './mutationQueue';
import { addConflict, getConflict, resolveConflict } from './conflictStore';
import { replaceCacheForEntity } from './cacheStore';

let syncing = false;

function bodyOf(row) {
  try {
    return row.body_json ? JSON.parse(row.body_json) : undefined;
  } catch {
    return undefined;
  }
}

function isNetworkError(error) {
  return !error?.response;
}

async function applyMutation(row) {
  const body = bodyOf(row);
  const method = String(row.method).toLowerCase();
  if (method === 'delete') return client.delete(row.url);
  return client[method](row.url, body);
}

// Recorre la cola de mutaciones pendientes, en orden, y por cada una:
//  - si su entidad es conocida, revisa si el servidor cambió desde que se
//    hizo la edición offline (comparando updatedAt) antes de aplicarla;
//  - si cambió, la marca como conflicto y sigue con las demás;
//  - si no cambió (o la entidad no se puede verificar), la aplica.
// Se detiene por completo si un error de RED corta la corrida (se asume que
// el resto también fallará); un error de negocio (4xx/5xx real) solo marca
// esa mutación como error y continúa con las siguientes.
export async function processQueue() {
  if (syncing) return { skipped: true };
  if (!isOnline()) return { skipped: true };
  syncing = true;

  // updatedAt ya aplicado en ESTA corrida, por entidad, para no generar
  // conflictos fantasma entre mutaciones encadenadas del mismo teléfono
  // (ej. PATCH precios seguido de PUT utensilios de la misma reserva).
  const appliedUpdatedAt = new Map();
  let appliedCount = 0;
  let conflictCount = 0;
  let errorCount = 0;

  try {
    const pending = await getPendingMutations();

    for (const row of pending) {
      await markSyncing(row.id);
      const entityKey = `${row.entity_type}:${row.entity_id}`;
      const def = ENTITY_REGISTRY[row.entity_type];

      try {
        if (def) {
          const expectedBase = appliedUpdatedAt.has(entityKey)
            ? appliedUpdatedAt.get(entityKey)
            : row.base_updated_at;

          let serverData = null;
          let serverUpdatedAt = null;
          let notFound = false;

          try {
            const res = await client.get(def.refetchUrl(row.entity_id));
            serverData = res.data;
            serverUpdatedAt = def.extractUpdatedAt(serverData);
          } catch (err) {
            if (err?.response?.status === 404) {
              notFound = true;
            } else if (isNetworkError(err)) {
              await setStatus(row.id, 'pending');
              break; // se cayó la red otra vez: reintentar todo en el próximo ciclo
            } else {
              throw err;
            }
          }

          if (notFound) {
            await addConflict({
              queueId: row.id,
              entityType: row.entity_type,
              entityId: row.entity_id,
              localPayload: bodyOf(row),
              serverPayload: null,
              localBaseUpdatedAt: expectedBase,
              serverUpdatedAt: null,
            });
            await setStatus(row.id, 'conflict');
            conflictCount += 1;
            continue;
          }

          if (expectedBase && serverUpdatedAt && String(expectedBase) !== String(serverUpdatedAt)) {
            await addConflict({
              queueId: row.id,
              entityType: row.entity_type,
              entityId: row.entity_id,
              localPayload: bodyOf(row),
              serverPayload: serverData,
              localBaseUpdatedAt: expectedBase,
              serverUpdatedAt,
            });
            await setStatus(row.id, 'conflict');
            conflictCount += 1;
            continue;
          }
        }

        // Sin conflicto (o entidad no verificable): aplicar la mutación real.
        await applyMutation(row);

        if (def) {
          // Se vuelve a pedir el documento padre para tener su updatedAt
          // fresco (encadenar mutaciones siguientes de la misma entidad) y
          // refrescar la cache local con el estado real ya confirmado.
          try {
            const fresh = await client.get(def.refetchUrl(row.entity_id));
            const freshUpdatedAt = def.extractUpdatedAt(fresh.data);
            appliedUpdatedAt.set(entityKey, freshUpdatedAt);
            await replaceCacheForEntity(row.entity_type, row.entity_id, fresh.data, freshUpdatedAt);
          } catch {
            // si el refetch post-aplicación falla, no es grave: se pierde
            // solo la oportunidad de encadenar sin re-verificar la próxima.
          }
        }

        await deleteMutation(row.id);
        appliedCount += 1;
      } catch (error) {
        if (isNetworkError(error)) {
          await setStatus(row.id, 'pending');
          break;
        }
        const msg = error?.response?.data?.msg || error?.response?.data?.error || error.message || 'Error del servidor';
        await setStatus(row.id, 'error', msg);
        errorCount += 1;
      }
    }
  } finally {
    syncing = false;
  }

  return { appliedCount, conflictCount, errorCount };
}

export function isSyncing() {
  return syncing;
}

// "Descartar mi cambio": se queda con la versión del servidor (ya la
// tenemos guardada en el propio conflicto desde que se detectó), se
// descarta la mutación encolada y se refresca la cache local.
export async function resolveConflictKeepServer(conflictId) {
  const conflict = await getConflict(conflictId);
  if (!conflict) return { ok: false, error: 'Conflicto no encontrado' };

  if (conflict.serverPayload) {
    await replaceCacheForEntity(conflict.entity_type, conflict.entity_id, conflict.serverPayload, conflict.server_updated_at);
  }
  await deleteMutation(conflict.queue_id);
  await resolveConflict(conflictId, 'kept_server');
  return { ok: true };
}

// "Usar mi cambio": reenvía la mutación original que había quedado en
// conflicto. Si el recurso ya no existe en el servidor (404 detectado al
// generar el conflicto), esta opción no debería ofrecerse desde la UI.
export async function resolveConflictKeepLocal(conflictId) {
  const conflict = await getConflict(conflictId);
  if (!conflict) return { ok: false, error: 'Conflicto no encontrado' };

  const row = await getMutation(conflict.queue_id);
  if (!row) {
    // La mutación original ya no está (se resolvió/borró de otra forma);
    // no hay nada que reenviar, solo cerramos el conflicto.
    await resolveConflict(conflictId, 'kept_local');
    return { ok: true };
  }

  try {
    await applyMutation(row);
    const def = ENTITY_REGISTRY[row.entity_type];
    if (def) {
      const fresh = await client.get(def.refetchUrl(row.entity_id));
      await replaceCacheForEntity(row.entity_type, row.entity_id, fresh.data, def.extractUpdatedAt(fresh.data));
    }
    await deleteMutation(row.id);
    await resolveConflict(conflictId, 'kept_local');
    return { ok: true };
  } catch (error) {
    const msg = error?.response?.data?.msg || error?.response?.data?.error || error.message || 'Error del servidor';
    return { ok: false, error: msg };
  }
}
