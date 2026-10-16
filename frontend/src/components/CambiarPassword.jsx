import React, { useState } from 'react';
import API_BASE_URL from '../api';
import { jsonAuthHeaders } from '../session';
import './Roles.css';

// Pantalla obligatoria en el primer ingreso: la contraseña temporal que generó
// el administrador se cambia por una propia. También sirve como "cambiar contraseña".
export default function CambiarPassword({ user, forzado = true, onChanged, onLogout }) {
  const [actual, setActual] = useState('');
  const [nueva, setNueva] = useState('');
  const [confirmar, setConfirmar] = useState('');
  const [error, setError] = useState('');
  const [guardando, setGuardando] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (nueva.length < 8) return setError('La nueva contraseña debe tener al menos 8 caracteres.');
    if (!/[A-Za-z]/.test(nueva) || !/\d/.test(nueva)) return setError('Debe incluir letras y números.');
    if (nueva !== confirmar) return setError('La confirmación no coincide.');

    setGuardando(true);
    try {
      const res = await fetch(`${API_BASE_URL}/auth/cambiar-password`, {
        method: 'POST',
        headers: jsonAuthHeaders(),
        body: JSON.stringify({ actual, nueva }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) return setError(data.msg || 'No se pudo cambiar la contraseña.');
      onChanged?.(data.token);
    } catch {
      setError('Error de conexión. Intenta de nuevo.');
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className="rl-center">
      <div className="rl-card">
        <h2>{forzado ? 'Crea tu contraseña' : 'Cambiar contraseña'}</h2>
        <p className="rl-hint">
          {forzado
            ? `Hola${user?.fullname ? `, ${user.fullname}` : ''}. Por seguridad debes cambiar la contraseña temporal que te dieron por una propia antes de continuar.`
            : 'Escribe tu contraseña actual y la nueva.'}
        </p>

        {error && <div className="rl-msg err">{error}</div>}

        <form onSubmit={submit}>
          <div className="rl-field">
            <label>{forzado ? 'Contraseña temporal' : 'Contraseña actual'}</label>
            <input type="password" value={actual} onChange={(e) => setActual(e.target.value)} autoComplete="current-password" required autoFocus />
          </div>
          <div className="rl-field">
            <label>Nueva contraseña</label>
            <input type="password" value={nueva} onChange={(e) => setNueva(e.target.value)} autoComplete="new-password" required />
            <small style={{ color: '#6b7280' }}>Mínimo 8 caracteres, con letras y números.</small>
          </div>
          <div className="rl-field">
            <label>Confirmar nueva contraseña</label>
            <input type="password" value={confirmar} onChange={(e) => setConfirmar(e.target.value)} autoComplete="new-password" required />
          </div>
          <button className="rl-btn" style={{ width: '100%' }} disabled={guardando}>
            {guardando ? 'Guardando…' : 'Guardar contraseña'}
          </button>
        </form>

        {onLogout && (
          <button type="button" className="rl-btn sec" style={{ width: '100%', marginTop: 10 }} onClick={onLogout}>
            Cerrar sesión
          </button>
        )}
      </div>
    </div>
  );
}
