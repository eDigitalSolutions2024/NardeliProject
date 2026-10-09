import React, { useState } from 'react';
import axios from 'axios';
import './FormProducto.css';
import API_BASE_URL, { authHeaders } from '../api';

const FormProducto = ({ onProductoAgregado = () => {} }) => {
  const [formData, setFormData] = useState({
    nombre: '',
    categoria: '',
    cantidad: '',
    precio: '',
    descripcion: '',
    imagen: ''
  });

  const [mensaje, setMensaje] = useState('');
  const [enviando, setEnviando] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: name === 'cantidad' || name === 'precio' ? Number(value) : value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMensaje('');
    setEnviando(true);

    try {
      const dataToSend = new FormData();
      dataToSend.append('nombre', formData.nombre);
      dataToSend.append('categoria', formData.categoria);
      dataToSend.append('cantidad', formData.cantidad);
      dataToSend.append('precio', formData.precio);
      dataToSend.append('descripcion', formData.descripcion);
      if (formData.imagen) {
        dataToSend.append('imagen', formData.imagen);
      }

      await axios.post(`${API_BASE_URL}/productos`, dataToSend, {
        headers: { 'Content-Type': 'multipart/form-data', ...authHeaders() }
      });

      setMensaje('ok:Producto agregado correctamente');
      setFormData({
        nombre: '',
        categoria: '',
        cantidad: '',
        precio: '',
        descripcion: '',
        imagen: ''
      });
    } catch (error) {
      console.error(error);
      setMensaje('error:No se pudo agregar el producto');
    } finally {
      setEnviando(false);
    }
  };

  const [tipo, texto] = mensaje.includes(':') ? mensaje.split(':') : ['', mensaje];

  return (
    <div className="fp-card">
      <div className="fp-header">
        <div className="fp-header-icon" aria-hidden="true">📦</div>
        <div>
          <h2>Registrar nuevo producto</h2>
          <p className="fp-subtitle">Agrega un artículo al inventario de Nardéli</p>
        </div>
      </div>

      {texto && (
        <div className={`fp-alert ${tipo === 'ok' ? 'fp-alert-ok' : 'fp-alert-error'}`}>
          {tipo === 'ok' ? '✓' : '⚠'} {texto}
        </div>
      )}

      <form onSubmit={handleSubmit} className="fp-form">
        <div className="fp-grid">
          <div className="fp-field">
            <label htmlFor="fp-nombre">Nombre del producto</label>
            <input
              id="fp-nombre"
              name="nombre"
              placeholder="Ej. Silla Tiffany"
              value={formData.nombre}
              onChange={handleChange}
              required
            />
          </div>

          <div className="fp-field">
            <label htmlFor="fp-categoria">Categoría</label>
            <input
              id="fp-categoria"
              name="categoria"
              placeholder="Ej. Mobiliario"
              value={formData.categoria}
              onChange={handleChange}
              required
            />
          </div>

          <div className="fp-field">
            <label htmlFor="fp-cantidad">Cantidad</label>
            <input
              id="fp-cantidad"
              name="cantidad"
              type="number"
              min="0"
              placeholder="0"
              value={formData.cantidad}
              onChange={handleChange}
              required
            />
          </div>

          <div className="fp-field">
            <label htmlFor="fp-precio">Precio</label>
            <div className="fp-price-input">
              <span>$</span>
              <input
                id="fp-precio"
                name="precio"
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                value={formData.precio}
                onChange={handleChange}
                required
              />
            </div>
          </div>
        </div>

        <div className="fp-field">
          <label htmlFor="fp-descripcion">Descripción</label>
          <textarea
            id="fp-descripcion"
            name="descripcion"
            placeholder="Detalles del producto..."
            value={formData.descripcion}
            onChange={handleChange}
            rows={3}
          />
        </div>

        <div className="fp-field">
          <label>Imagen</label>
          <label htmlFor="fp-imagen" className="fp-file-drop">
            <span className="fp-file-icon" aria-hidden="true">🖼️</span>
            <span className="fp-file-text">
              {formData.imagen ? formData.imagen.name : 'Elige una imagen (opcional)'}
            </span>
          </label>
          <input
            id="fp-imagen"
            type="file"
            accept="image/*"
            className="fp-file-input-hidden"
            onChange={(e) => setFormData({ ...formData, imagen: e.target.files[0] })}
          />
        </div>

        <button type="submit" className="fp-submit" disabled={enviando}>
          {enviando ? 'Guardando…' : '+ Agregar producto'}
        </button>
      </form>
    </div>
  );
};

export default FormProducto;
