import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import API_BASE_URL from '../api';
import './Reservar.css';

const BORRADOR_KEY = 'nardeli_reserva_borrador';

const camposSignificativos = ['cliente', 'correo', 'tipoEvento', 'fecha', 'telefono', 'cantidadPersonas', 'descripcion', 'notaCotizacion'];
const tieneContenido = (data) => camposSignificativos.some(k => String(data[k] || '').trim() !== '');

const formInicial = {
  cliente: '',
  correo: '',
  tipoEvento: '',
  fecha: '',
  horaInicio: '',
  horaFin: '',
  telefono: '',
  cantidadPersonas: '',
  descripcion: '',
  tipoReserva: 'cotizacion',
  notaCotizacion: ''
};
// ✅ Cuando quieras activar el envío de código, descomenta la línea de abajo:
// import { iniciarAccesoPorCorreo } from '../api/auth';

const ReservarEvento = () => {
  const [formData, setFormData] = useState(() => {
    try {
      const guardado = localStorage.getItem(BORRADOR_KEY);
      return guardado ? { ...formInicial, ...JSON.parse(guardado) } : formInicial;
    } catch {
      return formInicial;
    }
  });

  const [tieneBorrador, setTieneBorrador] = useState(() => {
    try {
      const guardado = localStorage.getItem(BORRADOR_KEY);
      return guardado ? tieneContenido(JSON.parse(guardado)) : false;
    } catch { return false; }
  });
  const [mensaje, setMensaje] = useState('');
  const [enviando, setEnviando] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (tieneContenido(formData)) {
      localStorage.setItem(BORRADOR_KEY, JSON.stringify(formData));
      setTieneBorrador(true);
    } else {
      localStorage.removeItem(BORRADOR_KEY);
      setTieneBorrador(false);
    }
  }, [formData]);

  const limpiarBorrador = () => {
    localStorage.removeItem(BORRADOR_KEY);
    setFormData(formInicial);
    setTieneBorrador(false);
    setMensaje('');
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;

    // Toggle del checkbox “¿Es cotización?”
    if (name === 'esCotizacion' && type === 'checkbox') {
      setFormData(prev => ({ ...prev, tipoReserva: checked ? 'cotizacion' : 'evento' }));
      if (mensaje) setMensaje('');
      return;
    }

    setFormData(prev => ({ ...prev, [name]: value }));
    if (mensaje) setMensaje('');
  };

  // Lee el token del localStorage y extrae el role del payload (sin verificar firma)
function getSessionRole() {
  try {
    const t = localStorage.getItem('token');
    if (!t) return null;
    const [, payloadB64] = t.split('.');
    if (!payloadB64) return null;
    const json = JSON.parse(atob(payloadB64));
    // según cómo firmes el JWT, intenta en estas rutas:
    return json.role || json.rol || json?.user?.role || null;
  } catch {
    return null;
  }
}

