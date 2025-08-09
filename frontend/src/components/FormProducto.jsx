import React, { useState } from 'react';
import axios from 'axios';
import './FormProducto.css';
import API_BASE_URL from '../api';

const FormProducto = ({ onProductoAgregado = () => {} }) => {
  const [formData, setFormData] = useState({
    nombre: '',
    categoria: '',
    cantidad: 0,
    precio: 0,
    descripcion: '',
    imagen: ''
  });

  const [mensaje, setMensaje] = useState('');

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

    const response = await axios.post(`${API_BASE_URL}/productos`, dataToSend, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });

    setMensaje('✅ Producto agregado correctamente');
    setFormData({
      nombre: '',
      categoria: '',
      cantidad: 0,
      precio: 0,
      descripcion: '',
      imagen: null
    });
    onProductoAgregado?.();
  } catch (error) {
    console.error(error);
    setMensaje('❌ Error al agregar el producto');
  }
};

  return (
    <div className="form-producto-container">
      <h2>Registrar nuevo producto</h2>
      {mensaje && <p>{mensaje}</p>}
      <form onSubmit={handleSubmit}>
        <label htmlFor='nombre'>Nombre del producto:</label>
        <input name="nombre" placeholder="Nombre" value={formData.nombre} onChange={handleChange} required />
        <label htmlFor='nombre'>Categoria:</label>
        <input name="categoria" placeholder="Categoría" value={formData.categoria} onChange={handleChange} required />
        <label htmlFor='nombre'>Cantidad:</label>
        <input name="cantidad" type="number" placeholder="Cantidad" value={formData.cantidad} onChange={handleChange} required />
        <label htmlFor='nombre'>Descripción:</label>
        <textarea name="descripcion" placeholder="Descripción" value={formData.descripcion} onChange={handleChange} />
        <label htmlFor='nombre'>Imagen:</label>
        <input id="imagen" type="file" accept="image/*" onChange={(e) => setFormData({ ...formData, imagen: e.target.files[0] })}/>
        <button type="submit">Agregar producto</button>
      </form>
    </div>

    


  );
};

export default FormProducto;
