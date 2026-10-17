import TimeField from './ui/TimeField';
import DateField from './ui/DateField';
import { pedirPasswordAdmin } from '../utils/pedirPassword';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import API_BASE_URL from '../api';
import { jsonAuthHeaders } from '../session';
import Reserva from './ReservarEvento';
import './Roles.css';

const money = (n) => `$${Number(n || 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const ymd = (v) => (v ? String(v).slice(0, 10) : '—');

/* ---------- Modal: editar los datos de una cotización propia ---------- */
function ModalEditar({ cot, onClose, onSaved }) {
  const [f, setF] = useState({
    cliente: cot.cliente || '',
    tipoEvento: cot.tipoEvento || '',
    fecha: ymd(cot.fecha),
    horaInicio: cot.horaInicio || '',
    horaFin: cot.horaFin || '',
    cantidadPersonas: cot.cantidadPersonas ?? '',
    descripcion: cot.descripcion || '',
  });
  const [error, setError] = useState('');
  const [guardando, setGuardando] = useState(false);
  const set = (k) => (e) => setF((p) => ({ ...p, [k]: e.target.value }));

  const enviar = (adminPassword) => fetch(`${API_BASE_URL}/reservas/${cot._id}`, {
    method: 'PUT',
    headers: jsonAuthHeaders(),
    body: JSON.stringify({
      ...f,
      cantidadPersonas: Number(f.cantidadPersonas || 0),
      tipoReserva: 'cotizacion',
      ...(adminPassword ? { adminPassword } : {}),
    }),
  });

  const guardar = async (e) => {
    e.preventDefault();
    setError('');
    setGuardando(true);
    try {
      let r = await enviar();
      // Candado de fecha: ya hay una cotización reciente en ese horario → pide contraseña de administrador.
      if (r.status === 401) {
        const err = await r.json().catch(() => ({}));
        if (err.requierePassword) {
          const pw = await pedirPasswordAdmin(err.msg || 'Ya existe una cotización reciente para esa fecha. Ingresa la contraseña de un administrador para continuar:');
          if (pw === null) { setGuardando(false); return; }
          r = await enviar(pw);
        }
      }
      const data = await r.json().catch(() => ({}));
      if (!r.ok) {
        setError(data.msg || 'No se pudo guardar la cotización.');
        return;
      }
      onSaved();
    } catch {
      setError('Error de conexión. Intenta de nuevo.');
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className="rl-modal-bg">
      <form className="rl-modal" onSubmit={guardar}>
        <h3>Editar cotización</h3>
        {error && <div className="rl-msg err">{error}</div>}
        <div className="rl-field"><label>Cliente</label><input autoFocus value={f.cliente} onChange={set('cliente')} required /></div>
        <div className="rl-field"><label>Tipo de evento</label><input value={f.tipoEvento} onChange={set('tipoEvento')} required /></div>
        <div className="rl-field"><label>Fecha</label><DateField value={f.fecha} onChange={(v) => setF((p) => ({ ...p, fecha: v }))} required clearable={false} style={{ width: '100%' }} /></div>
        <div style={{ display: 'flex', gap: 8 }}>
          <div className="rl-field" style={{ flex: 1 }}><label>Hora inicio</label><TimeField value={f.horaInicio} onChange={(v) => setF((p) => ({ ...p, horaInicio: v }))} required clearable={false} style={{ width: '100%' }} /></div>
          <div className="rl-field" style={{ flex: 1 }}><label>Hora fin</label><TimeField value={f.horaFin} onChange={(v) => setF((p) => ({ ...p, horaFin: v }))} required clearable={false} style={{ width: '100%' }} /></div>
        </div>
        <div className="rl-field"><label>Invitados</label><input type="number" min="0" value={f.cantidadPersonas} onChange={set('cantidadPersonas')} required /></div>
        <div className="rl-field"><label>Descripción</label><input value={f.descripcion} onChange={set('descripcion')} /></div>
        <div className="rl-modal-actions">
          <button type="button" className="rl-btn sec" onClick={onClose}>Cancelar</button>
          <button className="rl-btn" disabled={guardando}>{guardando ? 'Guardando…' : 'Guardar'}</button>
        </div>
      </form>
    </div>
  );
}

/* ---------- Lista: todas las cotizaciones; solo se editan las propias ---------- */
function Cotizaciones() {
  const [items, setItems] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [soloMias, setSoloMias] = useState(false);
  const [editando, setEditando] = useState(null);

  const cargar = useCallback(async () => {
    setCargando(true);
    setError('');
    try {
      const res = await fetch(`${API_BASE_URL}/reservas/mis-cotizaciones`, { headers: jsonAuthHeaders() });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.msg || `Error ${res.status}`);
      setItems(data.items || []);
    } catch (e) {
      setError(e.message || 'No se pudieron cargar las cotizaciones.');
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  const visibles = useMemo(() => (soloMias ? items.filter((i) => i.esMia) : items), [items, soloMias]);

  const abrir = (id) => {
    const qs = new URLSearchParams({ reservaId: String(id), mode: 'cotizador', tipo: 'cotizacion' }).toString();
    window.open(`/cliente/dashboard?${qs}`, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="rl-card">
      <div className="rl-toolbar">
        <h3>Cotizaciones</h3>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <label style={{ fontSize: 14, display: 'flex', gap: 6, alignItems: 'center', cursor: 'pointer' }}>
            <input type="checkbox" checked={soloMias} onChange={(e) => setSoloMias(e.target.checked)} />
            Solo las mías
          </label>
          <button className="rl-btn sec sm" onClick={cargar} disabled={cargando}>↻ Actualizar</button>
        </div>
      </div>
      <p className="rl-hint">Puedes ver todas las cotizaciones; solo puedes editar las que tú creaste.</p>
      {error && <div className="rl-msg err">{error}</div>}
      {cargando ? <p className="rl-hint">Cargando…</p> : visibles.length === 0 ? (
        <p className="rl-hint">{soloMias ? 'Todavía no has creado cotizaciones.' : 'No hay cotizaciones.'} Usa la pestaña “Nueva cotización”.</p>
      ) : (
        <div className="rl-table-wrap">
          <table className="rl-table">
            <thead>
              <tr>
                <th>Fecha del evento</th><th>Cliente</th><th>Tipo</th><th>Horario</th>
                <th>Invitados</th><th>Subtotal</th><th>Creada por</th><th style={{ textAlign: 'right' }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {visibles.map((c) => (
                <tr key={c._id}>
                  <td style={{ whiteSpace: 'nowrap' }}>{ymd(c.fecha)}</td>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    <strong>{c.cliente || '—'}</strong>
                    <div style={{ fontSize: 12, color: '#6b7280', whiteSpace: 'nowrap' }}>{c.correo}</div>
                  </td>
                  <td style={{ whiteSpace: 'nowrap' }}>{c.tipoEvento || '—'}</td>
                  <td style={{ whiteSpace: 'nowrap' }}>{c.horaInicio || '—'} – {c.horaFin || '—'}</td>
                  <td style={{ whiteSpace: 'nowrap' }}>{c.cantidadPersonas ?? '—'}</td>
                  <td style={{ whiteSpace: 'nowrap', fontWeight: 600 }}>{money(c.subtotal)}</td>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    {c.esMia ? <span className="rl-pill ok">Tú</span> : (c.creadoPor?.nombre || c.creadoPor?.email || 'Sistema')}
                    <div style={{ fontSize: 12, color: '#6b7280' }}>{ymd(c.createdAt)}</div>
                  </td>
                  <td style={{ whiteSpace: 'nowrap', textAlign: 'right' }}>
                    <div className="cz-row-actions">
                      {c.puedeEditar && (
                        <>
                          <button className="rl-btn sec sm" onClick={() => setEditando(c)}>Editar datos</button>
                          <button className="rl-btn sm" onClick={() => abrir(c._id)}>Artículos</button>
                        </>
                      )}
                      <a className="rl-btn pdf sm btn-pdf-rojo"
                         href={`${API_BASE_URL}/reservas/${c._id}/pdf`} target="_blank" rel="noopener noreferrer">PDF</a>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {editando && (
        <ModalEditar
          cot={editando}
          onClose={() => setEditando(null)}
          onSaved={() => { setEditando(null); cargar(); }}
        />
      )}
    </div>
  );
}

// Vista única del rol "cotizador": crear cotizaciones, ver todas y editar las suyas.
export default function Cotizador({ user, onLogout }) {
  const [tab, setTab] = useState('nueva');

  return (
    <div className="cz-shell">
      <div className="cz-bar">
        <strong>Nardeli · Cotizaciones</strong>
        <div>
          <span>{user?.fullname || user?.email}</span>
          <button onClick={onLogout}>Cerrar sesión</button>
        </div>
      </div>
      <div className="cz-body">
        <div className="rl-tabs">
          <button className={`rl-tab ${tab === 'nueva' ? 'active' : ''}`} onClick={() => setTab('nueva')}>Nueva cotización</button>
          <button className={`rl-tab ${tab === 'lista' ? 'active' : ''}`} onClick={() => setTab('lista')}>Cotizaciones</button>
        </div>
        {tab === 'nueva' ? <Reserva soloCotizacion /> : <Cotizaciones />}
      </div>
    </div>
  );
}
