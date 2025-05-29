import React, { useState } from 'react';
import './Reservar.css';

const Reservar = () => {
  const [formData, setFormData] = useState({
    nombre: '',
    correo: '',
    fecha: '',
    tipoEvento: '',
    invitados: '',
    mensaje: '',
  });

  const handleChange = e => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = e => {
    e.preventDefault();
    console.log('Datos enviados:', formData);
    alert('Solicitud enviada. Nos pondremos en contacto contigo pronto.');
  };

  return (
    <div className="reservar-container">
      <h1>Reservar un Evento</h1>
      <form className="reservar-form" onSubmit={handleSubmit}>
        <input type="text" name="nombre" placeholder="Nombre completo" value={formData.nombre} onChange={handleChange} required />
        <input type="email" name="correo" placeholder="Correo electrónico" value={formData.correo} onChange={handleChange} required />
        <input type="date" name="fecha" value={formData.fecha} onChange={handleChange} required />
        <select name="tipoEvento" value={formData.tipoEvento} onChange={handleChange} required>
          <option value="">Selecciona tipo de evento</option>
          <option value="cumpleaños">Cumpleaños</option>
          <option value="boda">Boda</option>
          <option value="graduación">Graduación</option>
          <option value="otro">Otro</option>
        </select>
        <input type="number" name="invitados" placeholder="Número de invitados" value={formData.invitados} onChange={handleChange} required />
        <textarea name="mensaje" placeholder="Mensaje adicional (opcional)" value={formData.mensaje} onChange={handleChange}></textarea>
        <button type="submit">Enviar solicitud</button>
      </form>
    </div>
  );
};

export default Reservar;
