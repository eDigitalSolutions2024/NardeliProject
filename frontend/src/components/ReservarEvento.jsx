import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import API_BASE_URL from '../api';
import './Reservar.css';
// ✅ Cuando quieras activar el envío de código, descomenta la línea de abajo:
// import { iniciarAccesoPorCorreo } from '../api/auth';

const ReservarEvento = () => {
  const [formData, setFormData] = useState({
    cliente: '',
    correo: '',
    tipoEvento: '',
    fecha: '',
    horaInicio: '',
    horaFin: '',
    telefono: '',
    cantidadPersonas: '',
    descripcion: '',
    // Nuevo: distinguir cotización / evento
    tipoReserva: 'evento',   // 'evento' | 'cotizacion'
    notaCotizacion: ''
  });

  const [mensaje, setMensaje] = useState('');
  const [enviando, setEnviando] = useState(false);
  const navigate = useNavigate();

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

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMensaje('');
    setEnviando(true);

    const action = e.nativeEvent?.submitter?.dataset?.action || 'dashboard';
    const esEvento = (formData.tipoReserva || 'evento') === 'evento';

    // Abre pre-ventana SOLO para EVENTO (para el dashboard)
    let prewin = null;
    if (action === 'dashboard' && esEvento) {
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

      // Limpiar formulario
      setFormData({
        cliente: '',
        correo: '',
        tipoEvento: '',
        fecha: '',
        horaInicio: '',
        horaFin: '',
        telefono: '',
        cantidadPersonas: '',
        descripcion: '',
        tipoReserva: 'evento',
        notaCotizacion: ''
      });

      // ── EVENTO → abrir dashboard del cliente en la pre-ventana ─────────────────
      if (action === 'dashboard' && esEvento) {
        const url = `/cliente/dashboard?reservaId=${encodeURIComponent(reservaId)}`;
        if (prewin && !prewin.closed) {
          prewin.location.replace(url);
          prewin.focus();
        } else {
          window.open(url, '_blank');
        }
        return;
      }

      // ── COTIZACIÓN → solo confirmar (flujo de OTP deshabilitado) ───────────────
      setMensaje('✅ Cotización guardada correctamente.');
      // ✅ Si más adelante quieres enviar código y redirigir al paso de verificación,
      //    descomenta el bloque siguiente y el import de arriba:
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
