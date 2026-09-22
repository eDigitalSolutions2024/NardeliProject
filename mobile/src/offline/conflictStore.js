import { getDb } from './db';

export async function addConflict({ queueId, entityType, entityId, localPayload, serverPayload, localBaseUpdatedAt, serverUpdatedAt }) {
  const db = await getDb();
  await db.runAsync(
    `INSERT INTO offline_conflicts
       (queue_id, entity_type, entity_id, local_payload_json, server_payload_json, local_base_updated_at, server_updated_at, detected_at, resolution)
     VALUES ($queue_id, $entity_type, $entity_id, $local, $server, $local_base, $server_updated_at, $detected_at, 'pending')`,
    {
      $queue_id: queueId,
      $entity_type: entityType,
      $entity_id: entityId,
      $local: JSON.stringify(localPayload ?? null),
      $server: serverPayload != null ? JSON.stringify(serverPayload) : null,
      $local_base: localBaseUpdatedAt || null,
      $server_updated_at: serverUpdatedAt || null,
      $detected_at: Date.now(),
    }
  );
}

export async function getPendingConflicts() {
  const db = await getDb();
  const rows = await db.getAllAsync(
    `SELECT * FROM offline_conflicts WHERE resolution = 'pending' ORDER BY detected_at ASC`
  );
  return rows.map((r) => ({
    ...r,
    localPayload: JSON.parse(r.local_payload_json),
    serverPayload: r.server_payload_json ? JSON.parse(r.server_payload_json) : null,
  }));
}

export async function countPendingConflicts() {
  const db = await getDb();
  const row = await db.getFirstAsync(
    `SELECT COUNT(*) as cnt FROM offline_conflicts WHERE resolution = 'pending'`
  );
  return row?.cnt || 0;
}

export async function resolveConflict(id, resolution) {
  const db = await getDb();
  await db.runAsync(
    `UPDATE offline_conflicts SET resolution = $resolution WHERE id = $id`,
    { $id: id, $resolution: resolution }
  );
}

export async function getConflict(id) {
  const db = await getDb();
  const row = await db.getFirstAsync(`SELECT * FROM offline_conflicts WHERE id = $id`, { $id: id });
  if (!row) return null;
  return {
    ...row,
    localPayload: JSON.parse(row.local_payload_json),
    serverPayload: row.server_payload_json ? JSON.parse(row.server_payload_json) : null,
  };
}
