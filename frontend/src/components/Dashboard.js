import React, { useState, useEffect } from 'react';
import { jwtDecode } from 'jwt-decode';
import './Dashboard.css';
import Calendario from './Calendario';
import FormProducto from './FormProducto';
import TablaProductos from './TablaProductos';
import API_BASE_URL from '../api'; // ⬅️ ajusta la ruta si tu archivo api está en otro lugar
import Clientes from './Clientes';

const Dashboard = ({ onLogout }) => {
  const [user, setUser] = useState(null);
  const [activeSection, setActiveSection] = useState('dashboard');
  const [showDropdown, setShowDropdown] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);


  // 🔹 NUEVO: estado para KPIs / actividad
  const [loadingDash, setLoadingDash] = useState(false);
  const [kpis, setKpis] = useState({
    eventosMes: 0,
    //clientesActivos: 0, // si no lo calculas aún, lo dejamos en 0
    //ingresosMes: 0,
    proximosEventos: 0,
  });
  const [actividad, setActividad] = useState([]);

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

  // 🔹 NUEVO: carga datos del dashboard cuando entras a la sección 'dashboard'
 useEffect(() => {
  if (activeSection !== 'dashboard') return;

  const hoy = new Date();
  const iniMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
  const finMes = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0, 23, 59, 59, 999);

  const getFecha = (r) => {
    const ymd = r.fechaLocal || String(r.fecha).slice(0, 10); // "YYYY-MM-DD"
    return new Date(`${ymd}T12:00:00`); // evita desfases por zona
  };
  const getCliente = (r) => r.cliente || r.clienteNombre || 'Sin nombre';
  const getCorreo  = (r) => (r.correo || '').toLowerCase().trim();

  async function cargar() {
    setLoadingDash(true);
    try {
      // MISMA RUTA QUE USA TU Calendario.jsx
      const data = await fetch(`${API_BASE_URL}/reservas`).then(r => r.json());
      const arr = Array.isArray(data) ? data : [];

      const enMes = arr.filter(r => {
        const f = getFecha(r);
        return f >= iniMes && f <= finMes;
      });

      const futuros = arr
        .filter(r => getFecha(r) >= new Date())
        .sort((a,b) => getFecha(a) - getFecha(b));

      // hoy no tienes montos/pagos; si luego agregas 'total', cámbialo aquí
      const ingresosMes = 0;

      setKpis({
        eventosMes: enMes.length,
        clientesActivos: new Set(enMes.map(getCorreo).filter(Boolean)).size || 0,
        ingresosMes,
        proximosEventos: futuros.length,
      });

        // helper opcional
        const buildPdfUrl = (id) => `${API_BASE_URL}/reservas/${id}/pdf`;

      setActividad(
        futuros.slice(0,5).map(r => ({
          id: r._id,
          titulo: `${r.tipoEvento || 'Evento'} - ${getCliente(r)}`,
          subtitulo: `Programado para el ${getFecha(r).toLocaleDateString()}`,
          icon: obtenerIcono(r.tipoEvento),
          pdfUrl: buildPdfUrl(r._id),
        }))
      );


    } catch (e) {
      console.error('Error cargando reservas para dashboard:', e);
    } finally {
      setLoadingDash(false);
    }
  }

  cargar();
}, [activeSection]);


  const isAdmin = user?.role === 'admin';

  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: '📊' },
    { id: 'clientes', label: 'Clientes', icon: '👥' },
    { id: 'calendario', label: 'Calendario', icon: '📅' },
    { id: 'reportes', label: 'Reportes', icon: '📈' },
    { id: 'inventario', label: 'Inventario', icon: '🏬'},
  ];

  const visibleMenuItems = isAdmin ? menuItems : menuItems;

  /*const formatoMoneda = (n = 0) => {
    try { return `$${Number(n || 0).toLocaleString()}`; } catch { return `$${n}`; }
  };*/

  /*function iconoPorTipo(tipo) {
    const t = (tipo || '').toLowerCase();
    if (t.includes('cumple')) return '🎂';
    if (t.includes('boda')) return '💒';
    if (t.includes('grad')) return '🎓';
    if (t.includes('baut')) return '🕊️';
    return '🎉';
  }*/

  const renderContent = () => {
    switch (activeSection) {
      case 'dashboard':
        return (
          <div className="dashboard-content">
            <div className="dashboard-header">
              <h1>Bienvenido, {user?.fullname || user?.email}</h1>
              <p>Panel de control - Salón de Eventos Nardeli</p>
            </div>

            {/* KPIs dinámicos */}
            <div className="stats-grid">
              <div className="stat-card">
                <div className="stat-icon">🎉</div>
                <div className="stat-info">
                  <h3>Eventos del Mes</h3>
                  <p className="stat-number">{kpis.eventosMes}</p>
                </div>
              </div>

              {/*<div className="stat-card">
                <div className="stat-icon">👥</div>
                <div className="stat-info">
                  <h3>Clientes Activos</h3>
                  <p className="stat-number">{kpis.clientesActivos}</p>
                </div>
              </div>*/}

              {/*<div className="stat-card">
                <div className="stat-icon">💰</div>
                <div className="stat-info">
                  <h3>Ingresos del Mes</h3>
                  <p className="stat-number">{formatoMoneda(kpis.ingresosMes)}</p>
                </div>
              </div>*/}

              <div className="stat-card">
                <div className="stat-icon">📅</div>
                <div className="stat-info">
                  <h3>Próximos Eventos</h3>
                  <p className="stat-number">{kpis.proximosEventos}</p>
                </div>
              </div>
            </div>

            {/* Actividad reciente dinámica */}
            <div className="recent-activity">
              <div className="d-flex align-items-center justify-content-between">
                <h2>Cotizacion pendiente</h2>
                {loadingDash && <span className="text-muted small">Actualizando…</span>}
              </div>

              <div className="activity-list">
                {actividad.length === 0 && (
                  <div className="activity-item">
                    <span className="activity-icon">ℹ️</span>
                    <div className="activity-details">
                      <p><strong>Sin actividad reciente</strong></p>
                      <small>Cuando registres reservas aparecerán aquí.</small>
                    </div>
                  </div>
                )}

                {actividad.map(a => (
                  <div key={a.id} className="activity-item">
                    <span className="activity-icon">{a.icon}</span>
                    <div className="activity-details">
                      <p><strong>{a.titulo}</strong></p>
                      <small>{a.subtitulo}</small>
                      {a.pdfUrl && (
                        <div style={{ marginTop: 6 }}>
                          <a className="btn btn-sm btn-outline-primary"
                            href={a.pdfUrl}
                            target="_blank" rel="noreferrer">Ver PDF</a>
                        </div>  
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
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
            <h1>Reportes y Estadísticas</h1>
            <p>Visualiza reportes detallados del negocio.</p>
          </div>
        );
      case 'inventario':
        return (
          <div className='dashboard-content'>
            <h1>Inventario papu pro</h1>
            <FormProducto />
            <TablaProductos />
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
              onClick={() => setActiveSection(item.id)}
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
          <div className="header-right">
            <div className="user-info" onClick={() => setShowDropdown(!showDropdown)} style={{position: 'relative', cursor: 'pointer'}}>
              <span className="user-avatar">👤</span>
              <span className="user-name">{user?.fullname || user?.email}</span>

              {showDropdown && (
                <div className='dropdown-menu'>
                  <button className='dropdown-item'>Ver perfil</button>
                  <button className='dropdown-item' onClick={onLogout}>Cerrar sesion</button>
                </div>
              )}
            </div>
          </div>
        </header>

        <main className="content-area">
          {renderContent()}
        </main>
      </div>
    </div>
  );
};

export default Dashboard;
