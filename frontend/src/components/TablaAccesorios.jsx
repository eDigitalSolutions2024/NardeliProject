import { aviso, pedirConfirmacion } from '../utils/avisos';
import { LuGift, LuPencil, LuTrash2, LuInbox, LuX } from 'react-icons/lu';
import SearchField from './ui/SearchField';
import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import './TablaProductos.css';
import './FormProducto.css'; // reutiliza .fp-switch para los checkboxes del modal
import API_BASE_URL, { API_ORIGIN, authHeaders } from '../api';

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
  const [busqueda, setBusqueda] = useState('');

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

  const eliminarAccesorio = async (acc) => {
    if (!await pedirConfirmacion(`¿Eliminar "${acc.nombre}"? Esta acción no se puede deshacer.`)) return;
    try {
      await axios.delete(`${API_BASE_URL}/accesorios/${acc._id}`, { headers: authHeaders() });
      setAccesorios((prev) => prev.filter((a) => a._id !== acc._id));
    } catch (e) {
      console.error('Error al eliminar accesorio:', e);
      aviso(e?.response?.data?.error || 'No se pudo eliminar el accesorio.');
    }
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
        { headers: { 'Content-Type': 'multipart/form-data', ...authHeaders() } }
      );

      // Actualiza la fila en la tabla sin recargar todo
      setAccesorios((prev) =>
        prev.map((a) => (a._id === form._id ? { ...a, ...actualizado } : a))
      );

      cerrarEdicion();
    } catch (e) {
      console.error('Error al actualizar accesorio:', e);
      aviso('No se pudo actualizar el accesorio.');
    }
  };

  const accesoriosFiltrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    if (!q) return accesorios;
    return accesorios.filter((a) =>
      [a.nombre, a.categoria, a.descripcion].some((campo) =>
        String(campo || '').toLowerCase().includes(q)
      )
    );
  }, [accesorios, busqueda]);

  return (
    <div className="tp-card">
      <div className="tp-header">
        <h2>Lista de accesorios</h2>
        {!cargando && (
          <span className="tp-count">
            {busqueda
              ? `${accesoriosFiltrados.length} de ${accesorios.length} accesorios`
              : `${accesorios.length} ${accesorios.length === 1 ? 'accesorio' : 'accesorios'}`}
          </span>
        )}
      </div>

      {!cargando && (
        <SearchField
          className="tp-search-field"
          value={busqueda}
          onChange={setBusqueda}
          placeholder="Buscar por nombre, categoría o descripción…"
        />
      )}

      {cargando ? (
        <div className="tp-loading">Cargando accesorios…</div>
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
              {accesoriosFiltrados.map((acc) => (
                <tr key={acc._id}>
                  <td>
                    {acc.imagen ? (
                      <img
                        src={`${API_ORIGIN}${acc.imagen}`}
                        alt={acc.nombre}
                        className="tp-thumb"
                      />
                    ) : (
                      <div className="tp-thumb tp-thumb-empty" aria-hidden="true"><LuGift /></div>
                    )}
                  </td>
                  <td className="tp-nombre">{acc.nombre}</td>
                  <td className="tp-desc">{acc.descripcion}</td>
                  <td><span className="tp-badge">{acc.categoria || 'Accesorio'}</span></td>
                  <td>{acc.stock ?? 0}</td>
                  <td className="tp-precio">{formatMXN(acc.precioReposicion || 0)}</td>
                  <td>
                    <div className="tp-actions">
                      <button
                        className="tp-btn tp-btn-edit"
                        onClick={() => abrirEdicion(acc)}
                      >
                        <LuPencil /> Editar
                      </button>
                      <button
                        className="tp-btn tp-btn-delete"
                        onClick={() => eliminarAccesorio(acc)}
                      >
                        <LuTrash2 /> Eliminar
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {accesoriosFiltrados.length === 0 && (
                <tr>
                  <td colSpan="7">
                    <div className="tp-empty">
                      <span className="tp-empty-icon" aria-hidden="true"><LuInbox /></span>
                      <p>
                        {busqueda
                          ? `Sin resultados para "${busqueda}"`
                          : 'Todavía no hay accesorios registrados'}
                      </p>
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
              <h3>Editar accesorio</h3>
              <button className="tp-close-x" onClick={cerrarEdicion} aria-label="Cerrar"><LuX /></button>
            </div>

            <form onSubmit={guardarCambios} className="tp-modal-body">
              <div className="tp-form-row">
                <label>Nombre</label>
                <input
                  autoFocus
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
                  />
                </div>

                <div className="tp-form-row">
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
              </div>

              <div className="tp-form-row">
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

              <div className="tp-form-row">
                <label>Descripción</label>
                <textarea
                  name="descripcion"
                  value={form.descripcion}
                  onChange={onChange}
                  rows={4}
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

              <div className="tp-form-row">
                <div className="fp-switches">
                  <label className="fp-switch">
                    <input
                      type="checkbox"
                      name="activo"
                      checked={form.activo}
                      onChange={onChange}
                    />
                    <span>Activo</span>
                  </label>
                  <label className="fp-switch">
                    <input
                      type="checkbox"
                      name="esPrestamo"
                      checked={form.esPrestamo}
                      onChange={onChange}
                    />
                    <span>Es préstamo (se cobra $0)</span>
                  </label>
                </div>
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
