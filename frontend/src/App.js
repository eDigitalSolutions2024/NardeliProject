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
      {/* 🏠 Página pública de inicio */}
      <Route path="/" element={<Home user={user} onLogout={handleLogout} />} />

      {/* 🔑 Login habilitado nuevamente */}
      <Route path="/login" element={<Login onLoginSuccess={handleLoginSuccess} />} />

      {/* 📊 Dashboard protegido */}
      <Route
        path="/dashboard"
        element={
          <RequireAuth>
            <Dashboard user={user} onLogout={handleLogout} />
          </RequireAuth>
        }
      />

      {/* 🎉 Reservar (déjala pública si así lo quieres) */}
      <Route path="/reservar" element={<Reservar />} />

      {/* 👤 Dashboard del cliente (protegido) */}
      <Route
        path="/cliente/dashboard"
        element={
          <RequireAuth>
            <DashboardCliente user={user} onLogout={handleLogout} />
          </RequireAuth>
        }
      />

      {/* ✅ Página para códigos (pública) */}
      <Route path="/ingresar-codigo" element={<IngresarCodigo />} />

      {/* 404 */}
      <Route path="*" element={<div style={{ padding: 24 }}>404 — Página no encontrada</div>} />
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
