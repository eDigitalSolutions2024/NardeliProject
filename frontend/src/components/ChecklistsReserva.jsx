import React, { useEffect, useState, useCallback } from 'react';
import API_BASE_URL, { API_ORIGIN } from '../api';

const statusLabel = { pendiente: 'Pendiente', en_progreso: 'En progreso', completado: 'Completado' };
const statusColor = { pendiente: '#9ca3af', en_progreso: '#f59e0b', completado: '#10b981' };

const resolvePhoto = (url) => {
  if (!url) return null;
  if (url.startsWith('http')) return url;
  return `${API_ORIGIN}${url.startsWith('/') ? '' : '/'}${url}`;
};

export default function ChecklistsReserva({ reservaId }) {
  const [summaries, setSummaries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [details, setDetails] = useState({});
  const [expanded, setExpanded] = useState({});
  const [loadingDetail, setLoadingDetail] = useState({});
  const [lightbox, setLightbox] = useState(null);

  const fetchSummaries = useCallback(async () => {
    if (!reservaId) return;
    setLoading(true);
    try {
      const r = await fetch(`${API_BASE_URL}/app/checklists/evento/${reservaId}`);
      const data = r.ok ? await r.json() : [];
      setSummaries(Array.isArray(data) ? data : []);
    } catch {
      setSummaries([]);
    } finally {
      setLoading(false);
    }
  }, [reservaId]);

  useEffect(() => { fetchSummaries(); }, [fetchSummaries]);

  const toggleExpand = async (id) => {
    const next = !expanded[id];
    setExpanded(prev => ({ ...prev, [id]: next }));
    if (next && !details[id]) {
      setLoadingDetail(prev => ({ ...prev, [id]: true }));
      try {
        const r = await fetch(`${API_BASE_URL}/app/checklists/${id}`);
        const data = r.ok ? await r.json() : null;
        if (data) setDetails(prev => ({ ...prev, [id]: data }));
      } catch {}
      setLoadingDetail(prev => ({ ...prev, [id]: false }));
    }
  };

  const totalTasks = summaries.reduce((s, c) => s + (c.totalCount || 0), 0);
  const doneTasks  = summaries.reduce((s, c) => s + (c.completedCount || 0), 0);
  const globalPct  = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0;

  if (loading) {
    return <div style={{ padding: 32, textAlign: 'center', color: '#9ca3af' }}>Cargando checklists…</div>;
  }

  if (summaries.length === 0) {
    return (
      <div style={{ padding: 32, textAlign: 'center', color: '#9ca3af' }}>
        <div style={{ fontSize: 48 }}>📋</div>
        <div style={{ marginTop: 12 }}>No hay checklists asignados a este evento.</div>
      </div>
    );
  }

  return (
    <div style={{ padding: '0 0 32px' }}>
      {/* Resumen global */}
      <div style={{
        background: '#f9fafb', borderRadius: 12, padding: '16px 20px',
        marginBottom: 16, border: '1px solid #e5e7eb'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <strong style={{ fontSize: 15 }}>Progreso global del evento</strong>
          <span style={{ fontWeight: 700, fontSize: 18, color: globalPct === 100 ? '#10b981' : '#6d28d9' }}>
            {globalPct}%
          </span>
        </div>
        <div style={{ background: '#e5e7eb', borderRadius: 6, height: 10, overflow: 'hidden' }}>
          <div style={{
            height: '100%', borderRadius: 6, transition: 'width .3s',
            background: globalPct === 100 ? '#10b981' : '#6d28d9',
            width: `${globalPct}%`
          }} />
        </div>
        <div style={{ marginTop: 8, fontSize: 13, color: '#6b7280' }}>
          {doneTasks} de {totalTasks} tareas completadas · {summaries.length} áreas
        </div>
      </div>

      {/* Tarjetas por área */}
      {summaries.map(cl => {
        const pct = cl.totalCount > 0 ? Math.round((cl.completedCount / cl.totalCount) * 100) : 0;
        const isOpen = expanded[cl._id];
        const detail = details[cl._id];
        const isLoadingDet = loadingDetail[cl._id];

        return (
          <div key={cl._id} style={{
            background: '#fff', borderRadius: 12, marginBottom: 10,
            border: '1px solid #e5e7eb', overflow: 'hidden',
            boxShadow: '0 1px 4px rgba(0,0,0,.05)'
          }}>
            {/* Cabecera clickeable */}
            <div
              onClick={() => toggleExpand(cl._id)}
              style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '14px 16px', cursor: 'pointer',
                userSelect: 'none'
              }}
            >
              <span style={{ fontSize: 26 }}>{cl.icon || '📋'}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: 15 }}>{cl.categoryName}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                  <div style={{ flex: 1, background: '#e5e7eb', borderRadius: 4, height: 6, overflow: 'hidden' }}>
                    <div style={{
                      height: '100%', borderRadius: 4,
                      background: statusColor[cl.status] || '#9ca3af',
                      width: `${pct}%`, transition: 'width .3s'
                    }} />
                  </div>
                  <span style={{ fontSize: 12, color: '#6b7280', minWidth: 60 }}>
                    {cl.completedCount}/{cl.totalCount}
                  </span>
                </div>
              </div>
              <span style={{
                fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20,
                background: statusColor[cl.status] + '22',
                color: statusColor[cl.status]
              }}>
                {statusLabel[cl.status] || cl.status}
              </span>
              <span style={{ fontSize: 18, color: '#9ca3af', transform: isOpen ? 'rotate(90deg)' : 'none', transition: 'transform .2s' }}>›</span>
            </div>

            {/* Detalle expandible */}
            {isOpen && (
              <div style={{ borderTop: '1px solid #f3f4f6', padding: '12px 16px' }}>
                {isLoadingDet ? (
                  <div style={{ textAlign: 'center', color: '#9ca3af', padding: 16 }}>Cargando tareas…</div>
                ) : !detail ? (
                  <div style={{ textAlign: 'center', color: '#9ca3af', padding: 16 }}>No se pudo cargar el detalle.</div>
                ) : (
                  detail.items.map((item, idx) => (
                    <div key={item._id} style={{
                      padding: '10px 12px', borderRadius: 8, marginBottom: 8,
                      background: item.completed ? '#f0fdf4' : '#fafafa',
                      border: `1px solid ${item.completed ? '#bbf7d0' : '#e5e7eb'}`
                    }}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                        <span style={{ fontSize: 18, marginTop: 1 }}>
                          {item.completed ? '✅' : '⬜'}
                        </span>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 600, fontSize: 14, color: item.completed ? '#166534' : '#374151' }}>
                            {idx + 1}. {item.title}
                          </div>
                          {item.description && (
                            <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>{item.description}</div>
                          )}
                          {item.observation && (
                            <div style={{ fontSize: 12, color: '#374151', marginTop: 4, fontStyle: 'italic' }}>
                              📝 {item.observation}
                            </div>
                          )}
                          {/* Evidencias */}
                          {item.evidence && item.evidence.length > 0 && (
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
                              {item.evidence.map((ev, ei) => (
                                <div key={ei} style={{ textAlign: 'center' }}>
                                  <img
                                    src={resolvePhoto(ev.url)}
                                    alt={`Evidencia ${ei + 1}`}
                                    onClick={() => setLightbox(resolvePhoto(ev.url))}
                                    style={{
                                      width: 72, height: 72, objectFit: 'cover',
                                      borderRadius: 8, cursor: 'zoom-in',
                                      border: '2px solid #e5e7eb'
                                    }}
                                    onError={(e) => { e.currentTarget.style.display = 'none'; }}
                                  />
                                  {ev.size > 0 && (
                                    <div style={{ fontSize: 10, color: '#9ca3af', marginTop: 2 }}>
                                      {ev.size < 1024 * 1024
                                        ? `${Math.round(ev.size / 1024)} KB`
                                        : `${(ev.size / (1024 * 1024)).toFixed(1)} MB`}
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                        {item.completedAt && (
                          <div style={{ fontSize: 10, color: '#9ca3af', whiteSpace: 'nowrap' }}>
                            {new Date(item.completedAt).toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' })}
                          </div>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        );
      })}

      {/* Lightbox */}
      {lightbox && (
        <div
          onClick={() => setLightbox(null)}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,.85)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 9999, cursor: 'zoom-out'
          }}
        >
          <img
            src={lightbox}
            alt="Evidencia"
            style={{ maxWidth: '90vw', maxHeight: '90vh', borderRadius: 8, boxShadow: '0 8px 32px rgba(0,0,0,.5)' }}
            onClick={(e) => e.stopPropagation()}
          />
          <button
            onClick={() => setLightbox(null)}
            style={{
              position: 'fixed', top: 16, right: 16,
              background: 'rgba(255,255,255,.2)', border: 'none', color: '#fff',
              fontSize: 24, width: 40, height: 40, borderRadius: '50%', cursor: 'pointer'
            }}
          >✕</button>
        </div>
      )}
    </div>
  );
}
