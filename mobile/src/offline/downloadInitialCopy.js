import client from '../api/client';
import { putCache } from './cacheStore';
import { resolveEntity, ENTITY_REGISTRY } from './entityRegistry';

// Pide un GET directo (sin pasar por offlineClient, para no encolar nada
// durante la descarga) y lo guarda en cache con la MISMA clave que usará
// offlineClient.get() cuando la pantalla real lo pida. Nunca lanza: un
// recurso que falla no debe tumbar el resto de la descarga.
async function fetchAndCache(url, params) {
  try {
    const res = await client.get(url, params ? { params } : undefined);
    const entity = resolveEntity(url);
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
    return res.data;
  } catch (e) {
    return null;
  }
}

// Descarga todo lo necesario para poder trabajar sin conexión: eventos
// activos, su detalle/utensilios/totales/recibos/dashboard, sus checklists
// (lista + detalle de cada uno) y el catálogo de productos. No incluye
// invitaciones (su endpoint de listado es un POST que crea el portal si no
// existe — no es seguro llamarlo automáticamente en segundo plano; se
// cachean solas cuando alguien abre esa pantalla con conexión).
export async function downloadInitialCopy(onProgress) {
  const eventos = await fetchAndCache('/app/reservas');
  await fetchAndCache('/reservas', { tipo: 'evento' });

  const ids = Array.isArray(eventos) ? eventos.map((e) => e?._id).filter(Boolean) : [];
  const STEPS_PER_EVENT = 5; // dashboard, detalle, utensilios, totales, receipts (+ checklists aparte)
  const total = ids.length * STEPS_PER_EVENT + 2; // + lista de eventos + productos
  let done = 1; // ya contamos /app/reservas
  onProgress?.({ done, total });

  for (const id of ids) {
    await fetchAndCache(`/app/dashboard/${id}`);
    await fetchAndCache(`/reservas/${id}`);
    await fetchAndCache(`/reservas/${id}/utensilios`);
    await fetchAndCache(`/reservas/${id}/totales`);
    await fetchAndCache(`/reservas/${id}/receipts`);
    done += STEPS_PER_EVENT;
    onProgress?.({ done, total });

    const checklists = await fetchAndCache(`/app/checklists/evento/${id}`);
    if (Array.isArray(checklists)) {
      for (const c of checklists) {
        if (c?._id) await fetchAndCache(`/app/checklists/${c._id}`);
      }
    }
  }

  await fetchAndCache('/productos');
  done += 1;
  onProgress?.({ done, total });

  return { eventCount: ids.length };
}
