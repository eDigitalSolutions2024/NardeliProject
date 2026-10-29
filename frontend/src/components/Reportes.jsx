import MostrarMas from './ui/MostrarMas';
import useMostrarMas from './ui/useMostrarMas';
import { LuCalendarCheck, LuCircleCheck, LuCircleDot, LuHourglass, LuCoins, LuBadgeDollarSign, LuReceipt, LuTrendingUp, LuEye, LuFileDown, LuChevronLeft, LuChevronRight, LuInbox } from 'react-icons/lu';
import SelectField from './ui/SelectField';
import DateField from './ui/DateField';
import SearchField from './ui/SearchField';
import React, { useEffect, useMemo, useState } from 'react';
import API_BASE_URL, { authHeaders } from '../api';
import * as XLSX from 'xlsx';

const money = (n) =>
  Number(n || 0).toLocaleString('es-MX', {
    style: 'currency',
    currency: 'MXN',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

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
        cache: 'no-store',
        headers: { Accept: 'application/json', ...authHeaders() },
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
        cache: 'no-store',
        headers: { Accept: 'application/json', ...authHeaders() },
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

 const mRep = useMostrarMas(items || []); // en teléfono: 5 por tanda dentro de cada página
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
    if (v === 'PAGADO') return <span className="badge success">PAGADO</span>;
    if (v === 'PARCIAL') return <span className="badge warning">PARCIAL</span>;
    return <span className="badge danger">PENDIENTE</span>;
  };

  return (
    <div className="dashboard-content nd-wide">
      <div className="nd-welcome">
        <div>
          <h1>Reportes</h1>
          <p>Historial de eventos y recibos (pagados / pendientes) con filtros</p>
        </div>
      </div>

      {/* Filtros */}
      <div className="rep-filtros" style={{
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
          <DateField value={from} onChange={setFrom} placeholder="Desde" size="sm" />
        </div>
        <div>
          <label style={{ fontSize: 12 }}>Hasta</label>
          <DateField value={to} onChange={setTo} placeholder="Hasta" size="sm" />
        </div>

        <div>
          <label style={{ fontSize: 12 }}>Estatus pago</label>
          <SelectField
            size="sm"
            value={status}
            onChange={setStatus}
            options={[
              { value: 'ALL', label: 'Todos' },
              { value: 'PAGADO', label: 'Pagado' },
              { value: 'PARCIAL', label: 'Parcial' },
              { value: 'PENDIENTE', label: 'Pendiente' },
            ]}
          />
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
          <SearchField
            size="sm"
            placeholder="Cliente / correo / teléfono / shortId"
            value={q}
            onChange={setQ}
            style={{ width: '100%' }}
          />
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <button className="nd-btn nd-btn-ghost" onClick={() => { setTipoEvento(''); setStatus('ALL'); setQ(''); }}>
            Limpiar
          </button>
          <button className="nd-btn nd-btn-primary" onClick={exportExcel} disabled={(items || []).length === 0}>
            Export Excel
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div className="nd-kpis">
        <div className="nd-kpi nd-kpi-morado">
          <span className="nd-kpi-icon"><LuCalendarCheck /></span>
          <div className="nd-kpi-info">
            <span className="nd-kpi-label">Eventos</span>
            <strong className="nd-kpi-number">{loadingSummary ? '…' : summary.counts.eventos}</strong>
          </div>
        </div>
        <div className="nd-kpi nd-kpi-verde">
          <span className="nd-kpi-icon"><LuCircleCheck /></span>
          <div className="nd-kpi-info">
            <span className="nd-kpi-label">Pagados</span>
            <strong className="nd-kpi-number">{loadingSummary ? '…' : summary.counts.pagados}</strong>
          </div>
        </div>
        <div className="nd-kpi nd-kpi-dorado">
          <span className="nd-kpi-icon"><LuCircleDot /></span>
          <div className="nd-kpi-info">
            <span className="nd-kpi-label">Parciales</span>
            <strong className="nd-kpi-number">{loadingSummary ? '…' : summary.counts.parciales}</strong>
          </div>
        </div>
        <div className="nd-kpi nd-kpi-rojo">
          <span className="nd-kpi-icon"><LuHourglass /></span>
          <div className="nd-kpi-info">
            <span className="nd-kpi-label">Pendientes</span>
            <strong className="nd-kpi-number">{loadingSummary ? '…' : summary.counts.pendientes}</strong>
          </div>
        </div>
      </div>

      <div className="nd-kpis">
        <div className="nd-kpi nd-kpi-morado nd-kpi-money">
          <span className="nd-kpi-icon"><LuCoins /></span>
          <div className="nd-kpi-info">
            <span className="nd-kpi-label">Total</span>
            <strong className="nd-kpi-number">{loadingSummary ? '…' : money(summary.money.total)}</strong>
          </div>
        </div>
        <div className="nd-kpi nd-kpi-verde nd-kpi-money">
          <span className="nd-kpi-icon"><LuBadgeDollarSign /></span>
          <div className="nd-kpi-info">
            <span className="nd-kpi-label">Pagado</span>
            <strong className="nd-kpi-number">{loadingSummary ? '…' : money(summary.money.paid)}</strong>
          </div>
        </div>
        <div className="nd-kpi nd-kpi-lila nd-kpi-money">
          <span className="nd-kpi-icon"><LuReceipt /></span>
          <div className="nd-kpi-info">
            <span className="nd-kpi-label">Saldo</span>
            <strong className="nd-kpi-number">{loadingSummary ? '…' : money(summary.money.remaining)}</strong>
          </div>
        </div>
        <div className="nd-kpi nd-kpi-dorado nd-kpi-money">
          <span className="nd-kpi-icon"><LuTrendingUp /></span>
          <div className="nd-kpi-info">
            <span className="nd-kpi-label">Ticket prom.</span>
            <strong className="nd-kpi-number">{loadingSummary ? '…' : money(summary.money.avgTicket)}</strong>
          </div>
        </div>
      </div>

      {/* Tabla */}
      <div className="rep-tabla">
        <div className="rep-tabla-head">
          <strong>Historial</strong>
          <small>{loading ? 'Cargando…' : `${items.length} registros (página ${page}/${totalPages})`}</small>
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
                <tr><td colSpan="10" className="empty"><LuInbox /> Sin resultados</td></tr>
              )}

              {mRep.visibles.map((x) => (
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
                  <td className="acciones">
                    <button className="nd-btn nd-btn-ghost" onClick={() => openPanelCliente(x._id)}>
                      <LuEye /> Ver panel
                    </button>
                    <button className="nd-btn nd-btn-primary btn-pdf-rojo" onClick={() => openEventoPdf(x._id)}>
                      <LuFileDown /> PDF evento
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <MostrarMas m={mRep} />
        </div>

        {/* Paginación */}
        <div className="pagination" style={{ padding: 12 }}>
          <button
            className="pager"
            onClick={() => fetchTable(Math.max(1, page - 1))}
            disabled={page <= 1 || loading}
          >
            <LuChevronLeft aria-label="Anterior" />
          </button>
          <span className="page-info">Página {page} de {totalPages}</span>
          <button
            className="pager"
            onClick={() => fetchTable(Math.min(totalPages, page + 1))}
            disabled={page >= totalPages || loading}
          >
            <LuChevronRight aria-label="Siguiente" />
          </button>
        </div>
      </div>
    </div>
  );
}