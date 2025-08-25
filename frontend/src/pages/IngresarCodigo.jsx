// pages/IngresarCodigo.jsx
import { useEffect, useState } from 'react';
import API_BASE_URL from '../api';

export default function IngresarCodigo() {
  const [correo, setCorreo] = useState('');
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const emailParam = p.get('email') || '';
    setCorreo(emailParam);
  }, []);

  async function onSubmit(e) {
    e.preventDefault();
    setLoading(true);
    try {
      const resp = await fetch(`${API_BASE_URL}/auth/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ correo: correo.trim().toLowerCase(), code: code.trim() }),
      });
      const data = await resp.json();
      if (!resp.ok || !data.ok) throw new Error(data.msg || 'Código inválido');

      localStorage.setItem('token', data.token);
      
      const next = data.reservaId
      ? `/cliente/dashboard?reservaId=${encodeURIComponent(data.reservaId)}`
      : '/cliente/dashboard';
     window.location.href = next;
    } catch (err) {
      alert(err.message || 'Error verificando código');
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} style={{ maxWidth: 360, margin: '40px auto' }}>
      <h2>Ingresa tu código</h2>
      <label>Correo</label>
      <input type="email" value={correo} onChange={e => setCorreo(e.target.value)} required />
      <label>Código</label>
      <input type="text" inputMode="numeric" maxLength={6} value={code} onChange={e => setCode(e.target.value)} required />
      <button disabled={loading}>{loading ? 'Verificando…' : 'Continuar'}</button>
    </form>
  );
}