// Deriva el "mode" para el dashboard en función del rol
function getDashboardModeFromRole(role) {
  const r = String(role || '').toLowerCase();
  return (r === 'admin' || r === 'asistente') ? 'admin' : 'user';
}


  const handleSubmit = async (e) => {
    e.preventDefault();
    setMensaje('');
    setEnviando(true);

    const action = e.nativeEvent?.submitter?.dataset?.action || 'dashboard';
    const esEvento = (formData.tipoReserva || 'evento') === 'evento';

    // Abre pre-ventana SOLO para EVENTO (para el dashboard)
    let prewin = null;
    if (action === 'dashboard') {
      prewin = window.open('about:blank', '_blank');
    }

    try {
      const payload = {
        cliente: formData.cliente.trim(),
        correo: (formData.correo || '').trim().toLowerCase(),
        tipoEvento: formData.tipoEvento.trim(),
        fecha: formData.fecha,                 // "YYYY-MM-DD"
        horaInicio: formData.horaInicio,       // "HH:mm"
        horaFin: formData.horaFin,             // "HH:mm"
        telefono: formData.telefono.trim(),
        cantidadPersonas: Number(formData.cantidadPersonas || 0),
        descripcion: formData.descripcion?.trim() || '',
        tipoReserva: formData.tipoReserva,
        notaCotizacion: formData.tipoReserva === 'cotizacion'
          ? (formData.notaCotizacion || '').trim()
          : ''
      };

      const response = await fetch(`${API_BASE_URL}/reservas`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        if (response.status === 409) {
          setMensaje(err.msg || 'El horario se empalma con otra reserva.');
        } else {
          setMensaje(err.msg || 'No se pudo crear la reserva.');
        }
        if (prewin) prewin.close();
        return;
      }

      const data = await response.json();
      const reservaId = data?.id || data?.reserva?._id || data?._id;

      if (!reservaId) {
        console.warn('Respuesta sin ID de reserva:', data);
        setMensaje('Reserva creada, pero no se recibió el ID.');
        if (prewin) prewin.close();
        return;
      }

      // Limpiar formulario y borrador
      localStorage.removeItem(BORRADOR_KEY);
      setFormData(formInicial);
      setTieneBorrador(false);

// ── Ir al dashboard (evento o cotización) con modo por rol ───────────────
      if (action === 'dashboard') {
        const role = getSessionRole();
        const mode = getDashboardModeFromRole(role);
        const params = new URLSearchParams({
          reservaId: String(reservaId),
          mode,
          tipo: esEvento ? 'evento' : 'cotizacion'
        }).toString();
        const url = `/cliente/dashboard?${params}`;
        if (prewin && !prewin.closed) {
          prewin.location.replace(url);
          prewin.focus();
        } else {
          window.open(url, '_blank');
        }
        return;
      }

      // Si no se pidió dashboard, deja el mensaje informativo
      setMensaje(esEvento
        ? '✅ Evento creado correctamente.'
        : '✅ Cotización guardada correctamente.'
      );
      /*
      try {
        const r = await iniciarAccesoPorCorreo({
          correo: payload.correo,
          nombre: payload.cliente,
          telefono: payload.telefono,
        });
        console.log('auth/start =>', r);
        setMensaje('Te enviamos un código a tu correo para ingresar.');
      } catch (err) {
        console.error('auth/start error =>', err);
        setMensaje(err.message || 'No se pudo enviar el código. Puedes reintentar más tarde.');
      }
      navigate(`/ingresar-codigo?email=${encodeURIComponent(payload.correo)}&reservaId=${encodeURIComponent(reservaId)}`);
      */
      return;

    } catch (error) {
      console.error('Error al guardar:', error);
      setMensaje('❌ Error de conexión');
      if (prewin) prewin.close();
    } finally {
      setEnviando(false);
    }
  };

  const esCotizacion = formData.tipoReserva === 'cotizacion';

  return (
    <div className="reserva-form-container">
      <h2>Reservar Evento</h2>

      {tieneBorrador && (
        <div style={{
          background: '#fff8e1',
          border: '1px solid #f0a500',
          borderRadius: 8,
          padding: '8px 14px',
          marginBottom: 12,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          fontSize: 13,
        }}>
          <span>📋 Tienes datos guardados de un formulario anterior.</span>
          <button
            type="button"
            onClick={limpiarBorrador}
            style={{
              background: 'none',
              border: 'none',
              color: '#c0392b',
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: 13,
            }}
          >
            Limpiar ✕
          </button>
        </div>
      )}

      <form onSubmit={handleSubmit}>
        {/* Toggle cotización/evento */}
        <label style={{ display:'flex', alignItems:'center', gap:8, marginBottom:12 }}>
          <input
            type="checkbox"
            name="esCotizacion"
            checked={esCotizacion}
            onChange={handleChange}
          />
          ¿Es cotización? <small style={{opacity:.7}}>
            {esCotizacion ? '(se guardará como Cotización)' : '(se guardará como Evento)'}
          </small>
        </label>

        {/* Nota solo para cotización */}
        {esCotizacion && (
          <textarea
            name="notaCotizacion"
            placeholder="Notas de la cotización (opcional)"
            value={formData.notaCotizacion}
            onChange={handleChange}
            style={{ width:'100%', marginBottom:12 }}
          />
        )}

        <input name="cliente" type="text" placeholder="Nombre del cliente " value={formData.cliente} onChange={handleChange} required />
        <input name="correo" type="email" placeholder="Correo electrónico" value={formData.correo} onChange={handleChange} required />
        <input name="tipoEvento" type="text" placeholder="Tipo de evento" value={formData.tipoEvento} onChange={handleChange} required />
        <input name="telefono" type="tel" placeholder="Número de teléfono" value={formData.telefono} onChange={handleChange} required />
        <input name="cantidadPersonas" type="number" min="1" placeholder="Cantidad de personas" value={formData.cantidadPersonas} onChange={handleChange} required />
        <input name="fecha" type="date" value={formData.fecha} onChange={handleChange} required />
        <input name="horaInicio" type="time" value={formData.horaInicio} onChange={handleChange} required />
        <input name="horaFin" type="time" value={formData.horaFin} onChange={handleChange} required />
        <textarea name="descripcion" placeholder="Observaciones" value={formData.descripcion} onChange={handleChange} />

        <button type="submit" data-action="dashboard" disabled={enviando}>
          {enviando ? 'Guardando…' : (esCotizacion ? 'Guardar cotización' : 'Reservar')}
        </button>
      </form>

      {mensaje && <p>{mensaje}</p>}
    </div>
  );
};

export default ReservarEvento;
