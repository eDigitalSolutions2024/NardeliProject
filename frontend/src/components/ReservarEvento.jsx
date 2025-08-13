import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import API_BASE_URL from '../api';
import './Reservar.css'; // (opcional para estilos personalizados)

const ReservarEvento = () => {
  const [formData, setFormData] = useState({
    cliente: '',
    tipoEvento: '',
    fecha: '',
    horaInicio: '',
    horaFin: '',
    telefono: '',
    cantidadPersonas: '',
    descripcion: ''
  });

  const [mensaje, setMensaje] = useState('');

  const navigate = useNavigate();

  const handleChange = (e) => {
    setFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMensaje('');

    try {
      const response = await fetch(`${API_BASE_URL}/reservas`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      });


      if (response.ok) {
        setMensaje('✅ Reserva creada con éxito. Nos pondremos en contacto para confirmar tu evento.');

        setFormData({
          cliente: '',
          tipoEvento: '',
          fecha: '',
          horaInicio: '',
          horaFin: '',
          telefono: '',
          cantidadPersonas: '',
          descripcion: ''
        });

        // Redirige después de 3 segundos
        setTimeout(() => {
          navigate('/');
        }, 3000);
      }
    } catch (error) {
      console.error('Error al guardar:', error);
      setMensaje('❌ Error de conexión');
    }
  };

  return (
    <div className="reserva-form-container">
      <h2>Reservar Evento</h2>
      <form onSubmit={handleSubmit}>
        <input name="cliente" type="text" placeholder="Nombre del cliente" value={formData.cliente} onChange={handleChange} required />
        <input name="correo" type="text" placeholder="Correo electronico" value={formData.correo} onChange={handleChange} required />
        <input name="tipoEvento" type="text" placeholder="Tipo de evento" value={formData.tipoEvento} onChange={handleChange} required />
        <input name="telefono" type="number" placeholder="Numero de telefono" value={formData.telefono} onChange={handleChange} required />
        <input name="cantidadPersonas" type="number" placeholder="Cantidad de personas" value={formData.cantidadPersonas} onChange={handleChange} />
        <input name="fecha" type="date" value={formData.fecha} onChange={handleChange} required />
        <input name="horaInicio" type="time" value={formData.horaInicio} onChange={handleChange} required />
        <input name="horaFin" type="time" value={formData.horaFin} onChange={handleChange} required />
        <textarea name="descripcion" placeholder="Observaciones" value={formData.descripcion} onChange={handleChange} />
        <button type="submit">Guardar reserva</button>
      </form>
      {mensaje && <p>{mensaje}</p>}
    </div>
  );
};

export default ReservarEvento;
