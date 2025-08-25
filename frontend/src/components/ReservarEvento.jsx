import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import API_BASE_URL from '../api';
import './Reservar.css';
import { iniciarAccesoPorCorreo } from '../api/auth';

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
    descripcion: ''
  });

  const [mensaje, setMensaje] = useState('');
  const [enviando, setEnviando] = useState(false);
  const navigate = useNavigate();

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (mensaje) setMensaje('');
  };

  

const handleSubmit = async (e) => {
  e.preventDefault();
  setMensaje('');
  setEnviando(true);

  const action = e.nativeEvent?.submitter?.dataset?.action || 'dashboard';

  // Abrimos la pestaña antes del await (evita bloqueos)
  let prewin = null;
  if (action === 'dashboard') {
    prewin = window.open('about:blank', '_blank'); // sin noopener para poder asignar location
  }

  try {
    // normalizamos payload
    const payload = {
      cliente: formData.cliente.trim(),
      correo: (formData.correo || '').trim().toLowerCase(),
      tipoEvento: formData.tipoEvento.trim(),
      fecha: formData.fecha,                 // "YYYY-MM-DD"
      horaInicio: formData.horaInicio,       // "HH:mm"
      horaFin: formData.horaFin,             // "HH:mm"
      telefono: formData.telefono.trim(),
      cantidadPersonas: Number(formData.cantidadPersonas || 0),
      descripcion: formData.descripcion?.trim() || ''
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
      if (prewin) prewin.close(); // cerramos la pestaña en blanco si hubo error
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

    // ✅ limpiar el formulario al crear la reserva
    setFormData({
      cliente: '',
      correo: '',
      tipoEvento: '',
      fecha: '',
      horaInicio: '',
      horaFin: '',
      telefono: '',
      cantidadPersonas: '',
      descripcion: ''
    });

    if (action === 'dashboard') {
      const url = `/cliente/dashboard?reservaId=${encodeURIComponent(reservaId)}`;

      // Redirige la MISMA pestaña que abrimos; no se abre otra
      if (prewin && !prewin.closed) {
        prewin.location.replace(url);
        prewin.focus();
      } else {
        // si el navegador bloqueó la prewin, abrimos una sola vez ahora
        window.open(url, '_blank');
      }
      return;
    }

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

    // 🔹 Redirigir a la página para ingresar el código (misma pestaña)
    navigate(`/ingresar-codigo?email=${encodeURIComponent(payload.correo)}&reservaId=${encodeURIComponent(reservaId)}`);

  } catch (error) {
    console.error('Error al guardar:', error);
    setMensaje('❌ Error de conexión');
    if (prewin) prewin.close();
  } finally {
    setEnviando(false);
  }
};



  

  return (
    <div className="reserva-form-container">
      <h2>Reservar Evento</h2>

      <form onSubmit={handleSubmit}>
        <input name="cliente" type="text" placeholder="Nombre del cliente " value={formData.cliente} onChange={handleChange} required />
        <input name="correo" type="email" placeholder="Correo electrónico" value={formData.correo} onChange={handleChange} required />
        <input name="tipoEvento" type="text" placeholder="Tipo de evento" value={formData.tipoEvento} onChange={handleChange} required />
        <input name="telefono" type="tel" placeholder="Número de teléfono" value={formData.telefono} onChange={handleChange} required />
        <input name="cantidadPersonas" type="number" min="1" placeholder="Cantidad de personas" value={formData.cantidadPersonas} onChange={handleChange} required />
        <input name="fecha" type="date" value={formData.fecha} onChange={handleChange} required />
        <input name="horaInicio" type="time" value={formData.horaInicio} onChange={handleChange} required />
        <input name="horaFin" type="time" value={formData.horaFin} onChange={handleChange} required />
        <textarea name="descripcion" placeholder="Observaciones" value={formData.descripcion} onChange={handleChange} />
        {/*<button type="submit" data-action="codigo" disabled={enviando}>{enviando ? 'Guardando…' : 'Solicitar reserva'}</button>*/}
        <button type="submit"  data-action="dashboard" disabled={enviando}>{enviando ? 'Guardando…' : 'Reservar'}</button>
      </form>
      {mensaje && <p>{mensaje}</p>}
      {/*<button className="home-button" onClick={() => navigate('/cliente/dashboard')} type="button"> Ver dashboard del cliente por mientras </button>*/}
    </div>
  );
};

export default ReservarEvento;
