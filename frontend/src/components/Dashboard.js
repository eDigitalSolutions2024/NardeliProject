import React, { useState, useEffect } from 'react';
import { jwtDecode } from 'jwt-decode';
import dayjs from 'dayjs';
import './Dashboard.css';
import Calendario from './Calendario';
import FormProducto from './FormProducto';
import TablaProductos from './TablaProductos';
import API_BASE_URL from '../api';
import Clientes from './Clientes';
import Reserva from './ReservarEvento';
import Reportes from './Reportes';
// imports nuevos arriba
import FormAccesorio from './FormAccesorio';
import TablaAccesorios from './TablaAccesorios';

const Dashboard = ({ onLogout }) => {
  const [user, setUser] = useState(null);
  const [activeSection, setActiveSection] = useState('dashboard');
  const [showDropdown, setShowDropdown] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [inventarioTick, setInventarioTick] = useState(0);
  const [accesorioTick, setAccesorioTick] = useState(0);
  const [inventarioTab, setInventarioTab] = useState('producto'); // 'producto' | 'accesorio'

  // KPIs / actividad
  const [loadingDash, setLoadingDash] = useState(false);
  const [kpis, setKpis] = useState({
    eventosMes: 0,
    proximosEventos: 0,
  });
  const [actividad, setActividad] = useState([]); // cotizaciones pendientes


  const [searchActividad, setSearchActividad] = useState('');



  // === Nuevo: modal de edición de cotización ===
  const [showEditCot, setShowEditCot] = useState(false);
  const [cotEdit, setCotEdit] = useState(null);

  // Helpers
  const obtenerIcono = (tipo = '') => {
    switch (String(tipo).toLowerCase()) {
      case 'boda': return '💒';
      case 'cumpleaños': return '🎂';
      case 'graduación': return '🎓';
      case 'xv': return '👑';
      case 'reunión': return '💼';
      case 'comedia': return '🤡';
      case 'musica': return '🎶';
      default: return '🎉';
    }
  };


  const eliminarCotizacion = async (id) => {
  if (!id) return;
  const ok = window.confirm('¿Eliminar esta cotización? Esta acción no se puede deshacer.');
  if (!ok) return;

  try {
    const resp = await fetch(`${API_BASE_URL}/reservas/${encodeURIComponent(id)}`, {
      method: 'DELETE'
    });

    if (!resp.ok) {
      const txt = await resp.text().catch(() => '');
      let err;
      try { err = JSON.parse(txt); } catch { err = { msg: txt || `HTTP ${resp.status}` }; }
      alert(err?.msg || err?.error || 'No se pudo eliminar la cotización');
      return;
    }

    await cargarDashboardData(); // refresca el panel
    alert('✅ Cotización eliminada');
  } catch (e) {
    console.error('eliminarCotizacion error:', e);
    alert('Error de conexión');
  }
};

  const toHHmm = (h) => {
    if (!h) return '';
    const s = String(h).trim().toLowerCase();
    const m = s.match(/^(\d{1,2}):(\d{2})/);
    if (!m) return String(h);
    let hh = parseInt(m[1], 10);
    const mm = m[2];
    const isPM = /p\s*\.?\s*m\.?/i.test(s) || /\bpm\b/i.test(s);
    const isAM = /a\s*\.?\s*m\.?/i.test(s) || /\bam\b/i.test(s);
    if (isPM && hh < 12) hh += 12;
    if (isAM && hh === 12) hh = 0;
    return `${String(hh).padStart(2, '0')}:${mm}`;
  };

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      try {
        const decoded = jwtDecode(token);
        setUser(decoded);
      } catch (error) {
        console.error('Token inválido', error);
      }
    }
  }, []);

  // ---- Carga de datos del dashboard (eventos + cotizaciones) ----
  const cargarDashboardData = async () => {
    const hoy = new Date();
    const iniMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
    const finMes = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0, 23, 59, 59, 999);

    const hoy0 = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate(), 0, 0, 0, 0);

    
    const getFecha = (r) => {
      const ymd = r.fechaLocal || String(r.fecha).slice(0, 10); // "YYYY-MM-DD"
      return new Date(`${ymd}T12:00:00`);
    };
    const getCliente = (r) => r.cliente || r.clienteNombre || 'Sin nombre';

    const soloEventos = (arr) =>
      (Array.isArray(arr) ? arr : []).filter(
        r => (r.tipoReserva ?? (r.esCotizacion ? 'cotizacion' : 'evento')) === 'evento'
      );
    const soloCotizaciones = (arr) =>
      (Array.isArray(arr) ? arr : []).filter(
        r => (r.tipoReserva ?? (r.esCotizacion ? 'cotizacion' : 'evento')) === 'cotizacion'
      );

    setLoadingDash(true);
    try {
      const [rawEventos, rawCots] = await Promise.all([
        fetch(`${API_BASE_URL}/reservas?tipo=evento`).then(r => r.json()).catch(() => []),
        fetch(`${API_BASE_URL}/reservas?tipo=cotizacion`).then(r => r.json()).catch(() => []),
      ]);

      const eventos = soloEventos(rawEventos);
      const cotizaciones = soloCotizaciones(rawCots);

      // KPIs (solo eventos)
      const enMes = eventos.filter(r => {
          const f = getFecha(r);
          return f >= hoy0 && f <= finMes;
        });
      const futurosEventos = eventos
        .filter(r => getFecha(r) >= new Date())
        .sort((a,b) => getFecha(a) - getFecha(b));

      setKpis({
        eventosMes: enMes.length,
        proximosEventos: futurosEventos.length,
      });

      // Cotizaciones pendientes (no aceptadas)
      const pendientes = cotizaciones
        .filter(r => !(r.cotizacion && r.cotizacion.aceptada))
        .sort((a,b) => getFecha(a) - getFecha(b));

      const buildPdfUrl = (id) => `${API_BASE_URL}/reservas/${id}/pdf`;

      setActividad(
        pendientes.slice(0).map(r => {
          console.log('cot:', r._id, 'shortId:', r.shortId, 'folio:', r.folio);

          return {
            id: r._id,
            folio: (r.shortId || r.folio || '').toUpperCase(),
            folioLabel: `#${(r.shortId || r.folio || '').toUpperCase()}`,
            titulo: `Cotización - ${getCliente(r)}`,
            subtitulo: `Para el ${dayjs(getFecha(r)).format('DD [de] MMMM [de] YYYY')}`,
            icon: '📝',
            pdfUrl: buildPdfUrl(r._id),
            cliente: getCliente(r),
            tipoEvento: r.tipoEvento || '',
            ymd: r.fechaLocal || String(r.fecha).slice(0, 10),
            horaInicio: r.horaInicio || '',
            horaFin: r.horaFin || r.horaInicio || '',
            cantidadPersonas: r.cantidadPersonas || 0,
            descripcion: r.descripcion || '',
          };
        })
      );


       



    } catch (e) {
      console.error('Error cargando reservas para dashboard:', e);
    } finally {
      setLoadingDash(false);
    }
  };

  useEffect(() => {
    if (activeSection === 'dashboard') cargarDashboardData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSection]);

  const isAdmin = user?.role === 'admin';
  const isAsistente = user?.role === 'asistente'; // ← añadido

  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: '📊' },
    { id: 'clientes', label: 'Clientes', icon: '👥' },
    { id: 'calendario', label: 'Calendario', icon: '📅' },
    { id: 'reportes', label: 'Reportes', icon: '📈' },
    { id: 'inventario', label: 'Inventario', icon: '🏬'},
    { id: 'reservar', label: 'Reservar', icon: '✅'},
  ];

  // ocultar solo a asistentes: reportes
  const visibleMenuItems = isAsistente
    ? menuItems.filter(i => !['reportes'].includes(i.id))
    : menuItems;

  // ===== Acciones de cotizaciones =====
  const abrirModalEditarCot = (a) => {
    setCotEdit({
      id: a.id,
      cliente: a.cliente,
      tipo: a.tipoEvento,
      fecha: new Date(`${a.ymd}T12:00:00`),
      horaInicio: toHHmm(a.horaInicio),
      horaFin: toHHmm(a.horaFin || a.horaInicio),
      invitados: a.cantidadPersonas,
      descripcion: a.descripcion || '',
    });
    setShowEditCot(true);
  };

  const cerrarModalCot = () => {
    setCotEdit(null);
    setShowEditCot(false);
  };

  const onChangeCot = (e) => {
    const { name, value } = e.target;
    setCotEdit(prev => ({ ...prev, [name]: value }));
  };

  const actualizarCotizacion = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        cliente: cotEdit.cliente,
        tipoEvento: cotEdit.tipo,
        fecha: dayjs(cotEdit.fecha).format('YYYY-MM-DD'),
        horaInicio: toHHmm(cotEdit.horaInicio),
        horaFin: toHHmm(cotEdit.horaFin),
        cantidadPersonas: Number(cotEdit.invitados || 0),
        descripcion: cotEdit.descripcion || '',
        // mantenerla como cotización (no convertir aquí)
        tipoReserva: 'cotizacion',
      };

      const r = await fetch(`${API_BASE_URL}/reservas/${cotEdit.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!r.ok) {
        const err = await r.json().catch(()=>({}));
        alert(err?.motivo || err?.error || 'No se pudo actualizar la cotización');
        return;
      }

      cerrarModalCot();
      await cargarDashboardData();
    } catch (err) {
      console.error('actualizarCotizacion error:', err);
      alert('Error de conexión');
    }
  };

  const convertirACEvento = async (id) => {
    try {
      const cleanId = String(id).replace(/['"]/g, '').trim();
      const url = `${API_BASE_URL}/reservas/${encodeURIComponent(cleanId)}/aceptar-cotizacion`;

      const resp = await fetch(url, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})   // <-- importante
      });

      if (!resp.ok) {
        const text = await resp.text();
        let errObj;
        try { errObj = JSON.parse(text); } catch { errObj = { msg: text }; }
        alert(errObj?.msg || errObj?.motivo || errObj?.error || `Error ${resp.status}`);
        return;
      }

      await cargarDashboardData();
      alert('✅ Cotización convertida a Evento');
    } catch (e) {
      console.error('convertirACEvento error:', e);
      alert('Error de conexión');
    }
  };

  const abrirPanelArticulosAdmin = () => {
    if (!cotEdit?.id) return;
    const qs = new URLSearchParams({ reservaId: cotEdit.id, mode: 'admin' }).toString();
    window.open(`/cliente/dashboard?${qs}`, '_blank', 'noopener,noreferrer');
  };

 const normalizeFolio = (s) =>
  String(s || '').trim().replace(/^#/, '').toUpperCase();

const actividadFiltrada = actividad.filter(a => {
  const q = String(searchActividad || '').trim();
  if (!q) return true;

  const qNorm = normalizeFolio(q);

  const texto = `${a.titulo || ''} ${a.subtitulo || ''} ${a.cliente || ''}`.toLowerCase();
  const folio = normalizeFolio(a.folio);

  // busca por texto normal o por folio
  return (
    texto.includes(q.toLowerCase()) ||
    (folio && folio.includes(qNorm))
  );
});

  const renderContent = () => {
    switch (activeSection) {
      case 'dashboard':
        return (
          <div className="dashboard-content">
            <div className="dashboard-header">
              <h1>Bienvenido, {user?.fullname || user?.email}</h1>
              <p>Panel de control - Salón de Eventos Nardeli</p>
            </div>

            {/* KPIs */}
            <div className="stats-grid">
              <div className="stat-card">
                <div className="stat-icon">🎉</div>
                <div className="stat-info">
                  <h3>Eventos del Mes</h3>
                  <p className="stat-number">{kpis.eventosMes}</p>
                </div>
              </div>

              <div className="stat-card">
                <div className="stat-icon">📅</div>
                <div className="stat-info">
                  <h3>Próximos Eventos</h3>
                  <p className="stat-number">{kpis.proximosEventos}</p>
                </div>
              </div>
            </div>

            {/* Cotizaciones pendientes */}
<div className="recent-activity">
  <div className="d-flex align-items-center justify-content-between" style={{ gap: 12, flexWrap: 'wrap' }}>
    <h2 style={{ marginBottom: 0 }}>Cotizacion pendiente</h2>

    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
      {loadingDash && <span className="text-muted small">Actualizando…</span>}

      {/* 🔍 Buscador */}
      <input
        type="text"
        placeholder="Buscar por cliente, fecha o texto..."
        value={searchActividad}
        onChange={(e) => setSearchActividad(e.target.value)}
        style={{
          padding: '6px 10px',
          borderRadius: 8,
          border: '1px solid #ddd',
          minWidth: 220,
          fontSize: 14,
        }}
      />
    </div>
  </div>

  <div className="activity-list">
    {actividadFiltrada.length === 0 && (
      <div className="activity-item">
        <span className="activity-icon">ℹ️</span>
        <div className="activity-details">
          <p><strong>Sin cotizaciones pendientes</strong></p>
          <small>
            {actividad.length === 0
              ? 'Cuando registres cotizaciones aparecerán aquí.'
              : 'No hay resultados para ese criterio de búsqueda.'}
          </small>
        </div>
      </div>
    )}

    {actividadFiltrada.map(a => (
      <div key={a.id} className="activity-item">
        <span className="activity-icon">{a.icon}</span>
        <div className="activity-details">
          <p>
            <strong>{a.titulo}</strong>
            {a.folio && (
              <span style={{ marginLeft: 8, fontSize: 12, opacity: 0.8 }}>
                #{a.folio}
              </span>
            )}
          </p>
          <small>{a.subtitulo}</small>
          <div
            className="activity-actions"
            style={{ marginTop: 8, display: 'flex', gap: 8, flexWrap: 'wrap' }}
          >
            <button
              className="btn btn-sm btn-outline-secondary"
              onClick={() => abrirModalEditarCot(a)}
            >
              ✏️ Editar
            </button>
            <button
              className="btn btn-sm btn-outline-success"
              onClick={() => convertirACEvento(a.id)}
            >
              ✅ Convertir a Evento
            </button>
            {a.pdfUrl && (
              <a
                className="btn btn-sm btn-outline-primary"
                href={a.pdfUrl}
                target="_blank"
                rel="noreferrer"
              >
                Ver PDF
              </a>
            )}
            {!isAsistente && (
  <button
    className="btn btn-sm btn-outline-danger"
    onClick={() => eliminarCotizacion(a.id)}
    title="Eliminar cotización"
  >
    🗑️ Eliminar
  </button>
)}
          </div>
        </div>
      </div>
    ))}
  </div>
</div>


            {/* Modal de edición de cotización */}
            {showEditCot && cotEdit && (
              <div className="modal-overlay">
                <div className="modal-content">
                  <h2>Editar Cotización</h2>
                  <form onSubmit={actualizarCotizacion}>
                    <input
                      type="text"
                      name="cliente"
                      placeholder="Nombre del cliente"
                      value={cotEdit.cliente}
                      onChange={onChangeCot}
                      required
                    />
                    <input
                      type="text"
                      name="tipo"
                      placeholder="Tipo de evento"
                      value={cotEdit.tipo}
                      onChange={onChangeCot}
                      required
                    />
                    <input
                      type="date"
                      name="fecha"
                      value={dayjs(cotEdit.fecha).format('YYYY-MM-DD')}
                      onChange={(e) => setCotEdit(prev => ({ ...prev, fecha: new Date(`${e.target.value}T12:00:00`) }))}
                      required
                    />

                    <div style={{ display: 'flex', gap: 8 }}>
                      <div style={{ flex: 1 }}>
                        <label style={{ display: 'block', fontSize: 12, marginBottom: 4 }}>Hora inicio</label>
                        <input
                          type="time"
                          name="horaInicio"
                          value={toHHmm(cotEdit.horaInicio)}
                          onChange={onChangeCot}
                          required
                        />
                      </div>
                      <div style={{ flex: 1 }}>
                        <label style={{ display: 'block', fontSize: 12, marginBottom: 4 }}>Hora fin</label>
                        <input
                          type="time"
                          name="horaFin"
                          value={toHHmm(cotEdit.horaFin)}
                          onChange={onChangeCot}
                          required
                        />
                      </div>
                    </div>

                    <input
                      type="number"
                      name="invitados"
                      placeholder="Cantidad de personas"
                      value={cotEdit.invitados}
                      onChange={onChangeCot}
                      required
                    />

                    <textarea
                      name="descripcion"
                      placeholder="Observaciones"
                      value={cotEdit.descripcion}
                      onChange={onChangeCot}
                    />

                    <div className="modal-actions" style={{ display: 'flex', gap: 8, justifyContent: 'space-between', marginTop: 8 }}>
                      <button type="button" className="btn btn-outline-secondary" onClick={abrirPanelArticulosAdmin}>
                        Abrir panel de artículos (admin)
                      </button>

                      <div style={{ display: 'flex', gap: 8 }}>
                        <button type="submit" className="btn btn-primary">Guardar</button>
                        <button type="button" className="btn" onClick={cerrarModalCot}>Cancelar</button>
                      </div>
                    </div>
                  </form>
                </div>
              </div>
            )}
          </div>
        );

      case 'clientes':
        return (
          <div className="dashboard-content">
            <h1>Gestión de Clientes</h1>
            <Clientes />
          </div>
        );
      case 'calendario':
        return (
          <div className="dashboard-content">
            <Calendario />
          </div>
        );
      case 'reportes':
        return (
          <div className="dashboard-content">
            <Reportes />
          </div>
        );
      case 'reservar':
        return (
          <div className='dashboard-content'>
            <Reserva />
          </div>
        );
      case 'inventario':
        return (
    <div className='dashboard-content'>
      <h1>Inventario</h1>

      {/* Selector de formulario */}
      <div style={{ display:'flex', gap:8, margin:'8px 0 16px' }}>
        <button
          className={`cd-btn ${inventarioTab === 'producto' ? '' : 'cd-btn-clear'}`}
          onClick={() => setInventarioTab('producto')}
        >
          Productos
        </button>
        <button
          className={`cd-btn ${inventarioTab === 'accesorio' ? '' : 'cd-btn-clear'}`}
          onClick={() => setInventarioTab('accesorio')}
        >
          Accesorios
        </button>
      </div>

      {inventarioTab === 'producto' ? (
        <>
          <FormProducto onProductoAgregado={() => setInventarioTick(t => t + 1)} />
          <TablaProductos refresh={inventarioTick} />
        </>
      ) : (
        <>
          <FormAccesorio onAccesorioAgregado={() => setAccesorioTick(t => t + 1)} />
          <TablaAccesorios refresh={accesorioTick} />
        </>
      )}
    </div>
  );
      case 'configuracion':
        return (
          <div className="dashboard-content">
            <h1>Configuración</h1>
            <p>Configura las opciones del sistema.</p>
          </div>
        );
      default:
        return <div>Sección no encontrada</div>;
    }
  };

  return (
    <div className="dashboard-container">
      {/* Sidebar */}
      <div className={`sidebar ${sidebarOpen ? '' : 'collapsed'}`}>
        <div className='hamburger-wrapper'>
          <button className='hamburger-icon' onClick={() => setSidebarOpen(!sidebarOpen)}>☰</button>
        </div>

        <div className="sidebar-header">
          <h2 className="sidebar-brand">Nardeli</h2>
          <p className="sidebar-subtitle">Salón de Eventos</p>
        </div>

        <nav className="sidebar-nav">
          {visibleMenuItems.map(item => (
            <button
              key={item.id}
              className={`nav-item ${activeSection === item.id ? 'active' : ''}`}
              onClick={() => {
                // bloqueo suave solo para asistentes en secciones prohibidas
                if (isAsistente && ['reportes'].includes(item.id)) return;
                setActiveSection(item.id);
              }}
            >
              <span className="nav-icon">{item.icon}</span>
              <span className="nav-label">{item.label}</span>
            </button>
          ))}
        </nav>

        <div className="sidebar-footer">
          <button className="logout-btn" onClick={onLogout}>
            <span className="nav-icon">🚪</span>
            <span className="nav-label">Cerrar Sesión</span>
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="main-content">
        <header className="main-header">
          <div className="header-left">
            <h1 className="page-title">
              {menuItems.find(item => item.id === activeSection)?.label || 'Dashboard'}
            </h1>
          </div>
          {/* user info dropdown comentado */}
        </header>

        <main className="content-area">
          {renderContent()}
        </main>
      </div>
    </div>
  );
};

export default Dashboard;
