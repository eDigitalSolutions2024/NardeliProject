// Utilidades de sesión compartidas (token, usuario guardado y permisos).
import { authHeaders } from './api';

export const getToken = () => {
  try { return localStorage.getItem('token') || ''; } catch { return ''; }
};

// Usuario guardado al iniciar sesión: { fullname, email, role, id, mustChangePassword, permisos }
export function getStoredUser() {
  try {
    const raw = localStorage.getItem('nardeliUser') || localStorage.getItem('user');
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

// Mezcla cambios en el usuario guardado (en las dos llaves que usa la app).
export function updateStoredUser(patch) {
  try {
    const actual = getStoredUser() || {};
    const nuevo = { ...actual, ...patch };
    localStorage.setItem('nardeliUser', JSON.stringify(nuevo));
    localStorage.setItem('user', JSON.stringify(nuevo));
    return nuevo;
  } catch {
    return null;
  }
}

export const jsonAuthHeaders = () => ({ 'Content-Type': 'application/json', ...authHeaders() });

// A dónde mandar a cada rol después de iniciar sesión.
export function rutaInicialPorRol(user) {
  if (user?.mustChangePassword) return '/cambiar-password';
  if (user?.role === 'cotizador') return '/cotizador';
  return '/dashboard';
}
