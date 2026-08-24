import React, { useEffect, useState, useCallback } from 'react';
import API_BASE_URL, { authHeaders } from '../api';

const PURPLE = '#5F245B';

function EstadoBadge({ estado }) {
  const colors = {
    activa: { bg: '#e7f5ec', fg: '#1a7a3c' },
    agotada: { bg: '#fff4e0', fg: '#a5680a' },
    cancelada: { bg: '#fdecec', fg: '#b3261e' },
  };
  const c = colors[estado] || colors.activa;
  return (
    <span style={{ ...styles.badge, background: c.bg, color: c.fg }}>{estado}</span>
  );
}

function OrigenBadge({ creadoPor }) {
  const esEmpresa = creadoPor === 'empresa-partner';
  return (
    <span
      style={{
        ...styles.badge,
        background: esEmpresa ? '#fdecec' : '#eef0ff',
        color: esEmpresa ? '#b3261e' : '#3949ab',
      }}
    >
      {esEmpresa ? 'Empresa externa' : 'Cliente'}
    </span>
  );
}

function FilaInvitacion({ inv, onGuardar, onCancelar }) {
  const [editando, setEditando] = useState(false);
  const [nombreFamilia, setNombreFamilia] = useState(inv.nombreFamilia);
  const [personasAutorizadas, setPersonasAutorizadas] = useState(inv.personasAutorizadas);
  const [entradasRestantes, setEntradasRestantes] = useState(inv.entradasRestantes);
  const [notas, setNotas] = useState(inv.notas || '');
  const [confirmado, setConfirmado] = useState(false);
  const [confirmandoCancelar, setConfirmandoCancelar] = useState(false);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const esEmpresa = inv.creadoPor === 'empresa-partner';

  const cancelarEdicion = () => {
    setEditando(false);
    setConfirmado(false);
    setError('');
    setNombreFamilia(inv.nombreFamilia);
    setPersonasAutorizadas(inv.personasAutorizadas);
    setEntradasRestantes(inv.entradasRestantes);
    setNotas(inv.notas || '');
  };

  const guardar = async () => {
    if (esEmpresa && !confirmado) {
      setError('Marca la casilla de confirmación antes de guardar.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await onGuardar(inv._id, { nombreFamilia, personasAutorizadas, entradasRestantes, notas });
      setEditando(false);
      setConfirmado(false);
    } catch (e) {
      setError(e.message || 'Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  const cancelarInvitacion = async () => {
    setSaving(true);
    setError('');
    try {
      await onCancelar(inv._id);
      setConfirmandoCancelar(false);
    } catch (e) {
      setError(e.message || 'Error al cancelar');
    } finally {
      setSaving(false);
    }
  };

  if (editando) {
    return (
      <tr>
        <td colSpan={6} style={styles.tdEdit}>
          {esEmpresa && (
            <div style={styles.warnBox}>
              Esta invitación la creó una <strong>empresa externa</strong>. Si la editas aquí,
              el cambio <strong>no se refleja en su sistema</strong> — ellos van a seguir viendo
              sus propios datos. Úsalo solo para control de acceso en la entrada.
            </div>
          )}
          <div style={styles.editGrid}>
            <label style={styles.editLabel}>
              Nombre
              <input value={nombreFamilia} onChange={(e) => setNombreFamilia(e.target.value)} style={styles.input} />
            </label>
            <label style={styles.editLabel}>
              Personas autorizadas
              <input
                type="number"
                min="1"
                value={personasAutorizadas}
                onChange={(e) => setPersonasAutorizadas(e.target.value)}
                style={styles.input}
              />
            </label>
            <label style={styles.editLabel}>
              Entradas restantes
              <input
                type="number"
                min="0"
                value={entradasRestantes}
                onChange={(e) => setEntradasRestantes(e.target.value)}
                style={styles.input}
              />
            </label>
            <label style={{ ...styles.editLabel, gridColumn: '1 / -1' }}>
              Notas
              <input value={notas} onChange={(e) => setNotas(e.target.value)} style={styles.input} />
            </label>
          </div>
          {esEmpresa && (
            <label style={styles.checkboxLabel}>
              <input type="checkbox" checked={confirmado} onChange={(e) => setConfirmado(e.target.checked)} />
              Entiendo que esta invitación pertenece a una empresa externa y este cambio no se
              le notifica ni se refleja en su sistema.
            </label>
          )}
          {error && <p style={styles.errorText}>{error}</p>}
          <div style={styles.rowButtons}>
            <button onClick={cancelarEdicion} style={styles.outlineBtn} disabled={saving}>
              Cancelar
            </button>
            <button onClick={guardar} style={styles.primaryBtn} disabled={saving}>
              {saving ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        </td>
      </tr>
    );
  }

  return (
    <tr>
      <td style={styles.td}>
        {inv.nombreFamilia}
        {inv.notas && <div style={styles.notas}>{inv.notas}</div>}
      </td>
      <td style={styles.td}><OrigenBadge creadoPor={inv.creadoPor} /></td>
      <td style={styles.td}>{inv.personasAutorizadas}</td>
      <td style={styles.td}>{inv.entradasRestantes}</td>
      <td style={styles.td}><EstadoBadge estado={inv.estado} /></td>
      <td style={styles.td}>
        {!confirmandoCancelar && (
          <div style={styles.rowButtons}>
            <button onClick={() => setEditando(true)} style={styles.outlineBtnSmall}>
              Editar
            </button>
            {inv.estado !== 'cancelada' && (
              <button onClick={() => setConfirmandoCancelar(true)} style={styles.dangerBtnSmall}>
                Cancelar
              </button>
            )}
          </div>
        )}
        {confirmandoCancelar && (
          <div>
            {esEmpresa && (
              <p style={styles.warnTextSmall}>
                Es de una <strong>empresa externa</strong> — cancelarla aquí no se les notifica.
              </p>
            )}
            {error && <p style={styles.errorText}>{error}</p>}
            <div style={styles.rowButtons}>
              <button onClick={() => setConfirmandoCancelar(false)} style={styles.outlineBtnSmall} disabled={saving}>
                No
              </button>
              <button onClick={cancelarInvitacion} style={styles.dangerBtnSmall} disabled={saving}>
                {saving ? '...' : 'Sí, cancelar'}
              </button>
            </div>
          </div>
        )}
      </td>
    </tr>
  );
}

export default function ModalListaInvitaciones({ open, onClose, reservaId }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [data, setData] = useState(null);

  const cargar = useCallback(async () => {
    if (!reservaId) return;
    try {
      setLoading(true);
      setError('');
      const resp = await fetch(`${API_BASE_URL}/invitaciones-qr-admin/${reservaId}`, {
        headers: { ...authHeaders() },
      });
      const json = await resp.json();
      if (!resp.ok || !json.ok) throw new Error(json.msg || 'No se pudo cargar la lista');
      setData(json);
    } catch (e) {
      setError(e.message || 'Error al cargar invitaciones');
    } finally {
      setLoading(false);
    }
  }, [reservaId]);

  useEffect(() => {
    if (open) cargar();
  }, [open, cargar]);

  if (!open) return null;

  const guardarInvitacion = async (id, cambios) => {
    const resp = await fetch(`${API_BASE_URL}/invitaciones-qr-admin/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify(cambios),
    });
    const json = await resp.json();
    if (!resp.ok || !json.ok) throw new Error(json.msg || 'No se pudo guardar');
    await cargar();
  };

  const cancelarInvitacion = async (id) => {
    const resp = await fetch(`${API_BASE_URL}/invitaciones-qr-admin/${id}/cancelar`, {
      method: 'PATCH',
      headers: { ...authHeaders() },
    });
    const json = await resp.json();
    if (!resp.ok || !json.ok) throw new Error(json.msg || 'No se pudo cancelar');
    await cargar();
  };

  return (
    <div style={styles.overlay}>
      <div style={styles.modal}>
        <div style={styles.header}>
          <div>
            <p style={styles.headerSubtitle}>Reserva #{reservaId}</p>
            <h2 style={styles.headerTitle}>Invitaciones (todas)</h2>
          </div>
          <button onClick={onClose} style={styles.closeBtn}>×</button>
        </div>

        <div style={styles.body}>
          {loading && <p>Cargando...</p>}
          {error && <p style={styles.errorText}>{error}</p>}

          {data && (
            <>
              <div style={styles.summary}>
                <span>Aforo: <strong>{data.capacidadTotal}</strong></span>
                <span>Generados: <strong>{data.pasesGenerados}</strong></span>
                <span>Disponibles: <strong>{data.disponibles}</strong></span>
              </div>

              {data.invitaciones.length === 0 ? (
                <p style={styles.hint}>Todavía no hay invitaciones para esta reserva.</p>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={styles.table}>
                    <thead>
                      <tr>
                        <th style={styles.th}>Nombre</th>
                        <th style={styles.th}>Origen</th>
                        <th style={styles.th}>Personas</th>
                        <th style={styles.th}>Restantes</th>
                        <th style={styles.th}>Estado</th>
                        <th style={styles.th}>Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.invitaciones.map((inv) => (
                        <FilaInvitacion
                          key={inv._id}
                          inv={inv}
                          onGuardar={guardarInvitacion}
                          onCancelar={cancelarInvitacion}
                        />
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}

          <div style={styles.footer}>
            <button onClick={onClose} style={styles.cancelBtn}>Cerrar</button>
          </div>
        </div>
      </div>
    </div>
  );
}

const styles = {
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.55)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9999,
    padding: 16,
  },
  modal: {
    width: '100%',
    maxWidth: 820,
    maxHeight: '90vh',
    overflowY: 'auto',
    background: '#fff',
    borderRadius: 16,
    boxShadow: '0 20px 60px rgba(0,0,0,0.25)',
  },
  header: {
    background: PURPLE,
    padding: '20px 24px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    position: 'sticky',
    top: 0,
  },
  headerSubtitle: {
    margin: 0,
    fontSize: 11,
    fontWeight: 500,
    color: 'rgba(255,255,255,0.6)',
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
  },
  headerTitle: { margin: '4px 0 0', fontSize: 17, fontWeight: 500, color: '#fff' },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: '50%',
    border: '1px solid rgba(255,255,255,0.25)',
    background: 'rgba(255,255,255,0.1)',
    color: '#fff',
    fontSize: 20,
    cursor: 'pointer',
  },
  body: { padding: 24 },
  hint: { fontSize: 13, color: '#666' },
  summary: {
    display: 'flex',
    gap: 20,
    fontSize: 13,
    color: '#444',
    marginBottom: 16,
    background: '#f8f6f9',
    padding: '10px 14px',
    borderRadius: 8,
  },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: 13 },
  th: {
    textAlign: 'left',
    padding: '8px 10px',
    borderBottom: `2px solid ${PURPLE}`,
    color: PURPLE,
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: '0.03em',
  },
  td: { padding: '10px', borderBottom: '1px solid #eee', verticalAlign: 'top' },
  tdEdit: { padding: '14px 10px', borderBottom: '1px solid #eee', background: '#fafafa' },
  notas: { fontSize: 11, color: '#888', marginTop: 2 },
  badge: {
    display: 'inline-block',
    fontSize: 11,
    fontWeight: 600,
    padding: '2px 8px',
    borderRadius: 999,
    whiteSpace: 'nowrap',
  },
  warnBox: {
    background: '#fff6ea',
    border: '1px solid #f0c987',
    color: '#7a4d0a',
    fontSize: 12,
    padding: '8px 12px',
    borderRadius: 8,
    marginBottom: 10,
  },
  warnTextSmall: { fontSize: 11, color: '#a5680a', margin: '4px 0' },
  editGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 },
  editLabel: { display: 'flex', flexDirection: 'column', fontSize: 11, color: '#666', gap: 4 },
  input: {
    padding: '6px 8px',
    borderRadius: 6,
    border: '1px solid #ddd',
    fontSize: 13,
  },
  checkboxLabel: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 6,
    fontSize: 11,
    color: '#7a4d0a',
    marginTop: 10,
  },
  rowButtons: { display: 'flex', gap: 6, marginTop: 8 },
  outlineBtn: {
    padding: '8px 14px',
    borderRadius: 8,
    border: `1px solid ${PURPLE}`,
    background: 'transparent',
    color: PURPLE,
    fontSize: 12,
    cursor: 'pointer',
  },
  outlineBtnSmall: {
    padding: '4px 10px',
    borderRadius: 6,
    border: `1px solid ${PURPLE}`,
    background: 'transparent',
    color: PURPLE,
    fontSize: 11,
    cursor: 'pointer',
  },
  dangerBtnSmall: {
    padding: '4px 10px',
    borderRadius: 6,
    border: '1px solid #b3261e',
    background: 'transparent',
    color: '#b3261e',
    fontSize: 11,
    cursor: 'pointer',
  },
  primaryBtn: {
    padding: '8px 14px',
    borderRadius: 8,
    background: PURPLE,
    color: '#fff',
    fontSize: 12,
    border: 'none',
    cursor: 'pointer',
  },
  errorText: { color: '#b3261e', fontSize: 12 },
  footer: {
    display: 'flex',
    justifyContent: 'flex-end',
    paddingTop: 16,
    marginTop: 16,
    borderTop: '1px solid #f0f0f0',
  },
  cancelBtn: {
    padding: '10px 20px',
    borderRadius: 8,
    border: '1px solid #e0e0e0',
    background: 'transparent',
    color: '#555',
    fontSize: 13,
    fontWeight: 500,
    cursor: 'pointer',
  },
};
