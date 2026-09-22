// Mapa de "qué tipo de entidad es esta URL" -> "cómo refrescar su updatedAt real".
// Se usa en dos momentos:
//  1) Al encolar una mutación offline, para resolver entity_type/entity_id.
//  2) Al sincronizar, para volver a consultar el documento PADRE (el que sí
//     trae updatedAt) antes de aplicar la mutación, y así detectar conflictos.
//
// Los sub-recursos de una reserva (/utensilios, /precios, /totales,
// /descuento) no devuelven updatedAt propio — por eso siempre se resuelve al
// documento completo de la reserva vía GET /reservas/:id, sin importar cuál
// endpoint específico se haya llamado.

const RESERVA_RE = /^\/(?:app\/)?reservas\/([^/]+)/;
const CHECKLIST_RE = /^\/app\/checklists\/([^/]+)/;
const PRODUCTO_RE = /^\/productos\/([^/]+)/;
const INVITACION_RE = /^\/invitaciones-qr\/([^/]+)/;

// ids que en realidad son sub-rutas fijas, no un id real de checklist
const CHECKLIST_NON_ID_SEGMENTS = new Set(['sync', 'evento']);

export const ENTITY_REGISTRY = {
  reserva: {
    matchUrl: (url) => RESERVA_RE.test(url),
    resolveEntityId: (url) => url.match(RESERVA_RE)?.[1] || null,
    refetchUrl: (id) => `/reservas/${id}`,
    extractUpdatedAt: (data) => data?.updatedAt || null,
  },
  checklist: {
    matchUrl: (url) => {
      const m = url.match(CHECKLIST_RE);
      return !!m && !CHECKLIST_NON_ID_SEGMENTS.has(m[1]);
    },
    resolveEntityId: (url) => {
      const m = url.match(CHECKLIST_RE);
      if (!m || CHECKLIST_NON_ID_SEGMENTS.has(m[1])) return null;
      return m[1];
    },
    refetchUrl: (id) => `/app/checklists/${id}`,
    extractUpdatedAt: (data) => data?.updatedAt || null,
  },
  producto: {
    matchUrl: (url) => PRODUCTO_RE.test(url) && !/^\/productos\/inventario/.test(url),
    resolveEntityId: (url) => url.match(PRODUCTO_RE)?.[1] || null,
    refetchUrl: (id) => `/productos/${id}`,
    extractUpdatedAt: (data) => data?.updatedAt || null,
  },
  invitacion: {
    matchUrl: (url) => INVITACION_RE.test(url),
    resolveEntityId: (url) => url.match(INVITACION_RE)?.[1] || null,
    refetchUrl: (token) => `/invitaciones-qr/${token}`,
    extractUpdatedAt: (data) => data?.updatedAt || null,
  },
};

// Resuelve {type, id} para una URL dada, o null si no coincide con ninguna
// entidad conocida (se sincroniza igual, sin verificación fina de conflicto).
export function resolveEntity(url) {
  for (const [type, def] of Object.entries(ENTITY_REGISTRY)) {
    if (def.matchUrl(url)) {
      const id = def.resolveEntityId(url);
      if (id) return { type, id };
    }
  }
  return null;
}
