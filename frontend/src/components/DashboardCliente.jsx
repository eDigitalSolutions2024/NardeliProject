import React, { useEffect, useMemo, useState } from 'react';
import './DashboardCliente.css';
import { useLocation, useParams, useNavigate } from 'react-router-dom';
import API_BASE_URL, { API_ORIGIN } from '../api';

// Placeholder si no hay imagen
const PLACEHOLDER =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200"><rect width="100%" height="100%" fill="#f3f4f6"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="#9ca3af" font-family="Arial" font-size="14">Sin imagen</text></svg>`
  );

const resolveImg = (img) => {
  if (!img) return PLACEHOLDER;
  const clean = String(img).replace(/\\/g, '/');
  if (clean.startsWith('http')) return clean;
  return `${API_ORIGIN}${clean.startsWith('/') ? '' : '/'}${clean}`;
};

// Parseo robusto de precio
const toPrice = (v) => {
  if (v == null) return 0;
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string') {
    const s = v.trim().replace(/\s+/g, '').replace(',', '.').replace(/[^0-9.\-]/g, '');
    const n = parseFloat(s);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
};

const DashboardCliente = ({ reservaId: reservaIdProp }) => {
  // Inventario (con precio para fallback visual)
  const [items, setItems] = useState([]); // [{id, nombre, categoria, stock, unidad, imagen, precio, descripcion}]
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('');
  const [seleccion, setSeleccion] = useState({}); // { [id]: { item, qty } }
  const [error, setError] = useState('');

  // Snapshot de utensilios guardados en la BD
  const [utensiliosBD, setUtensiliosBD] = useState([]); // [{ itemId, nombre, precio, descripcion, ... }]

  const { search } = useLocation();
  const { reservaId: reservaIdParam } = useParams();
  const navigate = useNavigate();

  // Modo admin vía ?mode=admin
  const isAdmin = useMemo(() => {
    const sp = new URLSearchParams(search);
    return sp.get('mode') === 'admin';
  }, [search]);

  // Id de reserva inicial: prop > param > query
  const initialReservaId = useMemo(() => {
    const fromQuery = new URLSearchParams(search).get('reservaId');
    return reservaIdProp ?? reservaIdParam ?? fromQuery ?? null;
  }, [reservaIdProp, reservaIdParam, search]);

  // Estado real de reservaId (permite resolverlo con el token si no vino por URL)
  const [reservaId, setReservaId] = useState(initialReservaId);

  // Resolver reservaId con el token si no vino por URL/prop
  useEffect(() => {
    if (reservaId) return; // ya la tenemos
    const token = localStorage.getItem('token');
    if (!token) { 
      window.location.href = '/login';
      return; 
    }

    (async () => {
      try {
        const r = await fetch(`${API_BASE_URL}/reservas/activa`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const d = await r.json();
        if (d?.ok && d?.reservaId) {
          setReservaId(d.reservaId);
          const usp = new URLSearchParams(search);
          usp.set('reservaId', d.reservaId);
          window.history.replaceState({}, '', `/cliente/dashboard?${usp.toString()}`);
        } else {
          setError('No se pudo obtener tu reserva activa.');
        }
      } catch (e) {
        console.error('activa GET:', e);
        setError('No se pudo conectar para obtener tu reserva. Intenta de nuevo.');
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reservaId]);

  // ===== 1) Cargar inventario (incluye precio como fallback) =====
  useEffect(() => {
    let alive = true;
    const load = async () => {
      setLoading(true);
      setError('');
      try {
        const urlInv = `${API_BASE_URL}/productos/inventario`;
        const rInv = await fetch(urlInv, { headers: { 'Content-Type': 'application/json' } });
        if (!rInv.ok) throw new Error(`HTTP ${rInv.status} inventario`);
        const dInv = await rInv.json();
        const listInv = Array.isArray(dInv) ? dInv : (dInv.items || []);
        const normalizados = listInv.map((x) => ({
          id: x._id || x.id,
          nombre: x.nombre || 'Ítem',
          categoria: x.categoria || 'general',
          stock: Number(x.stock ?? x.cantidad ?? 0),
          unidad: x.unidad || 'pza',
          imagen: x.imagen || '',
          precio: toPrice(x.precio ?? 0),       // fallback visual
          descripcion: x.descripcion || ''       // 👈 NUEVO: descripción desde inventario
        }));
        if (alive) setItems(normalizados);
      } catch (e) {
        console.error('Error cargando inventario', e);
        if (alive) setError('No se pudo cargar el inventario.');
      } finally {
        if (alive) setLoading(false);
      }
    };
    load();
    return () => { alive = false; };
  }, [API_BASE_URL]);

  // ===== 2) Cargar snapshot de utensilios desde la BD =====
  useEffect(() => {
    if (!reservaId) return;
    let alive = true;
    (async () => {
      try {
        const r = await fetch(`${API_BASE_URL}/reservas/${reservaId}/utensilios`);
        if (r.ok) {
          const arr = await r.json();
          if (alive) setUtensiliosBD(Array.isArray(arr) ? arr : []);
        }
      } catch (e) {
        console.error('utensilios GET:', e);
      }
    })();
    return () => { alive = false; };
  }, [reservaId, API_BASE_URL]);

  // Mapas rápidos
  const reservedPriceById = useMemo(() => {
    const m = new Map();
    (utensiliosBD || []).forEach(u => {
      const id = String(u.itemId || u.id || u._id);
      m.set(id, toPrice(u.precio));
    });
    return m;
  }, [utensiliosBD]);

  const invPriceById = useMemo(() => {
    const m = new Map();
    (items || []).forEach(p => m.set(String(p.id), toPrice(p.precio)));
    return m;
  }, [items]);

  // Precio para UI: 1) utensilios (snapshot) 2) inventario (fallback) 3) 0
  const priceFor = (productId) => {
    const id = String(productId);
    const r = reservedPriceById.get(id);
    if (Number.isFinite(r) && r > 0) return r;          // snapshot válido
    const i = invPriceById.get(id);
    if (Number.isFinite(i) && i > 0) return i;          // fallback inventario
    return Number.isFinite(r) ? r : 0;                  // si el 0 es intencional, muéstralo
  };

  // ===== 3) Cargar selección (BD o localStorage) =====
  useEffect(() => {
    if (!reservaId || items.length === 0) return;

    const mergeSeleccionFromSaved = (savedArr) => {
      if (!Array.isArray(savedArr) || savedArr.length === 0) return;
      const byId = new Map(items.map(it => [String(it.id), it]));
      const next = {};
      savedArr.forEach(s => {
        const sid = String(s.itemId || s.id || s._id);
        const base = byId.get(sid) || {
          id: sid,
          nombre: s.nombre || 'Ítem',
          categoria: s.categoria || 'general',
          unidad: s.unidad || 'pza',
          imagen: s.imagen || '',
          stock: Number(s.stock ?? 0),
          precio: toPrice(s.precio),
          descripcion: s.descripcion || ''      // 👈 NUEVO: preserva descripción desde BD/localStorage
        };
        // si existe en inventario y no tiene descripción en saved, usa la del inventario
        if (!base.descripcion && byId.get(sid)?.descripcion) {
          base.descripcion = byId.get(sid).descripcion;
        }
        next[sid] = { item: base, qty: Number(s.cantidad ?? s.qty ?? 0) };
      });
      setSeleccion(next);
    };

    (async () => {
      try {
        // a) /reservas/:id/utensilios
        let saved = null;
        const r1 = await fetch(`${API_BASE_URL}/reservas/${reservaId}/utensilios`);
        if (r1.ok) {
          const d1 = await r1.json();
          saved = Array.isArray(d1) ? d1 : d1.items;
        } else {
          // b) /reservas/:id (por compatibilidad)
          const r2 = await fetch(`${API_BASE_URL}/reservas/${reservaId}`);
          if (r2.ok) {
            const d2 = await r2.json();
            saved = d2?.utensilios || d2?.items || d2?.seleccion || null;
          }
        }

        if (saved && saved.length) {
          mergeSeleccionFromSaved(saved);
          return;
        }

        // c) Fallback: localStorage
        const raw = localStorage.getItem(`sel_${reservaId}`);
        if (raw) {
          const arr = JSON.parse(raw);
          mergeSeleccionFromSaved(arr);
        }
      } catch (e) {
        console.error('cargar selección:', e);
        const raw = localStorage.getItem(`sel_${reservaId}`);
        if (raw) {
          try {
            const arr = JSON.parse(raw);
            mergeSeleccionFromSaved(arr);
          } catch {}
        }
      }
    })();
  }, [reservaId, items, API_BASE_URL]);

  // ===== 4) Persistir selección en localStorage (con precio mostrado) =====
  useEffect(() => {
    if (!reservaId) return;
    const arr = Object.values(seleccion).map(({ item, qty }) => ({
      itemId: item.id,
      nombre: item.nombre,
      cantidad: qty,
      unidad: item.unidad,
      categoria: item.categoria,
      precio: priceFor(item.id), // precio que ve la UI
      descripcion: item.descripcion || ''      // 👈 NUEVO: guarda descripción en localStorage
    }));
    localStorage.setItem(`sel_${reservaId}`, JSON.stringify(arr));
  }, [seleccion, reservaId, reservedPriceById, invPriceById]);

  // ====== utilidades de UI ======
  const cats = useMemo(() => {
    const set = new Set(items.map(i => i.categoria));
    return ['Todas', ...Array.from(set)];
  }, [items]);

  const filtrados = useMemo(() => {
    const term = q.trim().toLowerCase();
    return items.filter(i => {
      const passCat = !cat || cat === 'Todas' || i.categoria === cat;
      const hayTerm = !term || (
        i.nombre?.toLowerCase().includes(term) ||
        i.descripcion?.toLowerCase().includes(term) // opcional: busca también en descripción
      );
      return passCat && hayTerm;
    });
  }, [items, q, cat]);

  const setQty = (item, qty) => {
    const stock = items.find(p => p.id === item.id)?.stock ?? 0;
    qty = Math.max(0, Math.min(qty, stock));
    setSeleccion(prev => {
      const next = { ...prev };
      if (qty === 0){
        delete next[item.id];
      } else {
        const snapshotItem = { ...item }; // incluye descripcion si existe en item
        next[item.id] = { item: snapshotItem, qty };
      }
      return next;
    });
  };

  const inc = (item, delta) => setQty(item, (seleccion[item.id]?.qty || 0) + delta);

  const totalUnidades = useMemo(
    () => Object.values(seleccion).reduce((acc, x) => acc + x.qty, 0),
    [seleccion]
  );

  const totalMonto = useMemo(
    () => Object.values(seleccion).reduce((acc, x) => acc + (priceFor(x.item.id) * x.qty), 0),
    [seleccion, reservedPriceById, invPriceById]
  );

  // ====== Guardar selección (persiste precio que se muestra) ======
  const guardarSeleccion = async () => {
    if (!reservaId) {
      alert('No se encontró el ID de la reserva.');
      return;
    }
    const token = localStorage.getItem('token') || '';
    const itemsPayload = Object.values(seleccion).map(({ item, qty }) => {
      const id = String(item.id);
      const base = {
        itemId: item.id,
        nombre: item.nombre,
        cantidad: qty,
        unidad: item.unidad,
        categoria: item.categoria,
        descripcion: item.descripcion || '' // 👈 NUEVO: enviar descripción al backend
      };

      // No envíes precio en el primer guardado; sí si ya existe snapshot
      if (reservedPriceById.has(id)) {
        base.precio = priceFor(id);
      }
      return base;
    });
    try {
      setSaving(true);
      const res = await fetch(`${API_BASE_URL}/reservas/${reservaId}/utensilios`, {
        method: 'PUT',
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
      try {
        const r = await fetch(`${API_BASE_URL}/reservas/${reservaId}/utensilios`);
        if (r.ok) setUtensiliosBD(await r.json());
      } catch {}
      alert('¡Selección guardada!');
    } catch (e) {
      console.error(e);
      alert('No se pudo guardar la selección');
    } finally {
      setSaving(false);
    }
  };

  // ====== Editar precio (solo admin) — modifica SOLO el snapshot de utensilios ======
  const editarPrecio = async (item) => {
    if (!isAdmin) return;
    if (!reservaId) { alert('No hay reservaId'); return; }

    const actual = priceFor(item.id);
    const input = window.prompt(`Nuevo precio para "${item.nombre}"`, (Number.isFinite(actual) ? actual : 0).toFixed(2));
    if (input === null) return;

    const value = Number(String(input).replace(',', '.').trim());
    if (!Number.isFinite(value) || value < 0) {
      alert('Precio inválido');
      return;
    }

    const token = localStorage.getItem('token') || '';

    try {
      const resp = await fetch(
        `${API_BASE_URL}/reservas/${reservaId}/utensilios/${encodeURIComponent(item.id)}/precio`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {})
          },
          body: JSON.stringify({ precio: value, nombre: item.nombre })
        }
      );

      if (!resp.ok) {
        const text = await resp.text().catch(() => '');
        let msg;
        try {
          const j = JSON.parse(text);
          msg = j?.msg || text;
        } catch {
          msg = text || `HTTP ${resp.status}`;
        }
        throw new Error(msg);
      }

      const data = await resp.json().catch(() => ({}));

      if (Array.isArray(data?.utensilios)) {
        setUtensiliosBD(data.utensilios);
      } else {
        const r = await fetch(`${API_BASE_URL}/reservas/${reservaId}/utensilios`);
        if (r.ok) setUtensiliosBD(await r.json());
      }

      setSeleccion(prev => (prev[item.id] ? { ...prev, [item.id]: { ...prev[item.id] } } : prev));
    } catch (err) {
      console.error('editarPrecio', err);
      alert(
        err?.message?.includes('Failed to fetch')
          ? 'No se pudo contactar al servidor (posible CORS/preflight).'
          : err?.message || 'No se pudo actualizar el precio en la reserva'
      );
    }
  };

  return (
    <div className="cliente-dashboard">
      <div className="cd-header">
        <div>
          <h2>Panel del Cliente</h2>
          <small>
            {isAdmin ? 'Vista de administrador — se muestran precios (desde la reserva)' : 'Selecciona los artículos que necesitas para tu evento'}
          </small>
        </div>
        <div className={`badge ${isAdmin ? 'admin' : 'ok'}`}>
          {isAdmin ? 'ADMIN' : 'Reserva'}{!isAdmin && ':'} {isAdmin ? '' : (reservaId || '—')}
        </div>
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
                const sel = seleccion[it.id];
                const qty = sel?.qty || 0;
                const stock = items.find(p => p.id === it.id)?.stock ?? 0;
                const agotado = stock <= 0;
                const precioNum = priceFor(it.id);

                return (
                  <div key={it.id} className="item-card">
                    <img
                      className="item-img"
                      src={resolveImg(it.imagen)}
                      alt={it.nombre}
                      onError={(e) => { e.currentTarget.src = PLACEHOLDER; }}
                    />
                    <div>
                      <h4 className="item-title" style={{ display:'flex', alignItems:'center', gap:8 }}>
                        {it.nombre}
                        {isAdmin && (
                          <>
                            <span className="item-price"> ${precioNum.toFixed(2)}</span>
                            <button
                              type="button"
                              className="edit-price-btn"
                              onClick={() => editarPrecio(it)}
                              title="Editar precio de este artículo en la reserva"
                              style={{
                                fontSize: 12,
                                padding: '2px 8px',
                                borderRadius: 8,
                                border: '1px solid #ddd',
                                background: '#fff',
                                cursor: 'pointer'
                              }}
                            >
                              Editar precio
                            </button>
                          </>
                        )}
                      </h4>

                      <div className="item-meta">
                        <span className="badge">{it.categoria}</span>
                        <span className={`badge ${agotado ? 'out' : stock < 10 ? 'warn' : 'ok'}`}>
                          Stock: {stock} {it.unidad || 'pza'}
                        </span>
                      </div>

                      <div className="item-actions">
                        <div className="qty">
                          <button onClick={() => setQty(it, Math.max(0, qty - 1))} disabled={qty <= 0}>−</button>
                          <input
                            type="number"
                            min="0"
                            max={stock}
                            value={qty}
                            onChange={(e) => setQty(it, Number(e.target.value))}
                          />
                          <button onClick={() => setQty(it, Math.min(qty + 1, stock))} disabled={qty >= stock}>+</button>
                        </div>
                        <button
                          className="add-btn"
                          onClick={() => setQty(it, Math.min((qty || 0) + 1, stock))}
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
              <div className="empty">Aún no has agregado artículos.</div>
            ) : (
              Object.values(seleccion).map(({ item, qty }) => {
                const p = priceFor(item.id);
                const sub = p * qty;
                return (
                  <div key={item.id} className="sel-item">
                    <div>
                      <strong>{item.nombre}</strong>
                      <div className="small">
                        <small>
                          {qty} {item.unidad || 'pza'} • {item.categoria}
                          {isAdmin && ` • $${p.toFixed(2)} c/u`}
                        </small>
                      </div>
                    </div>
                    <div className="d-flex" style={{ display:'flex', alignItems:'center', gap:8 }}>
                      {isAdmin && <strong>${sub.toFixed(2)}</strong>}
                      <button className="del" onClick={() => setQty(item, 0)}>Quitar</button>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <div style={{display:'flex', justifyContent:'space-between', marginBottom:8}}>
            <strong>Total unidades</strong>
            <strong>{totalUnidades}</strong>
          </div>

          {isAdmin && (
            <div style={{display:'flex', justifyContent:'space-between', marginBottom:12}}>
              <strong>Total $</strong>
              <strong>${totalMonto.toFixed(2)}</strong>
            </div>
          )}

          <button
            className="save"
            disabled={saving || Object.values(seleccion).length === 0}
            onClick={guardarSeleccion}
          >
            {saving ? 'Guardando…' : 'Finalizar Reserva'}
          </button>

          <button
            className="cd-btn"
            type="button"
            onClick={() => {
              if (!reservaId) return alert('No hay reservaId');
              const url = `${API_BASE_URL}/reservas/${reservaId}/pdf`;
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
