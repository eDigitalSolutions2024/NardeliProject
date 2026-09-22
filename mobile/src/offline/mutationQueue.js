import { getDb } from './db';

function uuid() {
  // Suficiente para dedupe local; no necesita ser criptográficamente fuerte.
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

// Encola una mutación offline. Si ya existe una pendiente con el MISMO
// method+url (p. ej. el usuario editó el mismo sub-recurso dos veces sin
// reconectar), la reemplaza en vez de acumular. Mutaciones sobre endpoints
// distintos de la misma entidad sí se acumulan (orden FIFO por created_at).
export async function enqueueMutation({ method, url, body, entityType, entityId, baseUpdatedAt }) {
  const db = await getDb();
  const existing = await db.getFirstAsync(
    `SELECT id, created_at FROM offline_queue
     WHERE method = $method AND url = $url AND status = 'pending'
     LIMIT 1`,
    { $method: method, $url: url }
  );

  if (existing) {
    await db.runAsync(
      `UPDATE offline_queue SET body_json = $body, base_updated_at = $base WHERE id = $id`,
      { $id: existing.id, $body: JSON.stringify(body ?? null), $base: baseUpdatedAt || null }
    );
    return existing.id;
  }

  const clientOpId = uuid();
  const result = await db.runAsync(
    `INSERT INTO offline_queue
       (created_at, method, url, body_json, entity_type, entity_id, base_updated_at, status, attempt_count, client_op_id)
     VALUES ($created_at, $method, $url, $body, $entity_type, $entity_id, $base, 'pending', 0, $client_op_id)`,
    {
      $created_at: Date.now(),
      $method: method,
      $url: url,
      $body: JSON.stringify(body ?? null),
      $entity_type: entityType || 'unknown',
      $entity_id: entityId || url,
      $base: baseUpdatedAt || null,
      $client_op_id: clientOpId,
    }
  );
  return result.lastInsertRowId;
}

export async function getPendingMutations() {
  const db = await getDb();
  return db.getAllAsync(
    `SELECT * FROM offline_queue WHERE status = 'pending' ORDER BY created_at ASC`
  );
}

export async function countByStatus(statuses) {
  const db = await getDb();
  const placeholders = statuses.map((_, i) => `$s${i}`).join(',');
  const params = {};
  statuses.forEach((s, i) => { params[`$s${i}`] = s; });
  const row = await db.getFirstAsync(
    `SELECT COUNT(*) as cnt FROM offline_queue WHERE status IN (${placeholders})`,
    params
  );
  return row?.cnt || 0;
}

// Marca una fila como "en proceso" durante el sync, sin contarla como un
// intento fallido (a diferencia de setStatus, que sí incrementa attempt_count).
export async function markSyncing(id) {
  const db = await getDb();
  await db.runAsync(`UPDATE offline_queue SET status = 'syncing' WHERE id = $id`, { $id: id });
}

export async function setStatus(id, status, lastError = null) {
  const db = await getDb();
  await db.runAsync(
    `UPDATE offline_queue SET status = $status, last_error = $err, attempt_count = attempt_count + 1 WHERE id = $id`,
    { $id: id, $status: status, $err: lastError }
  );
}

export async function updateBaseUpdatedAt(id, baseUpdatedAt) {
  const db = await getDb();
  await db.runAsync(
    `UPDATE offline_queue SET base_updated_at = $base WHERE id = $id`,
    { $id: id, $base: baseUpdatedAt || null }
  );
}

export async function deleteMutation(id) {
  const db = await getDb();
  await db.runAsync(`DELETE FROM offline_queue WHERE id = $id`, { $id: id });
}

export async function getMutation(id) {
  const db = await getDb();
  return db.getFirstAsync(`SELECT * FROM offline_queue WHERE id = $id`, { $id: id });
}

export async function getErrorMutations() {
  const db = await getDb();
  return db.getAllAsync(`SELECT * FROM offline_queue WHERE status = 'error' ORDER BY created_at ASC`);
}

export async function retryMutation(id) {
  const db = await getDb();
  await db.runAsync(`UPDATE offline_queue SET status = 'pending', last_error = NULL WHERE id = $id`, { $id: id });
}
