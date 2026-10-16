import { LuPackage, LuGift, LuImage, LuCheck, LuTriangleAlert } from 'react-icons/lu';
import React, { useState } from 'react';
import axios from 'axios';
import './FormProducto.css';           // 👈 reutilizamos los mismos estilos
import API_BASE_URL, { authHeaders } from '../api';

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
  const [enviando, setEnviando] = useState(false);

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
    setEnviando(true);

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
        headers: { 'Content-Type': 'multipart/form-data', ...authHeaders() }
      });

      setMensaje('ok:Accesorio agregado correctamente');
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
      setMensaje('error:No se pudo agregar el accesorio');
    } finally {
      setEnviando(false);
    }
  };

  const [tipo, texto] = mensaje.includes(':') ? mensaje.split(':') : ['', mensaje];

  return (
    <div className="fp-card">
      <div className="fp-header">
        <div className="fp-header-icon" aria-hidden="true"><LuGift /></div>
        <div>
          <h2>Registrar nuevo accesorio</h2>
          <p className="fp-subtitle">Artículos de préstamo/decoración para los eventos</p>
        </div>
      </div>

      {texto && (
        <div className={`fp-alert ${tipo === 'ok' ? 'fp-alert-ok' : 'fp-alert-error'}`}>
          {tipo === 'ok' ? <LuCheck /> : <LuTriangleAlert />} {texto}
        </div>
      )}

      <form onSubmit={handleSubmit} className="fp-form">
        <div className="fp-grid">
          <div className="fp-field">
            <label htmlFor="fa-nombre">Nombre del accesorio</label>
            <input
              id="fa-nombre"
              name="nombre"
              placeholder="Ej. Candelabro"
              value={formData.nombre}
              onChange={handleChange}
              required
            />
          </div>

          <div className="fp-field">
            <label htmlFor="fa-categoria">Categoría</label>
            <input
              id="fa-categoria"
              name="categoria"
              placeholder="Ej. Decoración"
              value={formData.categoria}
              onChange={handleChange}
            />
          </div>

          <div className="fp-field">
            <label htmlFor="fa-cantidad">Cantidad</label>
            <input
              id="fa-cantidad"
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
            <label htmlFor="fa-precio">Precio de reposición (opcional)</label>
            <div className="fp-price-input">
              <span>$</span>
              <input
                id="fa-precio"
                name="precioReposicion"
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                value={formData.precioReposicion}
                onChange={handleChange}
              />
            </div>
          </div>
        </div>

        <div className="fp-field">
          <label htmlFor="fa-descripcion">Descripción</label>
          <textarea
            id="fa-descripcion"
            name="descripcion"
            placeholder="Detalles del accesorio..."
            value={formData.descripcion}
            onChange={handleChange}
            rows={3}
          />
        </div>

        <div className="fp-field">
          <label>Imagen</label>
          <label htmlFor="fa-imagen" className="fp-file-drop">
            <span className="fp-file-icon" aria-hidden="true"><LuImage /></span>
            <span className="fp-file-text">
              {formData.imagen ? formData.imagen.name : 'Elige una imagen (opcional)'}
            </span>
          </label>
          <input
            id="fa-imagen"
            type="file"
            accept="image/*"
            className="fp-file-input-hidden"
            onChange={(e) =>
              setFormData({ ...formData, imagen: e.target.files?.[0] || null })
            }
          />
        </div>

        <div className="fp-switches">
          <label className="fp-switch">
            <input
              type="checkbox"
              name="activo"
              checked={formData.activo}
              onChange={handleChange}
            />
            <span>Activo</span>
          </label>
          <label className="fp-switch">
            <input
              type="checkbox"
              name="esPrestamo"
              checked={formData.esPrestamo}
              onChange={handleChange}
            />
            <span>Es préstamo (se cobra $0)</span>
          </label>
        </div>

        <button type="submit" className="fp-submit" disabled={enviando}>
          {enviando ? 'Guardando…' : '+ Agregar accesorio'}
        </button>
      </form>
    </div>
  );
};

export default FormAccesorio;
