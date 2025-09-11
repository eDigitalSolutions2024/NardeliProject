import React, { useEffect, useState } from 'react';
import axios from 'axios';
import './TablaProductos.css';
import API_BASE_URL, { API_ORIGIN } from '../api';

const fntMXN = new Intl.NumberFormat('es-MX', {
  style: 'currency',
  currency: 'MXN',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const formatMXN = (v) => fntMXN.format(Number(v || 0));

export default function TablaAccesorios({ refresh = 0 }) {
  const [accesorios, setAccesorios] = useState([]);
  const [cargando, setCargando] = useState(false);

  // Estado para edición
  const [showEdit, setShowEdit] = useState(false);
  const [form, setForm] = useState({
    _id: '',
    nombre: '',
    categoria: '',
    stock: 0,               // cantidad
    precioReposicion: 0,    // precio
    imagen: '',
    descripcion: '',
    activo: true,
    esPrestamo: true,
  });
  const [imagenFile, setImagenFile] = useState(null);
  const [preview, setPreview] = useState('');

  const cargar = async () => {
    try {
      setCargando(true);
      const { data } = await axios.get(`${API_BASE_URL}/accesorios`);
      const rows = Array.isArray(data) ? data : (data.items || []);
      setAccesorios(rows);
    } catch (e) {
      console.error('Error al cargar accesorios:', e);
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => { cargar(); }, []);
  useEffect(() => { cargar(); }, [refresh]);

  const abrirEdicion = (a) => {
    setForm({
      _id: a._id,
      nombre: a.nombre || '',
      categoria: a.categoria || '',
      stock: Number(a.stock ?? 0),
      precioReposicion: Number(a.precioReposicion || 0),
      imagen: a.imagen || '',
      descripcion: a.descripcion || '',
      activo: !!a.activo,
      esPrestamo: !!a.esPrestamo,
    });
    setImagenFile(null);
    setPreview(a.imagen ? `${API_ORIGIN}${a.imagen}` : '');
    setShowEdit(true);
  };

  const cerrarEdicion = () => {
    setShowEdit(false);
    setImagenFile(null);
    setPreview('');
  };

  const onChange = (e) => {
    const { name, value, type, checked } = e.target;
    if (type === 'checkbox') {
      setForm((s) => ({ ...s, [name]: checked }));
    } else {
      setForm((s) => ({
        ...s,
        [name]: name === 'stock' || name === 'precioReposicion' ? Number(value) : value
      }));
    }
  };

  const onChangeImagen = (e) => {
    const file = e.target.files?.[0];
    setImagenFile(file || null);
    if (file) {
      const url = URL.createObjectURL(file);
      setPreview(url);
    } else {
      setPreview(form.imagen ? `${API_ORIGIN}${form.imagen}` : '');
    }
  };

  const guardarCambios = async (e) => {
    e.preventDefault();
    try {
      const fd = new FormData();
      fd.append('nombre', form.nombre);
      fd.append('categoria', form.categoria);
      fd.append('stock', String(form.stock));
      fd.append('precioReposicion', String(form.precioReposicion));
      fd.append('descripcion', form.descripcion || '');
      fd.append('activo', String(!!form.activo));
      fd.append('esPrestamo', String(!!form.esPrestamo));
      if (imagenFile) fd.append('imagen', imagenFile);

      const { data: actualizado } = await axios.put(
        `${API_BASE_URL}/accesorios/${form._id}`,
        fd,
        { headers: { 'Content-Type': 'multipart/form-data' } }
      );

      // Actualiza la fila en la tabla sin recargar todo
      setAccesorios((prev) =>
        prev.map((a) => (a._id === form._id ? { ...a, ...actualizado } : a))
      );

      cerrarEdicion();
    } catch (e) {
      console.error('Error al actualizar accesorio:', e);
      alert('No se pudo actualizar el accesorio.');
    }
  };

  return (
    <div className="tabla-productos-container">
      <h2>Lista de accesorios</h2>

      {cargando ? <p>Cargando...</p> : (
        <table className="tabla-productos">
          <thead>
            <tr>
              <th>Imagen</th>
              <th>Nombre</th>
              <th>Descricpion</th>
              <th>Categoría</th>
              <th>Cantidad</th>
              <th>Precio</th> {/* Precio de reposición */}
              <th style={{ width: 110 }}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {accesorios.map((acc) => (
              <tr key={acc._id}>
                <td>
                  {acc.imagen ? (
                    <img
                      src={`${API_ORIGIN}${acc.imagen}`}
                      alt={acc.nombre}
                      width="60"
                      height="60"
                      style={{ objectFit: 'cover', borderRadius: 6 }}
                    />
                  ) : 'Sin imagen'}
                </td>
                <td>{acc.nombre}</td>
                <td>{acc.descripcion}</td>
                <td>{acc.categoria || 'Accesorio'}</td>
                <td>{acc.stock ?? 0}</td>
                <td>{formatMXN(acc.precioReposicion || 0)}</td>
                <td>
                  <button
                    className="btn btn-primary"
                    onClick={() => abrirEdicion(acc)}
                  >
                    Editar
                  </button>
                </td>
              </tr>
            ))}
            {accesorios.length === 0 && (
              <tr>
                <td colSpan="7" style={{ textAlign: 'center' }}>Sin accesorios</td>
              </tr>
            )}
          </tbody>
        </table>
      )}

      {/* Modal simple (mismos estilos) */}
      {showEdit && (
        <div className="modal-overlay">
          <div className="modal-card">
            <div className="modal-header">
              <h3>Editar accesorio</h3>
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
                />
              </div>

              <div className="form-row">
                <label>Cantidad</label>
                <input
                  type="number"
                  name="stock"
                  value={form.stock}
                  onChange={onChange}
                  min="0"
                  required
                />
              </div>

              <div className="form-row">
                <label>Precio de reposición</label>
                <input
                  type="number"
                  name="precioReposicion"
                  value={form.precioReposicion}
                  onChange={onChange}
                  min="0"
                  step="0.01"
                />
              </div>

              <div className="form-row">
                <label>Descripcion</label>
                <input
                  type="text"
                  name="descripcion"
                  value={form.descripcion}
                  onChange={onChange}
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

              <div className="form-row" style={{ display: 'flex', gap: 16 }}>
                <label style={{ display:'flex', alignItems:'center', gap:8 }}>
                  <input
                    type="checkbox"
                    name="activo"
                    checked={form.activo}
                    onChange={onChange}
                  />
                  Activo
                </label>
                <label style={{ display:'flex', alignItems:'center', gap:8 }}>
                  <input
                    type="checkbox"
                    name="esPrestamo"
                    checked={form.esPrestamo}
                    onChange={onChange}
                  />
                  Es préstamo (se cobra $0)
                </label>
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
