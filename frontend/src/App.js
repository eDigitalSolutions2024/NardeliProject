// src/App.js
import React, { useState } from 'react';
import {
  BrowserRouter as Router,
  Routes,
  Route,
  useNavigate,
  useLocation,
  Navigate
} from 'react-router-dom';

import Home from './components/Home';
import Login from './components/Login';
import Dashboard from './components/Dashboard';
import Reservar from './components/ReservarEvento';
import DashboardCliente from './components/DashboardCliente';
import IngresarCodigo from './pages/IngresarCodigo';
import IngresaCodigoInvitacion from './pages/tmpCodigoInvitacion';
import ScanInvitacionQR from './pages/ScanInvitacionQR';

function AppWrapper() {
  // ✅ Levanta la sesión desde localStorage si existe
  const [user, setUser] = useState(() => {
    try {
      const raw = localStorage.getItem('nardeliUser');
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  });

  const navigate = useNavigate();
  const location = useLocation();

  // 🔐 Guard simple para rutas protegidas
  function RequireAuth({ children }) {
    if (!user) {
      // recuerda a dónde quería ir
      return <Navigate to="/login" replace state={{ from: location }} />;
    }
    return children;
  }

  // ✅ Al iniciar sesión, guarda usuario y redirige
  const handleLoginSuccess = (userData) => {
    // userData debería traer lo mínimo: { _id, nombre, rol, token, ... }
    try {
      localStorage.setItem('nardeliUser', JSON.stringify(userData));
    } catch {}
    setUser(userData);

    const from = location.state?.from?.pathname || '/dashboard';
    navigate(from, { replace: true });
  };

  // (Opcional) por si quieres un botón de salir más adelante
  const handleLogout = () => {
    localStorage.removeItem('nardeliUser');
    setUser(null);
    navigate('/login', { replace: true });
  };

  return (
    <Routes>
      <Route path="/" element={<Home user={user} onLogout={handleLogout} />} />

      <Route path="/login" element={<Login onLoginSuccess={handleLoginSuccess} />} />

      <Route
        path="/dashboard"
        element={
          <RequireAuth>
            <Dashboard user={user} onLogout={handleLogout} />
          </RequireAuth>
        }
      />

      <Route path="/reservar" element={<Reservar />} />

      <Route
        path="/cliente/dashboard"
        element={
          <RequireAuth>
            <DashboardCliente user={user} onLogout={handleLogout} />
          </RequireAuth>
        }
      />

      <Route path="/ingresar-codigo" element={<IngresarCodigo />} />

      <Route path="/invitaciones/:token" element={<IngresaCodigoInvitacion />} />

      <Route path="*" element={<div style={{ padding: 24 }}>404 — Página no encontrada</div>} />

      <Route path="/invitacion-qr/:qrToken" element={<ScanInvitacionQR />} />
    </Routes>
  );
}

function App() {
  return (
    <Router>
      <AppWrapper />
    </Router>
  );
}

export default App;
