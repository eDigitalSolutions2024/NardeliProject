import React, { useEffect, useState } from 'react';
import axios from 'axios';
import './TablaProductos.css';

import API_BASE_URL from '../api';

const TablaProductos = () => {
  const [productos, setProductos] = useState([]);

  useEffect(() => {
    const obtenerProductos = async () => {
      try {
        const response = await axios.get(`${API_BASE_URL}/productos`);
        setProductos(response.data);
      } catch (error) {
        console.error('Error al cargar productos:', error);
      }
    };

    obtenerProductos();
  }, []);

  return (
    <div className="tabla-productos-container">
      <h2>Lista de productos</h2>
      <table className="tabla-productos">
        <thead>
          <tr>
            <th>Imagen</th>
            <th>Nombre</th>
            <th>Categoría</th>
            <th>Cantidad</th>
            <th>Precio</th>
          </tr>
        </thead>
        <tbody>
          {productos.map((producto) => (
            <tr key={producto._id}>
              <td>
                {producto.imagen ? (
                  <img
                    src={`http://localhost:8010${producto.imagen}`}
                    alt={producto.nombre}
                    width="60"
                  />
                ) : (
                  'Sin imagen'
                )}
              </td>
              <td>{producto.nombre}</td>
              <td>{producto.categoria}</td>
              <td>{producto.cantidad}</td>
              <td>${producto.precio}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default TablaProductos;
