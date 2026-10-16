import React, { useCallback, useEffect, useState } from 'react';
import API_BASE_URL from '../api';
import { jsonAuthHeaders } from '../session';
import Reserva from './ReservarEvento';
import './Roles.css';

const money = (n) => `$${Number(n || 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const ymd = (v) => (v ? String(v).slice(0, 10) : '—');

function MisCotizaciones() {
  const [items, setItems] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');

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

  const abrir = (id) => {
    const qs = new URLSearchParams({ reservaId: String(id), mode: 'cotizador', tipo: 'cotizacion' }).toString();
    window.open(`/cliente/dashboard?${qs}`, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="rl-card">
      <div className="rl-toolbar">
        <h3>Mis cotizaciones</h3>
        <button className="rl-btn sec sm" onClick={cargar} disabled={cargando}>↻ Actualizar</button>
      </div>
      {error && <div className="rl-msg err">{error}</div>}
      {cargando ? <p className="rl-hint">Cargando…</p> : items.length === 0 ? (
        <p className="rl-hint">Todavía no has creado cotizaciones. Usa la pestaña “Nueva cotización”.</p>
      ) : (
        <div className="rl-table-wrap">
          <table className="rl-table">
            <thead>
              <tr>
                <th>Fecha del evento</th><th>Cliente</th><th>Tipo</th><th>Horario</th>
                <th>Invitados</th><th>Artículos</th><th>Subtotal</th><th>Creada</th><th></th>
              </tr>
            </thead>
            <tbody>
              {items.map((c) => (
                <tr key={c._id}>
                  <td>{ymd(c.fecha)}</td>
                  <td><strong>{c.cliente || '—'}</strong><div style={{ fontSize: 12, color: '#6b7280' }}>{c.correo}</div></td>
                  <td>{c.tipoEvento || '—'}</td>
                  <td>{c.horaInicio || '—'} – {c.horaFin || '—'}</td>
                  <td>{c.cantidadPersonas ?? '—'}</td>
                  <td>{c.articulos}</td>
                  <td>{money(c.subtotal)}</td>
                  <td>{ymd(c.createdAt)}</td>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    <button className="rl-btn sm" onClick={() => abrir(c._id)}>Abrir</button>{' '}
                    <a className="rl-btn sec sm" style={{ textDecoration: 'none', display: 'inline-block' }}
                       href={`${API_BASE_URL}/reservas/${c._id}/pdf`} target="_blank" rel="noopener noreferrer">PDF</a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// Vista única del rol "cotizador": crear cotizaciones y ver las suyas.
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
          <button className={`rl-tab ${tab === 'mias' ? 'active' : ''}`} onClick={() => setTab('mias')}>Mis cotizaciones</button>
        </div>
        {tab === 'nueva' ? <Reserva soloCotizacion /> : <MisCotizaciones />}
      </div>
    </div>
  );
}
