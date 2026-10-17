// src/App.js
import React, { useState, lazy, Suspense } from 'react';
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
import IngresarCodigo from './pages/IngresarCodigo';
import { Toaster } from 'sonner';
import CambiarPassword from './components/CambiarPassword';
import { updateStoredUser, rutaInicialPorRol } from './session';

const Dashboard = lazy(() => import('./components/Dashboard'));
const Reservar = lazy(() => import('./components/ReservarEvento'));
const DashboardCliente = lazy(() => import('./components/DashboardCliente'));
const IngresaCodigoInvitacion = lazy(() => import('./pages/tmpCodigoInvitacion'));
const ScanInvitacionQR = lazy(() => import('./pages/ScanInvitacionQR'));
const Cotizador = lazy(() => import('./components/Cotizador'));

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
  // - Sin sesión → /login.
  // - Con contraseña temporal → solo puede estar en /cambiar-password.
  // - `roles`: si se indica, los demás roles se mandan a su pantalla de inicio.
  function RequireAuth({ children, roles }) {
    if (!user) {
      // recuerda a dónde quería ir
      return <Navigate to="/login" replace state={{ from: location }} />;
    }
    if (user.mustChangePassword) {
      return <Navigate to="/cambiar-password" replace />;
    }
    if (roles && !roles.includes(user.role)) {
      return <Navigate to={rutaInicialPorRol(user)} replace />;
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

    const inicio = rutaInicialPorRol(userData);
    const from = location.state?.from?.pathname;
    // Un cotizador o quien debe cambiar contraseña NO regresa a una ruta previa de staff.
    navigate(inicio === '/dashboard' && from ? from : inicio, { replace: true });
  };

  // El usuario ya cambió su contraseña temporal: guarda el token nuevo y entra.
  const handlePasswordChanged = (newToken) => {
    try { localStorage.setItem('token', newToken || ''); } catch {}
    const nuevo = updateStoredUser({ mustChangePassword: false });
    setUser(nuevo);
    navigate(rutaInicialPorRol(nuevo), { replace: true });
  };

  // (Opcional) por si quieres un botón de salir más adelante
  const handleLogout = () => {
    localStorage.removeItem('nardeliUser');
    setUser(null);
    navigate('/login', { replace: true });
  };

  return (
    <Suspense fallback={<div className="sk-carga" role="status" aria-label="Cargando"><span className="sk sk-titulo" /><span className="sk sk-fila" /><span className="sk sk-fila" /><span className="sk sk-fila corta" /></div>}>
    <Routes>
      <Route path="/" element={<Home user={user} onLogout={handleLogout} />} />

      <Route path="/login" element={<Login onLoginSuccess={handleLoginSuccess} />} />

      <Route
        path="/cambiar-password"
        element={
          user
            ? <CambiarPassword user={user} forzado={!!user.mustChangePassword} onChanged={handlePasswordChanged} onLogout={handleLogout} />
            : <Navigate to="/login" replace />
        }
      />

      <Route
        path="/dashboard"
        element={
          <RequireAuth roles={['admin', 'asistente', 'user']}>
            <Dashboard user={user} onLogout={handleLogout} />
          </RequireAuth>
        }
      />

      <Route
        path="/cotizador"
        element={
          <RequireAuth roles={['cotizador']}>
            <Cotizador user={user} onLogout={handleLogout} />
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
    </Suspense>
  );
}

function App() {
  return (
    <Router>
      <AppWrapper />
      <Toaster position="top-right" richColors closeButton duration={4200} />
    </Router>
  );
}

export default App;
