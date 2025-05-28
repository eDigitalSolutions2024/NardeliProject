import React, { useState } from 'react';
import './Dashboard.css';

const Dashboard = ({ user, onLogout }) => {
  const [activeSection, setActiveSection] = useState('dashboard');

  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: '📊' },
    { id: 'eventos', label: 'Eventos', icon: '🎉' },
    { id: 'clientes', label: 'Clientes', icon: '👥' },
    { id: 'calendario', label: 'Calendario', icon: '📅' },
    { id: 'reportes', label: 'Reportes', icon: '📈' },
    { id: 'configuracion', label: 'Configuración', icon: '⚙️' }
  ];

  const renderContent = () => {
    switch (activeSection) {
      case 'dashboard':
        return (
          <div className="dashboard-content">
            <div className="dashboard-header">
              <h1>Bienvenido, {user?.fullname || user?.email}</h1>
              <p>Panel de control - Salón de Eventos Nardeli</p>
            </div>
            
            <div className="stats-grid">
              <div className="stat-card">
                <div className="stat-icon">🎉</div>
                <div className="stat-info">
                  <h3>Eventos del Mes</h3>
                  <p className="stat-number">12</p>
                </div>
              </div>
              
              <div className="stat-card">
                <div className="stat-icon">👥</div>
                <div className="stat-info">
                  <h3>Clientes Activos</h3>
                  <p className="stat-number">48</p>
                </div>
              </div>
              
              <div className="stat-card">
                <div className="stat-icon">💰</div>
                <div className="stat-info">
                  <h3>Ingresos del Mes</h3>
                  <p className="stat-number">$25,000</p>
                </div>
              </div>
              
              <div className="stat-card">
                <div className="stat-icon">📅</div>
                <div className="stat-info">
                  <h3>Próximos Eventos</h3>
                  <p className="stat-number">5</p>
                </div>
              </div>
            </div>

            <div className="recent-activity">
              <h2>Actividad Reciente</h2>
              <div className="activity-list">
                <div className="activity-item">
                  <span className="activity-icon">🎂</span>
                  <div className="activity-details">
                    <p><strong>Evento de Cumpleaños</strong> - María González</p>
                    <small>Programado para el 30 de Mayo</small>
                  </div>
                </div>
                
                <div className="activity-item">
                  <span className="activity-icon">💒</span>
                  <div className="activity-details">
                    <p><strong>Boda</strong> - Carlos y Ana</p>
                    <small>Programado para el 15 de Junio</small>
                  </div>
                </div>
                
                <div className="activity-item">
                  <span className="activity-icon">🎓</span>
                  <div className="activity-details">
                    <p><strong>Graduación</strong> - Universidad Local</p>
                    <small>Programado para el 20 de Junio</small>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      case 'eventos':
        return (
          <div className="dashboard-content">
            <h1>Gestión de Eventos</h1>
            <p>Aquí puedes administrar todos los eventos del salón.</p>
          </div>
        );
      case 'clientes':
        return (
          <div className="dashboard-content">
            <h1>Gestión de Clientes</h1>
            <p>Administra la información de tus clientes.</p>
          </div>
        );
      case 'calendario':
        return (
          <div className="dashboard-content">
            <h1>Calendario de Eventos</h1>
            <p>Vista de calendario con todos los eventos programados.</p>
          </div>
        );
      case 'reportes':
        return (
          <div className="dashboard-content">
            <h1>Reportes y Estadísticas</h1>
            <p>Visualiza reportes detallados del negocio.</p>
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
      <div className="sidebar">
        <div className="sidebar-header">
          <h2 className="sidebar-brand">Nardeli</h2>
          <p className="sidebar-subtitle">Salón de Eventos</p>
        </div>
        
        <nav className="sidebar-nav">
          {menuItems.map(item => (
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
            <div className="user-info">
              <span className="user-avatar">👤</span>
              <span className="user-name">{user?.fullname || user?.email}</span>
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