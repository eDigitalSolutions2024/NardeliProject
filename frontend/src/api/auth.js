// usa la misma constante que ya usas en ReservarEvento
import API_BASE_URL from '../api';

export async function iniciarAccesoPorCorreo({ correo, nombre, telefono }) {
  const resp = await fetch(`${API_BASE_URL}/auth/start`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ correo, nombre, telefono }),
  });
  const data = await resp.json().catch(() => ({}));
  if (!resp.ok || !data.ok) {
    throw new Error(data.msg || `Fallo /auth/start (${resp.status})`);
  }
  return data; // { ok:true, msg:'...' }
}
