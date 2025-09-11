import React, { useState } from 'react';
import axios from 'axios';
import './FormProducto.css';           // 👈 reutilizamos los mismos estilos
import API_BASE_URL from '../api';

const FormAccesorio = ({ onAccesorioAgregado = () => {} }) => {
  const [formData, setFormData] = useState({
    nombre: '',
    categoria: '',
    cantidad: '',
    precioReposicion: '',
    descripcion: '',
    imagen: null,
    activo: true,
    esPrestamo: true,
  });

  const [mensaje, setMensaje] = useState('');

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    if (type === 'checkbox') {
      setFormData(prev => ({ ...prev, [name]: checked }));
    } else {
      setFormData(prev => ({
        ...prev,
        [name]:
          name === 'cantidad' || name === 'precioReposicion'
            ? Number(value)
            : value
      }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMensaje('');

    try {
      const dataToSend = new FormData();
      dataToSend.append('nombre', formData.nombre);
      dataToSend.append('categoria', formData.categoria || 'Accesorio');
      dataToSend.append('stock', formData.cantidad || 0);        // 👈 backend: stock
      dataToSend.append('precioReposicion', formData.precioReposicion || 0);
      dataToSend.append('descripcion', formData.descripcion || '');
      dataToSend.append('unidad', 'pza');
      dataToSend.append('activo', String(!!formData.activo));
      dataToSend.append('esPrestamo', String(!!formData.esPrestamo));
      if (formData.imagen) dataToSend.append('imagen', formData.imagen);

      await axios.post(`${API_BASE_URL}/accesorios`, dataToSend, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      setMensaje('✅ Accesorio agregado correctamente');
      setFormData({
        nombre: '',
        categoria: '',
        cantidad: '',
        precioReposicion: '',
        descripcion: '',
        imagen: null,
        activo: true,
        esPrestamo: true,
      });
      onAccesorioAgregado?.();
    } catch (error) {
      console.error(error);
      setMensaje('❌ Error al agregar el accesorio');
    }
  };

  return (
    <div className="form-producto-container">
      <h2>Registrar nuevo accesorio</h2>
      {mensaje && <p>{mensaje}</p>}

      <form onSubmit={handleSubmit}>
        <label htmlFor="nombre">Nombre del accesorio:</label>
        <input
          name="nombre"
          placeholder="Nombre"
          value={formData.nombre}
          onChange={handleChange}
          required
        />

        <label htmlFor="categoria">Categoria:</label>
        <input
          name="categoria"
          placeholder="Categoría"
          value={formData.categoria}
          onChange={handleChange}
        />

        <label htmlFor="cantidad">Cantidad:</label>
        <input
          name="cantidad"
          type="number"
          placeholder="Cantidad"
          value={formData.cantidad}
          onChange={handleChange}
          required
        />

        <label htmlFor="precioReposicion">Precio de reposición (opcional):</label>
        <input
          name="precioReposicion"
          type="number"
          step="0.01"
          placeholder="0"
          value={formData.precioReposicion}
          onChange={handleChange}
        />

        <label htmlFor="descripcion">Descripción:</label>
        <textarea
          name="descripcion"
          placeholder="Descripción"
          value={formData.descripcion}
          onChange={handleChange}
        />

        <label htmlFor="imagen">Imagen:</label>
        <input
          id="imagen"
          type="file"
          accept="image/*"
          onChange={(e) =>
            setFormData({ ...formData, imagen: e.target.files?.[0] || null })
          }
        />

        <div style={{ display: 'flex', gap: 16, marginTop: 8 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input
              type="checkbox"
              name="activo"
              checked={formData.activo}
              onChange={handleChange}
            />
            Activo
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input
              type="checkbox"
              name="esPrestamo"
              checked={formData.esPrestamo}
              onChange={handleChange}
            />
            Es préstamo (se cobra $0)
          </label>
        </div>

        <button type="submit">Agregar accesorio</button>
      </form>
    </div>
  );
};

export default FormAccesorio;
