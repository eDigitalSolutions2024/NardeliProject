import React, { useEffect, useState } from 'react';
import axios from 'axios';
import './TablaProductos.css';
import API_BASE_URL, { API_ORIGIN, authHeaders } from '../api';   // <-- usa API_ORIGIN para imágenes
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
      const { data } = await axios.get(`${API_BASE_URL}/productos`, { headers: authHeaders() });
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

  const eliminarProducto = async (producto) => {
    if (!window.confirm(`¿Eliminar "${producto.nombre}"? Esta acción no se puede deshacer.`)) return;
    try {
      await axios.delete(`${API_BASE_URL}/productos/${producto._id}`, { headers: authHeaders() });
      setProductos((prev) => prev.filter((p) => p._id !== producto._id));
    } catch (e) {
      console.error('Error al eliminar producto:', e);
      alert(e?.response?.data?.msg || 'No se pudo eliminar el producto.');
    }
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
        { headers: { 'Content-Type': 'multipart/form-data', ...authHeaders() } }
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
    <div className="tp-card">
      <div className="tp-header">
        <h2>Lista de productos</h2>
        {!cargando && <span className="tp-count">{productos.length} {productos.length === 1 ? 'producto' : 'productos'}</span>}
      </div>

      {cargando ? (
        <div className="tp-loading">Cargando productos…</div>
      ) : (
        <div className="tp-table-scroll">
          <table className="tp-table">
            <thead>
              <tr>
                <th></th>
                <th>Nombre</th>
                <th>Descripción</th>
                <th>Categoría</th>
                <th>Cantidad</th>
                <th>Precio</th>
                <th className="tp-col-actions">Acciones</th>
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
                        className="tp-thumb"
                      />
                    ) : (
                      <div className="tp-thumb tp-thumb-empty" aria-hidden="true">🖼️</div>
                    )}
                  </td>
                  <td className="tp-nombre">{producto.nombre}</td>
                  <td className="tp-desc">{producto.descripcion}</td>
                  <td><span className="tp-badge">{producto.categoria}</span></td>
                  <td>{producto.cantidad}</td>
                  <td className="tp-precio">{formatMXN(producto.precio || 0)}</td>
                  <td>
                    <div className="tp-actions">
                      <button
                        className="tp-btn tp-btn-edit"
                        onClick={() => abrirEdicion(producto)}
                      >
                        ✎ Editar
                      </button>
                      <button
                        className="tp-btn tp-btn-delete"
                        onClick={() => eliminarProducto(producto)}
                      >
                        🗑 Eliminar
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {productos.length === 0 && (
                <tr>
                  <td colSpan="7">
                    <div className="tp-empty">
                      <span className="tp-empty-icon" aria-hidden="true">📭</span>
                      <p>Todavía no hay productos registrados</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal de edición */}
      {showEdit && (
        <div className="tp-modal-overlay" onClick={cerrarEdicion}>
          <div className="tp-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="tp-modal-header">
              <h3>Editar producto</h3>
              <button className="tp-close-x" onClick={cerrarEdicion} aria-label="Cerrar">×</button>
            </div>

            <form onSubmit={guardarCambios} className="tp-modal-body">
              <div className="tp-form-row">
                <label>Nombre</label>
                <input
                  type="text"
                  name="nombre"
                  value={form.nombre}
                  onChange={onChange}
                  required
                />
              </div>

              <div className="tp-form-row-grid">
                <div className="tp-form-row">
                  <label>Categoría</label>
                  <input
                    type="text"
                    name="categoria"
                    value={form.categoria}
                    onChange={onChange}
                    required
                  />
                </div>

                <div className="tp-form-row">
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
              </div>

              <div className="tp-form-row">
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

              <div className="tp-form-row">
                <label>Descripción</label>
                <textarea
                  name="descripcion"
                  value={form.descripcion}
                  onChange={onChange}
                  rows={4}
                  required
                />
              </div>

              <div className="tp-form-row">
                <label>Imagen (opcional)</label>
                <input type="file" accept="image/*" onChange={onChangeImagen} />
                {preview ? (
                  <div className="tp-preview">
                    <img src={preview} alt="preview" />
                  </div>
                ) : (
                  <small className="tp-hint">Si no eliges una nueva imagen, se mantiene la actual.</small>
                )}
              </div>

              <div className="tp-modal-actions">
                <button type="button" className="tp-btn tp-btn-light" onClick={cerrarEdicion}>
                  Cancelar
                </button>
                <button type="submit" className="tp-btn tp-btn-save">
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
