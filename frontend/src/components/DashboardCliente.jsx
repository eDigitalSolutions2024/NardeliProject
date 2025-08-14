import React, { useEffect, useMemo, useState } from 'react';
import './DashboardCliente.css';
//import API_BASE_URL from '../api';
import API_BASE_URL, { API_ORIGIN } from '../api';

// Helper: placeholder si no hay imagen
const PLACEHOLDER =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200"><rect width="100%" height="100%" fill="#f3f4f6"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="#9ca3af" font-family="Arial" font-size="14">Sin imagen</text></svg>`
  );

const resolveImg = (img) => {
    if (!img) return PLACEHOLDER;
        const clean = String(img).replace(/\\/g, '/');   // por si hay backslashes de Windows
            if (clean.startsWith('http')) return clean;      // ya es absoluta
            return `${API_ORIGIN}${clean.startsWith('/') ? '' : '/'}${clean}`;
};

const DashboardCliente = ({ reservaId: reservaIdProp }) => {
  const [items, setItems] = useState([]);          // inventario desde backend
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [q, setQ] = useState('');                  // búsqueda
  const [cat, setCat] = useState('');              // filtro categoría
  const [seleccion, setSeleccion] = useState({});  // { [id]: { item, qty } }
  const [error, setError] = useState('');

  // Puedes pasar el id por props, query string ?reservaId=... o ruta /cliente/:reservaId
  const reservaId = useMemo(() => {
    if (reservaIdProp) return reservaIdProp;
    const p = new URLSearchParams(window.location.search).get('reservaId');
    return p || null;
  }, [reservaIdProp]);

  // Carga inventario (ajusta el endpoint a tu backend)
  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      setError('');
      try {
        // 🔁 Ajusta al que ya tengas: /inventario, /api/inventario, /productos?tipo=utensilio, etc.
        const res = await fetch(`${API_BASE_URL}/productos/inventario`, {
          headers: { 'Content-Type': 'application/json' },
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();

        // Normaliza forma mínima esperada
        const normalizados = (Array.isArray(data) ? data : data.items || []).map((x) => ({
          id: x._id || x.id,
          nombre: x.nombre || x.name || 'Ítem',
          categoria: x.categoria || x.category || 'general',
          stock: Number(x.stock ?? x.existencias ?? 0),
          unidad: x.unidad || x.unit || 'pza',
          imagen: x.imagen || x.image || '',
        }));
        if (alive) setItems(normalizados);
      } catch (e) {
        console.error('Error cargando inventario', e);
        if (alive) setError('No se pudo cargar el inventario.');
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, []);

  const cats = useMemo(() => {
    const set = new Set(items.map(i => i.categoria));
    return ['Todas', ...Array.from(set)];
  }, [items]);

  const filtrados = useMemo(() => {
    const term = q.trim().toLowerCase();
    return items.filter(i => {
      const passCat = !cat || cat === 'Todas' || i.categoria === cat;
      const passQ = !term || (i.nombre?.toLowerCase().includes(term));
      return passCat && passQ;
    });
  }, [items, q, cat]);

  // ====== Selección ======
  const setQty = (item, qty) => {
    qty = Math.max(0, Math.min(qty, item.stock));
    setSeleccion(prev => {
      const next = { ...prev };
      if (qty === 0) delete next[item.id];
      else next[item.id] = { item, qty };
      return next;
    });
  };

  const inc = (item, delta) => setQty(item, (seleccion[item.id]?.qty || 0) + delta);

  const totalUnidades = useMemo(
    () => Object.values(seleccion).reduce((acc, x) => acc + x.qty, 0),
    [seleccion]
  );

  // ====== Guardar selección ======
  const guardarSeleccion = async () => {
    if (!reservaId) {
      alert('No se encontró el ID de la reserva.');
      return;
    }
    const token = localStorage.getItem('token') || '';
    const itemsPayload = Object.values(seleccion).map(({ item, qty }) => ({
      itemId: item.id,
      nombre: item.nombre,
      cantidad: qty,
      unidad: item.unidad,
      categoria: item.categoria,
    }));
    try {
      setSaving(true);
      const res = await fetch(`${API_BASE_URL}/reservas/${reservaId}/utensilios`, {
        method: 'PUT', // o POST según tu backend
        headers: {
          'Content-Type': 'application/json',
          'Authorization': token ? `Bearer ${token}` : undefined,
        },
        body: JSON.stringify({ items: itemsPayload, updatedAt: new Date().toISOString() }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.msg || `HTTP ${res.status}`);
      }
      alert('¡Selección guardada!');
    } catch (e) {
      console.error(e);
      alert('No se pudo guardar la selección');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="cliente-dashboard">
      <div className="cd-header">
        <div>
          <h2>Panel del Cliente</h2>
          <small>Selecciona los utensilios que necesitas para tu evento</small>
        </div>
        <div className="badge ok">Reserva: {reservaId || '—'}</div>
      </div>

      <div className="cd-toolbar">
        <input
          className="cd-input"
          placeholder="Buscar (mesas, platos, sillas...)"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <select className="cd-select" value={cat} onChange={(e) => setCat(e.target.value)}>
          {cats.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <button className="cd-btn cd-btn-clear" onClick={() => { setQ(''); setCat(''); }}>
          Limpiar filtros
        </button>
      </div>

      <div className="cd-content">
        {/* Inventario */}
        <div className="cd-card">
          {loading ? (
            <div className="empty">Cargando inventario…</div>
          ) : error ? (
            <div className="empty">{error}</div>
          ) : filtrados.length === 0 ? (
            <div className="empty">No hay coincidencias con tu búsqueda.</div>
          ) : (
            <div className="inventory-grid">
              {filtrados.map((it) => {
                const qty = seleccion[it.id]?.qty || 0;
                const agotado = it.stock <= 0;
                return (
                  <div key={it.id} className="item-card">
                    <img className="item-img" src={resolveImg(it.imagen)} alt={it.nombre} 
                        onError={(e) => { e.currentTarget.src = PLACEHOLDER; }} />
                    <div>
                      <h4 className="item-title">{it.nombre}</h4>
                      <div className="item-meta">
                        <span className="badge">{it.categoria}</span>
                        <span className={`badge ${agotado ? 'out' : it.stock < 10 ? 'warn' : 'ok'}`}>
                          Stock: {it.stock} {it.unidad}
                        </span>
                      </div>

                      <div className="item-actions">
                        <div className="qty">
                          <button onClick={() => inc(it, -1)} disabled={qty <= 0}>−</button>
                          <input
                            type="number"
                            min="0"
                            max={it.stock}
                            value={qty}
                            onChange={(e) => setQty(it, Number(e.target.value))}
                          />
                          <button onClick={() => inc(it, +1)} disabled={qty >= it.stock}>+</button>
                        </div>
                        <button
                          className="add-btn"
                          onClick={() => setQty(it, Math.min((qty || 0) + 1, it.stock))}
                          disabled={agotado}
                        >
                          Añadir
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Resumen */}
        <div className="cd-card summary">
          <h3>Resumen de selección</h3>
          <div className="sel-list">
            {Object.values(seleccion).length === 0 ? (
              <div className="empty">Aún no has agregado utensilios.</div>
            ) : (
              Object.values(seleccion).map(({ item, qty }) => (
                <div key={item.id} className="sel-item">
                  <div>
                    <strong>{item.nombre}</strong>
                    <div><small>{qty} {item.unidad} • {item.categoria}</small></div>
                  </div>
                  <button className="del" onClick={() => setQty(item, 0)}>Quitar</button>
                </div>
              ))
            )}
          </div>

          <div style={{display:'flex', justifyContent:'space-between', marginBottom:12}}>
            <strong>Total unidades</strong>
            <strong>{totalUnidades}</strong>
          </div>
          <button className="save" disabled={saving || Object.values(seleccion).length === 0} onClick={guardarSeleccion}>
            {saving ? 'Guardando…' : 'Guardar selección'}
          </button>

            <button
                className="cd-btn"
                type="button"
                onClick={() => {
                    if (!reservaId) return alert('No hay reservaId');
                    const url = `${API_BASE_URL}/reservas/${reservaId}/pdf`;
                    console.log('PDF URL =>', url);
                    window.open(url, '_blank');
                }}
                >
                Descargar PDF
            </button>

        </div>
      </div>
    </div>
  );
};

export default DashboardCliente;
