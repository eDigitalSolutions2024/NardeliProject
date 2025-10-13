import React, { useEffect, useState } from 'react';
import axios from 'axios';
import './TablaProductos.css';
import API_BASE_URL, { API_ORIGIN } from '../api';   // <-- usa API_ORIGIN para imágenes
const fntMXN = new Intl.NumberFormat('es-MX', {
  style: 'currency',
  currency: 'MXN',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const formatMXN = (v) => fntMXN.format(Number(v|| 0));

export default function TablaProductos({ refresh = 0 } ) {
  const [productos, setProductos] = useState([]);
  const [cargando, setCargando] = useState(false);

  // Estado para edición
  const [showEdit, setShowEdit] = useState(false);
  const [form, setForm] = useState({
    _id: '',
    nombre: '',
    categoria: '',
    cantidad: 0,
    precio: 0,
    imagen: '', 
    descripcion: '',// ruta actual (string)
  });
  const [imagenFile, setImagenFile] = useState(null);
  const [preview, setPreview] = useState(''); // preview de imagen

   const cargar = async () => {                          // <-- NUEVO helper
    try {
      setCargando(true);
      const { data } = await axios.get(`${API_BASE_URL}/productos`);
      const rows = Array.isArray(data) ? data : (data.items || []);
      setProductos(rows);
    } catch (e) {
      console.error('Error al cargar productos:', e);
    } finally {
      setCargando(false);
    }
  };
  
  useEffect(() => { cargar(); }, []);                   // al montar
  useEffect(() => { cargar(); }, [refresh]);            // <-- NUEVO: cuando cambia refresh


  const abrirEdicion = (p) => {
    setForm({
      _id: p._id,
      nombre: p.nombre || '',
      categoria: p.categoria || '',
      cantidad: Number(p.cantidad || 0),
      precio: Number(p.precio || 0),
      imagen: p.imagen || '',
      descripcion: p.descripcion || '',
    });
    setImagenFile(null);
    setPreview(p.imagen ? `${API_ORIGIN}${p.imagen}` : ''); // <-- usa API_ORIGIN
    setShowEdit(true);
  };
  const cerrarEdicion = () => {
    setShowEdit(false);
    setImagenFile(null);
    setPreview('');
  };

  const onChange = (e) => {
    const { name, value } = e.target;
    setForm((s) => ({ ...s, [name]: name === 'cantidad' || name === 'precio' ? Number(value) : value }));
  };

  const onChangeImagen = (e) => {
    const file = e.target.files?.[0];
    setImagenFile(file || null);
    if (file) {
      const url = URL.createObjectURL(file);
      setPreview(url);
    } else {
      setPreview(form.imagen ? `${API_BASE_URL}${form.imagen}` : '');
    }
  };

  const guardarCambios = async (e) => {
    e.preventDefault();
    try {
      const fd = new FormData();
      fd.append('nombre', form.nombre);
      fd.append('categoria', form.categoria);
      fd.append('cantidad', String(form.cantidad));
      fd.append('precio', String(form.precio));
      fd.append('descripcion', form.descripcion); // <-- FALTABA
      // solo si cambió la imagen
      if (imagenFile) fd.append('imagen', imagenFile);

      const { data: actualizado } = await axios.put(
        `${API_BASE_URL}/productos/${form._id}`,
        fd,
        { headers: { 'Content-Type': 'multipart/form-data' } }
      );

      // Actualiza la fila en la tabla sin volver a pedir todo
      setProductos((prev) =>
        prev.map((p) => (p._id === form._id ? { ...p, ...actualizado } : p))
      );

      cerrarEdicion();
    } catch (e) {
      console.error('Error al actualizar producto:', e);
      alert('No se pudo actualizar el producto.');
    }
  };

  return (
    <div className="tabla-productos-container">
      <h2>Lista de productos</h2>

      {cargando ? <p>Cargando...</p> : (
        <table className="tabla-productos">
          <thead>
            <tr>
              <th>Imagen</th>
              <th>Nombre</th>
              <th>Descricpion</th>
              <th>Categoría</th>
              <th>Cantidad</th>
              <th>Precio</th>
              <th style={{width: 110}}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {productos.map((producto) => (
              <tr key={producto._id}>
                <td>
                  {producto.imagen ? (
                    <img
                       src={`${API_ORIGIN}${producto.imagen}`}   // <-- evita hardcodear localhost
                      alt={producto.nombre}
                      width="60"
                      height="60"
                      style={{ objectFit: 'cover', borderRadius: 6 }}
                    />
                  ) : 'Sin imagen'}
                </td>
                <td>{producto.nombre}</td>
                <td>{producto.descripcion}</td>
                <td>{producto.categoria}</td>
                <td>{producto.cantidad}</td>
                <td>{formatMXN(producto.precio || 0)}</td>
                <td>
                  <button
                    className="btn btn-primary"
                    onClick={() => abrirEdicion(producto)}
                  >
                    Editar
                  </button>
                </td>
              </tr>
            ))}
            {productos.length === 0 && (
              <tr><td colSpan="6" style={{ textAlign: 'center' }}>Sin productos</td></tr>
            )}
          </tbody>
        </table>
      )}

      {/* Modal simple */}
      {showEdit && (
        <div className="modal-overlay">
          <div className="modal-card">
            <div className="modal-header">
              <h3>Editar producto</h3>
              <button className="close-x" onClick={cerrarEdicion}>×</button>
            </div>

            <form onSubmit={guardarCambios} className="modal-body">
              <div className="form-row">
                <label>Nombre</label>
                <input
                  type="text"
                  name="nombre"
                  value={form.nombre}
                  onChange={onChange}
                  required
                />
              </div>

              <div className="form-row">
                <label>Categoría</label>
                <input
                  type="text"
                  name="categoria"
                  value={form.categoria}
                  onChange={onChange}
                  required
                />
              </div>

              <div className="form-row">
                <label>Cantidad</label>
                <input
                  type="number"
                  name="cantidad"
                  value={form.cantidad}
                  onChange={onChange}
                  min="0"
                  required
                />
              </div>

              <div className="form-row">
                <label>Precio</label>
                <input
                  type="number"
                  name="precio"
                  value={form.precio}
                  onChange={onChange}
                  
                  min="0"
                  required
                />
              </div>

              <div className="form-row">
                <label>Descripcion</label>
                <input
                  type="text"
                  name="descripcion"
                  value={form.descripcion}
                  onChange={onChange}
                  required
                />
              </div>

              <div className="form-row">
                <label>Imagen (opcional)</label>
                <input type="file" accept="image/*" onChange={onChangeImagen} />
                {preview ? (
                  <div className="preview">
                    <img src={preview} alt="preview" />
                  </div>
                ) : (
                  <small>Si no eliges una nueva imagen, se mantiene la actual.</small>
                )}
              </div>

              <div className="modal-actions">
                <button type="button" className="btn btn-light" onClick={cerrarEdicion}>
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary">
                  Guardar cambios
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
