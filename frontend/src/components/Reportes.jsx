import React, { useEffect, useMemo, useState } from 'react';
import API_BASE_URL from '../api';
import * as XLSX from 'xlsx';

const money = (n) => `$${Number(n || 0).toFixed(2)}`;

const todayYmd = () => {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const da = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${da}`;
};

const firstDayOfMonth = () => {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}-01`;
};

export default function Reportes() {
  // filtros
  const [from, setFrom] = useState(firstDayOfMonth());
  const [to, setTo] = useState(todayYmd());
  const [tipoEvento, setTipoEvento] = useState('');
  const [status, setStatus] = useState('ALL'); // ALL|PAGADO|PARCIAL|PENDIENTE
  const [q, setQ] = useState('');

  // data
  const [loading, setLoading] = useState(false);
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [error, setError] = useState('');

  const [summary, setSummary] = useState({
    counts: { eventos: 0, pagados: 0, parciales: 0, pendientes: 0 },
    money: { total: 0, paid: 0, remaining: 0, avgTicket: 0 },
  });

  const [items, setItems] = useState([]);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [totalPages, setTotalPages] = useState(1);

  // tipos de evento (dropdown) derivado de resultados
  const tiposEncontrados = useMemo(() => {
    const set = new Set(items.map(x => x?.tipoEvento).filter(Boolean));
    return [''].concat(Array.from(set));
  }, [items]);

  const buildQs = (extra = {}) => {
    const usp = new URLSearchParams({
      from, to,
      ...(tipoEvento ? { tipoEvento } : {}),
      ...(q.trim() ? { q: q.trim() } : {}),
      ...extra,
    });
    return usp.toString();
  };

  const fetchSummary = async () => {
    setLoadingSummary(true);
    try {
      const url = `${API_BASE_URL}/reportes/resumen?${buildQs()}`;
      const r = await fetch(url, {
        credentials: 'include',
        cache: 'no-store',
        headers: { Accept: 'application/json' },
        });


      const d = r.ok ? await r.json() : null;
      if (!r.ok) throw new Error(d?.error || `HTTP ${r.status}`);
      setSummary(prev => ({
        counts: d?.counts || prev.counts,
        money: d?.money || prev.money,
        }));
    } catch (e) {
      console.error(e);
      // no tronar todo si falla resumen
      setSummary({
        counts: { eventos: 0, pagados: 0, parciales: 0, pendientes: 0 },
        money: { total: 0, paid: 0, remaining: 0, avgTicket: 0 },
        });
    } finally {
      setLoadingSummary(false);
    }
  };

  const fetchTable = async (p = page) => {
    setLoading(true);
    setError('');
    try {
      const url = `${API_BASE_URL}/reportes/eventos?${buildQs({
        status,
        page: String(p),
        pageSize: String(pageSize),
      })}`;
      const r = await fetch(url, {
        credentials: 'include',
        cache: 'no-store',
        headers: { Accept: 'application/json' },
        });


      const d = r.ok ? await r.json() : null;
      if (!r.ok) throw new Error(d?.error || `HTTP ${r.status}`);

      setSummary(prev => ({
        counts: d?.counts || prev.counts,
        money: d?.money || prev.money,
        }));

      setItems(Array.isArray(d?.items) ? d.items : []);
      setTotalPages(Number(d?.totalPages || 1));
      setPage(Number(d?.page || p));
    } catch (e) {
      console.error(e);
      setSummary({
        counts: { eventos: 0, pagados: 0, parciales: 0, pendientes: 0 },
        money: { total: 0, paid: 0, remaining: 0, avgTicket: 0 },
    });
      setError(e?.message || 'No se pudo cargar el reporte.');
      setItems([]);
      setTotalPages(1);
    } finally {
      setLoading(false);
    }
  };

  // recargar al cambiar filtros
  useEffect(() => {
    setPage(1);
    fetchSummary();
    fetchTable(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [from, to, tipoEvento, status, q]);

  const openEventoPdf = (id) => {
    if (!id) return;
    window.open(`${API_BASE_URL}/reservas/${id}/pdf`, '_blank', 'noopener');
  };

  const openPanelCliente = (id) => {
    if (!id) return;
    const qs = new URLSearchParams({ reservaId: id, mode: 'admin' }).toString();
    window.open(`/cliente/dashboard?${qs}`, '_blank', 'noopener,noreferrer');
  };

 const exportExcel = () => {
  if (!items || items.length === 0) return;

  const rows = items.map(x => ({
    Folio: x.shortId || '',
    Cliente: x.cliente || '',
    Evento: x.tipoEvento || '',
    Fecha: x.fecha ? new Date(x.fecha).toLocaleDateString('es-MX') : '',
    Hora: (x.horaInicio && x.horaFin)
      ? `${x.horaInicio}-${x.horaFin}`
      : (x.horaInicio || x.horaFin || ''),
    Total: Number(x.total || 0),
    Pagado: Number(x.paid || 0),
    Saldo: Number(x.remaining || 0),
    Estatus: x.paymentStatus || '',
    Correo: x.correo || '',
    Telefono: x.telefono || '',
  }));

  const ws = XLSX.utils.json_to_sheet(rows);

  // (Opcional) Ajuste simple de anchos
  ws['!cols'] = [
    { wch: 12 }, // Folio
    { wch: 22 }, // Cliente
    { wch: 18 }, // Evento
    { wch: 12 }, // Fecha
    { wch: 14 }, // Hora
    { wch: 12 }, // Total
    { wch: 12 }, // Pagado
    { wch: 12 }, // Saldo
    { wch: 12 }, // Estatus
    { wch: 26 }, // Correo
    { wch: 14 }, // Telefono
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Reportes');

  XLSX.writeFile(wb, `reporte_${from}_a_${to}.xlsx`);
};

  const badge = (s) => {
    const v = String(s || '').toUpperCase();
    const style = {
      display: 'inline-block',
      padding: '2px 8px',
      borderRadius: 999,
      fontSize: 12,
      border: '1px solid #ddd',
    };
    if (v === 'PAGADO') return <span style={{ ...style, borderColor: '#16a34a' }}>PAGADO</span>;
    if (v === 'PARCIAL') return <span style={{ ...style, borderColor: '#f59e0b' }}>PARCIAL</span>;
    return <span style={{ ...style, borderColor: '#ef4444' }}>PENDIENTE</span>;
  };

  return (
    <div className="dashboard-content">
      <div className="dashboard-header">
        <h1>Reportes</h1>
        <p>Historial de eventos y recibos (pagados / pendientes) con filtros</p>
      </div>

      {/* Filtros */}
      <div style={{
        display: 'flex',
        gap: 10,
        flexWrap: 'wrap',
        alignItems: 'end',
        padding: 12,
        border: '1px solid #eee',
        borderRadius: 12,
        background: '#fff',
        marginBottom: 12
      }}>
        <div>
          <label style={{ fontSize: 12 }}>Desde</label>
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </div>
        <div>
          <label style={{ fontSize: 12 }}>Hasta</label>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>

        <div>
          <label style={{ fontSize: 12 }}>Estatus pago</label>
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="ALL">Todos</option>
            <option value="PAGADO">Pagado</option>
            <option value="PARCIAL">Parcial</option>
            <option value="PENDIENTE">Pendiente</option>
          </select>
        </div>

        <div>
          <label style={{ fontSize: 12 }}>Tipo evento</label>
          <input
            placeholder="Ej. Boda"
            value={tipoEvento}
            onChange={(e) => setTipoEvento(e.target.value)}
            list="tipos-evento"
          />
          <datalist id="tipos-evento">
            {tiposEncontrados.filter(Boolean).map(t => (
              <option key={t} value={t} />
            ))}
          </datalist>
        </div>

        <div style={{ flex: 1, minWidth: 220 }}>
          <label style={{ fontSize: 12 }}>Buscar</label>
          <input
            style={{ width: '100%' }}
            placeholder="Cliente / correo / teléfono / shortId"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-outline-secondary" onClick={() => { setTipoEvento(''); setStatus('ALL'); setQ(''); }}>
            Limpiar
          </button>
          <button className="btn btn-outline-primary" onClick={exportExcel} disabled={(items || []).length === 0}>
            Export Excel
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div className="stats-grid" style={{ marginBottom: 12 }}>
        <div className="stat-card">
          <div className="stat-icon">📌</div>
          <div className="stat-info">
            <h3>Eventos</h3>
            <p className="stat-number">{loadingSummary ? '…' : summary.counts.eventos}</p>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">✅</div>
          <div className="stat-info">
            <h3>Pagados</h3>
            <p className="stat-number">{loadingSummary ? '…' : summary.counts.pagados}</p>
          </div>
        </div>
        {/*<div className="stat-card">
          <div className="stat-icon">🟡</div>
          <div className="stat-info">
            <h3>Parciales</h3>
            <p className="stat-number">{loadingSummary ? '…' : summary.counts.parciales}</p>
          </div>
        </div>*/}
        <div className="stat-card">
          <div className="stat-icon">⏳</div>
          <div className="stat-info">
            <h3>Pendientes</h3>
            <p className="stat-number">{loadingSummary ? '…' : summary.counts.pendientes}</p>
          </div>
        </div>
      </div>

      <div className="stats-grid" style={{ marginBottom: 12 }}>
        <div className="stat-card">
          <div className="stat-icon">💰</div>
          <div className="stat-info">
            <h3>Total</h3>
            <p className="stat-number">{loadingSummary ? '…' : money(summary.money.total)}</p>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">💵</div>
          <div className="stat-info">
            <h3>Pagado</h3>
            <p className="stat-number">{loadingSummary ? '…' : money(summary.money.paid)}</p>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">🧾</div>
          <div className="stat-info">
            <h3>Saldo</h3>
            <p className="stat-number">{loadingSummary ? '…' : money(summary.money.remaining)}</p>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">📈</div>
          <div className="stat-info">
            <h3>Ticket prom.</h3>
            <p className="stat-number">{loadingSummary ? '…' : money(summary.money.avgTicket)}</p>
          </div>
        </div>
      </div>

      {/* Tabla */}
      <div style={{ background: '#fff', border: '1px solid #eee', borderRadius: 12, overflow: 'hidden' }}>
        <div style={{ padding: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <strong>Historial</strong>
          <small style={{ opacity: 0.7 }}>{loading ? 'Cargando…' : `${items.length} registros (página ${page}/${totalPages})`}</small>
        </div>

        {error && <div style={{ padding: 12, color: '#b91c1c' }}>{error}</div>}

        <div style={{ overflowX: 'auto' }}>
          <table className="clientes-table">
            <thead>
              <tr>
                <th>Folio</th>
                <th>Cliente</th>
                <th>Evento</th>
                <th>Fecha</th>
                <th>Hora</th>
                <th>Total</th>
                <th>Pagado</th>
                <th>Saldo</th>
                <th>Estatus</th>
                <th style={{ width: 220 }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {!loading && (items || []).length === 0 && (
                <tr><td colSpan="10" className="empty">Sin resultados</td></tr>
              )}

              {(items || []).map((x) => (
                <tr key={x._id}>
                  <td><strong>{x.shortId || '—'}</strong></td>
                  <td>{x.cliente || '—'}</td>
                  <td>{x.tipoEvento || '—'}</td>
                  <td>{x.fecha ? new Date(x.fecha).toLocaleDateString('es-MX') : '—'}</td>
                  <td>{(x.horaInicio && x.horaFin) ? `${x.horaInicio}–${x.horaFin}` : (x.horaInicio || x.horaFin || '—')}</td>
                  <td>{money(x.total)}</td>
                  <td>{money(x.paid)}</td>
                  <td>{money(x.remaining)}</td>
                  <td>{badge(x.paymentStatus)}</td>
                  <td style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <button className="btn btn-light" onClick={() => openPanelCliente(x._id)}>
                      Ver panel
                    </button>
                    <button className="btn" onClick={() => openEventoPdf(x._id)}>
                      PDF evento
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Paginación */}
        <div className="pagination" style={{ padding: 12 }}>
          <button
            className="pager"
            onClick={() => fetchTable(Math.max(1, page - 1))}
            disabled={page <= 1 || loading}
          >
            ←
          </button>
          <span className="page-info">Página {page} de {totalPages}</span>
          <button
            className="pager"
            onClick={() => fetchTable(Math.min(totalPages, page + 1))}
            disabled={page >= totalPages || loading}
          >
            →
          </button>
        </div>
      </div>
    </div>
  );
}