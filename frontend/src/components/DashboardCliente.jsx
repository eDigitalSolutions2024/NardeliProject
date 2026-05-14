import React, { useEffect, useMemo, useState } from 'react';
import './DashboardCliente.css';
import { useLocation, useParams, useNavigate } from 'react-router-dom';
import API_BASE_URL, { API_ORIGIN } from '../api';
import ModalAccesoInvitaciones from './ModalAccesoInvitaciones';

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

const money = (n) =>
  Number(n || 0).toLocaleString('es-MX', {
    style: 'currency',
    currency: 'MXN',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const DashboardCliente = ({ reservaId: reservaIdProp }) => {
  // Inventario (con precio para fallback visual)
  const [items, setItems] = useState([]); // [{id, nombre, categoria, stock, unidad, imagen, precio, descripcion}]
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('');
  const [seleccion, setSeleccion] = useState({}); // { [id]: { item, qty } }
  const [error, setError] = useState('');

  const [showModalInvitaciones, setShowModalInvitaciones] = useState(false);
  const [reservaSeleccionadaId, setReservaSeleccionadaId] = useState(null);

  const abrirModalInvitaciones = (reservaId) => {
    setReservaSeleccionadaId(reservaId);
    setShowModalInvitaciones(true);
  };


  // ====== AUTH: rol y perfil (para restringir y etiquetar issuer)
  const [me, setMe] = useState(null);           // { id, name, email, role }
  const [userRole, setUserRole] = useState(null); // 'admin' | 'assistant' | etc.

  // Snapshot de utensilios guardados en la BD
  const [utensiliosBD, setUtensiliosBD] = useState([]); // [{ itemId, nombre, precio, descripcion, ... }]

  // Descuento de la reserva (admin)
  const [descTipo, setDescTipo] = useState('monto'); // 'monto' | 'porcentaje'
  const [descValor, setDescValor] = useState(0);

  // ACCESORIOS
  const [accesorios, setAccesorios] = useState([]); // lista desde /accesorios
  const [loadingAcc, setLoadingAcc] = useState(false);
  const [selAccesorios, setSelAccesorios] = useState({}); // { [accesorioId]: qty }

  const [historial, setHistorial] = useState([]);
  const [showHistorial, setShowHistorial] = useState(false);

  // Productos a los que se aplicará el descuento global (por item, opcional)
const [discountItems, setDiscountItems] = useState({}); // { [itemId]: true }

  // MODAL "Ver accesorios"
  const [showAccModal, setShowAccModal] = useState(false);

  const { search } = useLocation();
  const { reservaId: reservaIdParam } = useParams();
  const navigate = useNavigate();

  // Modo admin vía ?mode=admin
  const isAdmin = useMemo(() => {
    const sp = new URLSearchParams(search);
    return sp.get('mode') === 'admin';
  }, [search]);

  // Rol assistant por API
  const isAssistant = useMemo(() => userRole === 'assistant', [userRole]);
  // ✅ staff = admin (por query) o admin/assistant real por API
  const isStaff = useMemo(() => isAdmin || isAssistant || userRole === 'admin', [isAdmin, isAssistant, userRole]);

  // Cargar /auth/me para saber el rol real
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) return;
    (async () => {
      try {
        const r = await fetch(`${API_BASE_URL}/auth/me`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (!r.ok) return;
        const d = await r.json();
        setMe(d);
        const role = d?.role || d?.rol || d?.user?.role || d?.user?.rol || null;
        setUserRole(role);
      } catch {}
    })();
  }, [API_BASE_URL]);

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

  // 1) Cargar inventario (incluye precio como fallback)
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
          precio: toPrice(x.precio ?? 0), // fallback visual
          descripcion: x.descripcion || '' // descripción desde inventario
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

  // 1b) Cargar ACCESORIOS
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setLoadingAcc(true);
        const r = await fetch(`${API_BASE_URL}/accesorios`);
        const list = r.ok ? await r.json() : [];
        if (alive) setAccesorios(Array.isArray(list) ? list : []);
      } catch (e) {
        console.error('accesorios GET:', e);
      } finally {
        if (alive) setLoadingAcc(false);
      }
    })();
    return () => { alive = false; };
  }, [API_BASE_URL]);

  // 2) Cargar descuento existente + accesorios guardados en la reserva
  useEffect(() => {
    if (!reservaId) return;
    (async () => {
      try {
        const r = await fetch(`${API_BASE_URL}/reservas/${reservaId}`);
        if (!r.ok) return;
        const d = await r.json();

        // Descuento
        const des = d?.precios?.descuento || d?.descuento;
        if (des) {
          setDescTipo(des.tipo || 'monto');
          setDescValor(Number(des.valor || 0));
        }

        // Hidratar accesorios desde resumenSeleccion.accesorios (si no hay en memoria)
        if (Object.keys(selAccesorios || {}).length === 0) {
          const accResumen = d?.resumenSeleccion?.accesorios || [];
          if (Array.isArray(accResumen) && accResumen.length) {
            const pre = {};
            accResumen.forEach(a => {
              if (a?.accesorioId) pre[String(a.accesorioId)] = Number(a?.cantidad || 0);
            });
            if (Object.keys(pre).length) setSelAccesorios(pre);
          }
        }
      } catch (err) {
        console.error('GET reserva (descuento + accesorios):', err);
      }
    })();
  }, [reservaId, API_BASE_URL, selAccesorios]);

  // 2b) (duplicado light) Cargar descuento existente desde la reserva
  useEffect(() => {
    if (!reservaId) return;
    (async () => {
      try {
        const r = await fetch(`${API_BASE_URL}/reservas/${reservaId}`);
        if (!r.ok) return;
        const d = await r.json();
        const des = d?.precios?.descuento || d?.descuento;
        if (des) {
          setDescTipo(des.tipo || 'monto');
          setDescValor(Number(des.valor || 0));
        }
      } catch {}
    })();
  }, [reservaId]);

  // Snapshot completo de la reserva para prefill del recibo (cliente, fechas, etc.)
  const [reservaData, setReservaData] = useState(null);
  // === Pagos parciales / historial de recibos ===
const [receipts, setReceipts] = useState([]);     // historial de recibos de la reserva
const [loadingReceipts, setLoadingReceipts] = useState(false);

// Monto a cobrar en este recibo (por defecto: saldo)
const [paymentAmount, setPaymentAmount] = useState(0);


  useEffect(() => {
    if (!reservaId) return;
    (async () => {
      try {
        const r = await fetch(`${API_BASE_URL}/reservas/${reservaId}`);
        if (!r.ok) return;
        const d = await r.json();
        setReservaData(d);
      } catch {}
    })();
  }, [reservaId, API_BASE_URL]);


useEffect(() => {
  if (!reservaId) { setReceipts([]); return; }
  let abort = false;
  (async () => {
    try {
      setLoadingReceipts(true);
      const r = await fetch(`${API_BASE_URL}/reservas/${reservaId}/receipts`);
      const data = r.ok ? await r.json() : [];
      if (!abort) setReceipts(Array.isArray(data) ? data : (data.items || []));
    } catch {
      if (!abort) setReceipts([]);
    } finally {
      if (!abort) setLoadingReceipts(false);
    }
  })();
  return () => { abort = true; };
}, [reservaId, API_BASE_URL]);



  // 2c) Prefill de accesorios desde BD (si ya hay guardados como préstamo)
  useEffect(() => {
    if (!accesorios.length || !utensiliosBD.length) return;
    const pre = {};
    utensiliosBD.forEach(u => {
      if (u?.esPrestamo && (u?.accesorioOrigenId || u?.itemId)) {
        const key = String(u.accesorioOrigenId || u.itemId);
        pre[key] = Number(u.cantidad || 0);
      }
    });
    if (Object.keys(pre).length) setSelAccesorios(pre);
  }, [accesorios, utensiliosBD]);

  // 2d) Cargar accesorios desde localStorage si no había en BD
  useEffect(() => {
    if (!reservaId || !accesorios.length) return;
    if (Object.keys(selAccesorios).length > 0) return;
    const raw = localStorage.getItem(`acc_${reservaId}`);
    if (raw) {
      try { setSelAccesorios(JSON.parse(raw)); } catch {}
    }
  }, [reservaId, accesorios]); // eslint-disable-line

  // Persistir selección de accesorios en localStorage
  useEffect(() => {
    if (!reservaId) return;
    localStorage.setItem(`acc_${reservaId}`, JSON.stringify(selAccesorios));
  }, [selAccesorios, reservaId]);

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

  // Precio para UI: 1) inventario (MASTER)  2) utensilios (fallback)  3) 0
const priceFor = (productId) => {
  const id = String(productId);

  // 🟢 primero: inventario
  const i = invPriceById.get(id);
  if (Number.isFinite(i) && i > 0) return i;

  // 🟡 solo si no hay precio en inventario, toma el de la reserva
  const r = reservedPriceById.get(id);
  if (Number.isFinite(r) && r > 0) return r;

  return 0;
};


  // 3) Cargar selección (BD o localStorage)
  useEffect(() => {
  if (!reservaId || items.length === 0) return;

  const mergeSeleccionFromSaved = (savedArr) => {
    if (!Array.isArray(savedArr) || savedArr.length === 0) return;

    // ⬅️ NUEVO: guardar snapshot completo para precios
    setUtensiliosBD(savedArr);

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
        descripcion: s.descripcion || ''
      };
      if (!base.descripcion && byId.get(sid)?.descripcion) {
        base.descripcion = byId.get(sid).descripcion;
      }
      next[sid] = { item: base, qty: Number(s.cantidad ?? s.qty ?? 0) };
    });
    const descuentosIniciales = {};

savedArr.forEach(s => {

  const sid = String(s.itemId || s.id || s._id);

  if (s.aplicarDescuento === true) {
    descuentosIniciales[sid] = true;
  }
});

setDiscountItems(descuentosIniciales);

    setSeleccion(next);
  };

    (async () => {
      try {
        let saved = null;
        const r1 = await fetch(`${API_BASE_URL}/reservas/${reservaId}/utensilios`);
        if (r1.ok) {
          const d1 = await r1.json();
          saved = Array.isArray(d1) ? d1 : d1.items;
        } else {
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

  // 4) Persistir selección en localStorage (con precio mostrado)
  useEffect(() => {
    if (!reservaId) return;
    const arr = Object.values(seleccion).map(({ item, qty }) => ({
      itemId: item.id,
      nombre: item.nombre,
      cantidad: qty,
      unidad: item.unidad,
      categoria: item.categoria,
      precio: priceFor(item.id),
      descripcion: item.descripcion || ''
    }));
    localStorage.setItem(`sel_${reservaId}`, JSON.stringify(arr));
  }, [seleccion, reservaId, reservedPriceById, invPriceById]);

  // ====== utilidades de UI
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
        i.descripcion?.toLowerCase().includes(term)
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
        const snapshotItem = { ...item };
        next[item.id] = { item: snapshotItem, qty };
      }
      return next;
    });
  };

  const setQtyAcc = (acc, qty) => {
    const stock = Number(acc.stock ?? 0);
    qty = Math.max(0, Math.min(qty, stock));
    setSelAccesorios(prev => {
      const next = { ...prev };
      if (qty === 0) delete next[acc._id];
      else next[acc._id] = qty;
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

  const subTotalUI = totalMonto;

  // Subtotal solo de los productos con descuento activo
const subtotalDescuento = useMemo(
  () => Object.values(seleccion).reduce((acc, x) => {
    const idStr = String(x.item.id);
    if (!discountItems[idStr]) return acc; // este producto NO tiene descuento
    const linea = priceFor(x.item.id) * x.qty;
    return acc + linea;
  }, 0),
  [seleccion, discountItems, reservedPriceById, invPriceById]
);


  const descuentoMonto = useMemo(() => {
  const base = subtotalDescuento;        // solo sobre productos marcados
  const v = Number(descValor) || 0;
  if (!base || v <= 0) return 0;

  if (descTipo === 'porcentaje') {
    const pct = Math.max(0, Math.min(100, v)) / 100;
    return Math.min(base, base * pct);
  }

  // tipo = "monto": descuentas hasta lo que abarcan los productos marcados
  return Math.min(base, Math.max(0, v));
}, [descTipo, descValor, subtotalDescuento]);

  const totalConDescuento = useMemo(
    () => Math.max(0, subTotalUI - descuentoMonto),
    [subTotalUI, descuentoMonto]
  );
  // Suma de pagos ya registrados
const totalPagado = useMemo(() => {
  try {
    return (receipts || []).reduce((sum, r) => sum + Number(r?.amount || 0), 0);
  } catch { return 0; }
}, [receipts]);

// Saldo restante (no negativo)
const saldoRestante = useMemo(() => {
  const rest = Number(totalConDescuento || 0) - Number(totalPagado || 0);
  return Math.max(0, Number.isFinite(rest) ? rest : 0);
}, [totalConDescuento, totalPagado]);


  // ====== Guardar selección (persiste productos/utensilios)
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
        descripcion: item.descripcion || ''
      };
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
        body: JSON.stringify({ items: itemsPayload,  discountItems, updatedAt: new Date().toISOString() }),
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

  const cargarHistorial = async () => {
  try {
    if (!reservaId) {
      alert('No se encontró la reserva.');
      return;
    }

    const res = await fetch(`${API_BASE_URL}/reservas/${reservaId}/historial`);
    const data = await res.json();

    if (!res.ok) {
      throw new Error(data?.msg || `HTTP ${res.status}`);
    }

    setHistorial(Array.isArray(data?.historial) ? data.historial : []);
    setShowHistorial(true);
  } catch (e) {
    console.error('cargarHistorial:', e);
    alert('No se pudo cargar el historial');
  }
};

  const formatearCambio = (item) => {
  if (item.tipo === 'producto') {
    if (item.accion === 'add') return `Se agregó ${item.producto?.nombre}`;
    if (item.accion === 'remove') return `Se eliminó ${item.producto?.nombre}`;
    if (item.accion === 'update') return `Se actualizó ${item.producto?.nombre}`;
  }

  if (item.tipo === 'descuento') {
    return 'Se actualizó el descuento';
  }

  return 'Cambio realizado';
};

  // ====== Aplicar accesorios como préstamo (precio $0) a la reserva
  const aplicarAccesorios = async () => {
    if (!reservaId) return;
    const seleccionAcc = Object.entries(selAccesorios)
      .map(([accesorioId, cantidad]) => ({ accesorioId, cantidad: Number(cantidad || 0) }))
      .filter(x => x.cantidad > 0);

    if (seleccionAcc.length === 0) return; // no hay accesorios, saltar

    try {
      const r = await fetch(`${API_BASE_URL}/reservas/${reservaId}/accesorios/apply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ seleccion: seleccionAcc }),
      });
      if (!r.ok) {
        const t = await r.text().catch(()=> '');
        throw new Error(t || `HTTP ${r.status}`);
      }
      // refrescar snapshot opcional
      try {
        const r2 = await fetch(`${API_BASE_URL}/reservas/${reservaId}/utensilios`);
        if (r2.ok) setUtensiliosBD(await r2.json());
      } catch {}
      alert('Accesorios guardados en la reserva');
      setShowAccModal(false);
    } catch (e) {
      console.error('aplicarAccesorios', e);
      alert('No se pudieron aplicar los accesorios a la reserva');
    }
  };

  // ====== Finalizar: guarda productos + aplica accesorios
  const finalizarReserva = async () => {
  try {
    await guardarSeleccion();
    await aplicarAccesorios();
    alert('Reserva finalizada y cambios guardados');
  } catch (e) {
    console.error('finalizarReserva', e);
    alert('No se pudo finalizar la reserva');
  }
};

  // ====== Editar precio (solo admin) — modifica SOLO el snapshot de utensilios
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

  // Derivado: accesorios seleccionados con sus datos (para el modal)
  const accesoriosSeleccionados = useMemo(() => {
    return Object.entries(selAccesorios)
      .map(([accesorioId, cantidad]) => {
        const acc = (accesorios || []).find(a => String(a._id) === String(accesorioId));
        if (!acc) return null;
        return {
          accesorioId: String(acc._id),
          nombre: acc.nombre,
          categoria: acc.categoria || 'Accesorio',
          unidad: acc.unidad || 'pza',
          cantidad: Number(cantidad || 0),
          precioReposicion: Number(acc.precioReposicion || 0),
          descripcion: acc.descripcion || '',
          imagen: acc.imagen || ''
        };
      })
      .filter(Boolean);
  }, [selAccesorios, accesorios]);

  // ====== RECIBO: estado, prefill y submit
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);


  const todayStr = useMemo(() => {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const da = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${da}`;
  }, []);

  const [receiptForm, setReceiptForm] = useState({
    customerName: '',
    concept: '',
    paymentMethod: 'TRANSFERENCIA',
    currency: 'MXN',
    issuedAt: '', // YYYY-MM-DD
    notes: '',
    taxRate: 0.16,
  });

 

 function openReceiptModalPrefill() {
  if (!reservaData) {
    alert('Aún no se carga la reserva. Intenta de nuevo en unos segundos.');
    return;
  }
 const fmtFechaMX = (d) => {
  try {
    const dt = d ? new Date(d) : null;
    return dt ? dt.toLocaleDateString('es-MX') : '';
  } catch { return ''; }
};
  const cliente = (reservaData?.cliente || '').trim() || 'Cliente';

  const conceptoBase = [
    (reservaData?.tipoEvento || 'Evento'),
    fmtFechaMX(reservaData?.fecha)
  ].filter(Boolean).join(' – ');

  const concept = `${conceptoBase}${conceptoBase ? ' • ' : ''}Reserva ${reservaId || ''}`.trim();

  const notasParts = [
    reservaData?.descripcion && `Descripción: ${reservaData.descripcion}`,
    (reservaData?.horaInicio && reservaData?.horaFin) && `Horario: ${reservaData.horaInicio}–${reservaData.horaFin}`,
    Number.isFinite(+reservaData?.cantidadPersonas) && `Personas: ${reservaData.cantidadPersonas}`,
    reservaData?.correo && `Correo: ${reservaData.correo}`,
    reservaData?.telefono && `Tel: ${reservaData.telefono}`
  ].filter(Boolean);

  setReceiptForm(f => ({
    ...f,
    customerName: cliente,
    concept,
    issuedAt: todayStr,
    currency: reservaData?.precios?.moneda || f.currency || 'MXN',
    notes: notasParts.join(' • ')
  }));

  // ⬇️ Prefill del monto a cobrar = saldo actual
  setPaymentAmount(Number(saldoRestante || 0));

  setShowReceiptModal(true);
}


async function deleteReceiptById(id) {
  if (!id) return;
  if (!window.confirm('¿Eliminar este recibo? Esta acción no se puede deshacer.')) return;

  try {
    const r = await fetch(`${API_BASE_URL}/receipts/${id}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!r.ok) {
      const text = await r.text().catch(() => '');
      let msg;
      try {
        const j = JSON.parse(text);
        msg = j?.msg || j?.error || text;
      } catch {
        msg = text || `HTTP ${r.status}`;
      }
      throw new Error(msg);
    }

    // refrescar lista de recibos después de borrar
    if (!reservaId) return;
    try {
      const rr = await fetch(`${API_BASE_URL}/reservas/${reservaId}/receipts`);
      const data = rr.ok ? await rr.json() : [];
      setReceipts(Array.isArray(data) ? data : (data.items || []));
    } catch (e) {
      console.error('refresh receipts after delete', e);
    }

    alert('Recibo eliminado correctamente');
  } catch (err) {
    console.error('deleteReceiptById', err);
    alert(err?.message || 'No se pudo eliminar el recibo');
  }
}



  async function submitReceipt() {
    try {
      if (!reservaId) return alert('No hay reservaId');

      const itemsPayload = Object.values(seleccion).map(({ item, qty }) => ({
        description: item.nombre,
        quantity: qty,
        unitPrice: Number(priceFor(item.id) || 0),
      }));
      // === Validación: no sobrepagar ===
const amt = Number(paymentAmount || 0);
if (!Number.isFinite(amt) || amt <= 0) {
  return alert('El monto a cobrar debe ser mayor a cero.');
}
if (amt > saldoRestante + 0.0001) { // tolerancia flotantes
  return alert(`No puedes cobrar más del saldo restante ($${saldoRestante.toFixed(2)}).`);
}


      if (itemsPayload.length === 0) {
        return alert('No hay artículos en la selección para generar el recibo.');
      }

      const payload = {
  customerName: receiptForm.customerName || 'Cliente',
  concept: receiptForm.concept || `Reserva ${reservaId}`,
  items: itemsPayload,
  taxRate: Number(receiptForm.taxRate || 0),
  currency: receiptForm.currency || 'MXN',
  paymentMethod: receiptForm.paymentMethod || 'EFECTIVO',
  issuedAt: receiptForm.issuedAt || todayStr, // 'YYYY-MM-DD'
  issuedBy: me?.email || me?.name || 'centro de eventos Nardeli',
  notes: receiptForm.notes || '',
  tz: 'America/Ciudad_Juarez',
  amount: amt,  // ⬅️ monto de este recibo/pago parcial


  // 🔽 datos útiles de la reserva:
  orderId: reservaId,
  customerId: reservaData?.clienteId || undefined,   // si quieres enlazar al usuario autenticado
  contact: {
    email: reservaData?.correo || undefined,
    phone: reservaData?.telefono || undefined,
  },
  event: {
    type: reservaData?.tipoEvento || undefined,
    date: reservaData?.fecha || undefined,
    start: reservaData?.horaInicio || undefined,
    end: reservaData?.horaFin || undefined,
    people: reservaData?.cantidadPersonas || undefined,
  },
};


      const r = await fetch(`${API_BASE_URL}/receipts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await r.json();
      if (!r.ok) throw new Error(data?.error || 'No se pudo crear el recibo');

      const id = data?.receipt?._id || data?.receipt?.id;
      if (!id) {
        alert('Recibo creado, pero no se obtuvo el ID para el PDF.');
        setShowReceiptModal(false);
        return;
      }
      window.open(`${API_BASE_URL}/receipts/${id}/pdf`, '_blank');
      setShowReceiptModal(false);
    } catch (e) {
      console.error('submitReceipt', e);
      alert(e?.message || 'Error al generar el recibo');
    }
  }



  // 👇 PÉGALO DEBAJO DE submitReceipt (o junto a tus helpers) y ANTES del return
function openReceiptPdfById(id) {
  if (!id) return;
  const url = `${API_BASE_URL}/receipts/${id}/pdf`;
  window.open(url, '_blank', 'noopener'); // abre en nueva pestaña
}



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

        {/* Resumen (productos) */}
        <div className="cd-card summary">
          <div style={{display:'flex', alignItems:'center', justifyContent:'space-between'}}>
            <h3>Resumen de selección</h3>
            <button
              type="button"
              className="cd-btn"
              onClick={() => setShowAccModal(true)}
              title="Ver accesorios seleccionados"
            >
              Ver accesorios
            </button>
          </div>

          <div className="sel-list">
            {Object.values(seleccion).length === 0 ? (
              <div className="empty">Aún no has agregado artículos.</div>
            ) : (
              Object.values(seleccion).map(({ item, qty }) => {
              const p = priceFor(item.id);
              const sub = p * qty;
              const idStr = String(item.id);

              return (
                <div key={idStr} className="sel-item">
                  <div>
                    <strong>{item.nombre}</strong>
                    <div className="small">
                      <small>
                        {qty} {item.unidad || 'pza'} • {item.categoria}
                        {isAdmin && <strong>{money(sub)}</strong>}
                      </small>
                    </div>

                    {isAdmin && (
                      <label
                        className="small"
                        style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 4 }}
                      >
                        <input
                          type="checkbox"
                          checked={!!discountItems[idStr]}
                          onChange={(e) =>
                            setDiscountItems(prev => ({
                              ...prev,
                              [idStr]: e.target.checked
                            }))
                          }
                        />
                        Aplicar descuento a este producto
                      </label>
                    )}
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
            <>
              <div style={{display:'flex', justifyContent:'space-between', marginBottom:12}}>
                <strong>Subtotal $</strong>
                <strong>{money(subTotalUI)}</strong>
              </div>

              <hr style={{ margin: '12px 0', borderColor: '#eee' }} />

              <h4 style={{ marginBottom: 8 }}>Descuento</h4>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
                <select
                  className="cd-select"
                  value={descTipo}
                  onChange={(e) => setDescTipo(e.target.value)}
                  style={{ maxWidth: 160 }}
                >
                  <option value="monto">Monto ($)</option>
                  <option value="porcentaje">% Porcentaje</option>
                </select>

                <input
                  className="cd-input"
                  type="number"
                  min="0"
                  step={descTipo === 'porcentaje' ? '0.01' : '0.01'}
                  value={descValor}
                  onChange={(e) => setDescValor(e.target.value)}
                  placeholder={descTipo === 'porcentaje' ? 'Ej. 10 = 10%' : 'Ej. 500 = $500'}
                  style={{ maxWidth: 160 }}
                />

                <button className="cd-btn" type="button" onClick={() => {
                  (async () => {
                    if (!reservaId) return alert('No hay reservaId');
                    try {
                          const hayProductosConDescuento =
                          Object.values(discountItems).some(v => v === true);

                        if (!hayProductosConDescuento) {
                          alert('Debes seleccionar al menos un producto para aplicar descuento.');
                          return;
                        }

                      const res = await fetch(`${API_BASE_URL}/reservas/${reservaId}/precios`, {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                        descuento: {
                          tipo: descTipo,
                          valor: Number(descValor) || 0
                        },
                        discountItems
                      })
                      });
                      if (!res.ok) throw new Error(`HTTP ${res.status}`);
                      alert('Descuento guardado');
                    } catch (e) {
                      console.error(e); alert('No se pudo guardar el descuento');
                    }
                  })();
                }}>
                  Guardar descuento
                </button>
              </div>

              <div style={{ display: 'grid', rowGap: 6, marginBottom: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Subtotal</span>
                  <strong>{money(subTotalUI)}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#dc2626' }}>
                  <span>
                    {descTipo === 'porcentaje'
                    ? `Descuento (${Number(descValor) || 0}%) en productos seleccionados`
                    : 'Descuento en productos seleccionados'}

                  </span>
                  <strong>- {money(descuentoMonto)}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 16 }}>
                  <span>Total</span>
                 <strong>{money(totalConDescuento)}</strong>
                </div>
              </div>
            </>
          )}

          <button
            className="save"
            disabled={saving || Object.values(seleccion).length === 0}
            onClick={finalizarReserva}
          >
            {saving ? 'Guardando…' : 'Finalizar Reserva'}
          </button>

          <button
              className="pdf"
              type="button"
              onClick={async () => {
                if (!reservaId) return alert('No hay reservaId');
                const url = `${API_BASE_URL}/reservas/${reservaId}/pdf`;
                window.open(url, '_blank');

                // Refrescar historial de recibos
                try {
                  const rr = await fetch(`${API_BASE_URL}/reservas/${reservaId}/receipts`);
                  if (rr.ok) {
                    const list = await rr.json();
                    setReceipts(Array.isArray(list) ? list : (list.items || []));
                  }
                } catch (e) {
                  console.error('refresh receipts', e);
                }
              }}
            >
              Descargar PDF
            </button>

            <button
              className="pdf"
              type="button"
              style={{ background: '#7c3aed', color: '#fff', marginTop: 8 }}
              onClick={() => {
                console.log('click invitaciones', reservaId);
                abrirModalInvitaciones(reservaId);
              }}
            >
              Invitaciones QR
            </button>



          {isStaff && (
            <div style={{ marginTop: 8, display: 'block', flexDirection: 'column', gap: 6, }}>
              <button
                className="pdf"
                type="button"
                style={{ background: '#6d28d9', color: '#fff' }}
                onClick={openReceiptModalPrefill}
                title="Generar recibo a partir de esta selección"
              >
                Generar recibo
              </button>

              <button
                className="pdf"
                type="button"
                style={{ background: '#0f766e', color: '#fff' }}
                onClick={() => setShowHistoryModal(true)}
                title="Ver historial de pagos / recibos de esta reserva"
              >
                Ver historial de recibos
              </button>

              <button
                className="pdf"
                type="button"
                onClick={cargarHistorial}
              >
                Ver historial de cambios
              </button>
            </div>
          )}

        </div>

        {/* ACCESORIOS */}
        <div className="cd-card">
          <h3>Accesorios (préstamo)</h3>
          {loadingAcc ? (
            <div className="empty">Cargando accesorios…</div>
          ) : accesorios.length === 0 ? (
            <div className="empty">No hay accesorios disponibles.</div>
          ) : (
            <div className="inventory-grid">
              {accesorios.map(acc => {
                const qty = selAccesorios[acc._id] || 0;
                const stock = Number(acc.stock ?? 0);
                const agotado = stock <= 0;
                return (
                  <div key={acc._id} className="item-card">
                    <img
                      className="item-img"
                      src={resolveImg(acc.imagen)}
                      alt={acc.nombre}
                      onError={(e) => { e.currentTarget.src = PLACEHOLDER; }}
                    />
                    <div>
                      <h4 className="item-title">{acc.nombre}</h4>
                      <div className="item-meta">
                        <span className="badge">{acc.categoria || 'Accesorio'}</span>
                        <span className={`badge ${agotado ? 'out' : stock < 10 ? 'warn' : 'ok'}`}>
                          Stock: {stock} {acc.unidad || 'pza'}
                        </span>
                      </div>

                      <div className="item-actions">
                        <div className="qty">
                          <button onClick={() => setQtyAcc(acc, Math.max(0, qty - 1))} disabled={qty <= 0}>−</button>
                          <input
                            type="number"
                            min="0"
                            max={stock}
                            value={qty}
                            onChange={(e) => setQtyAcc(acc, Number(e.target.value))}
                          />
                          <button onClick={() => setQtyAcc(acc, Math.min(qty + 1, stock))} disabled={qty >= stock}>+</button>
                        </div>
                        <button
                          className="add-btn"
                          onClick={() => setQtyAcc(acc, Math.min((qty || 0) + 1, stock))}
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
      </div>

      {/* MODAL SOLO ACCESORIOS */}
      {showAccModal && (
        <div
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,.35)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
          }}
          onClick={() => setShowAccModal(false)}
        >
          <div
            style={{ background: '#fff', width: 'min(720px, 96%)', borderRadius: 12, padding: 16, maxHeight: '80vh', overflow: 'auto' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom: 8 }}>
              <h3 style={{ margin: 0 }}>Accesorios seleccionados</h3>
              <button className="del" onClick={() => setShowAccModal(false)}>Cerrar</button>
            </div>

            {accesoriosSeleccionados.length === 0 ? (
              <div className="empty">Sin accesorios seleccionados.</div>
            ) : (
              <div style={{ display:'grid', rowGap:10 }}>
                {accesoriosSeleccionados.map(acc => (
                  <div key={acc.accesorioId} className="sel-item">
                    <div style={{ display:'flex', gap:12, alignItems:'center' }}>
                      <img
                        src={resolveImg(acc.imagen)}
                        alt=""
                        style={{ width:44, height:44, objectFit:'cover', borderRadius:8 }}
                        onError={(e)=>{e.currentTarget.src=PLACEHOLDER;}}
                      />
                      <div>
                        <strong>{acc.nombre}</strong>
                        <div className="small">
                          <small>
                            {acc.cantidad} {acc.unidad} • {acc.categoria} • préstamo ($0)
                          </small>
                          {Number(acc.precioReposicion) > 0 && (
                            <div><small>Reposición: ${acc.precioReposicion.toFixed(2)}</small></div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div style={{ display:'flex', justifyContent:'flex-end', gap:8, marginTop:16 }}>
              <button className="cd-btn cd-btn-clear" onClick={()=>setShowAccModal(false)}>Cancelar</button>
              <button className="cd-btn" onClick={aplicarAccesorios}>Guardar en reserva</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Generar Recibo (solo staff) */}
      {showReceiptModal && isStaff && (
        <div
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,.35)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100
          }}
          onClick={() => setShowReceiptModal(false)}
        >
          <div
            style={{ background:'#fff', width:'min(760px, 96%)', borderRadius:12, padding:16, maxHeight:'82vh', overflow:'auto' }}
            onClick={(e)=>e.stopPropagation()}
          >
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
              <h3 style={{ margin: 0 }}>Generar recibo</h3>
              <button className="del" onClick={() => setShowReceiptModal(false)}>Cerrar</button>
            </div>

            <div className="small" style={{ marginBottom: 12, color:'#555' }}>
              <div>Reserva: <strong>{reservaId || '—'}</strong></div>
              <div>Emisor: <strong>{me?.email || me?.name || 'sistema'}</strong></div>
              <div>Total actual (con descuento): <strong>${totalConDescuento.toFixed(2)}</strong></div>
            </div>

            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
              <div>
                <label>Cliente</label>
                <input
                  className="cd-input"
                  value={receiptForm.customerName}
                  onChange={(e)=>setReceiptForm(s=>({...s, customerName:e.target.value}))}
                  placeholder="Nombre del cliente"
                />
              </div>
              <div>
                <label>Fecha (YYYY-MM-DD)</label>
                <input
                  className="cd-input"
                  value={receiptForm.issuedAt}
                  onChange={(e)=>setReceiptForm(s=>({...s, issuedAt:e.target.value}))}
                  placeholder={todayStr}
                />
              </div>
              <div>
                <label>Concepto</label>
                <input
                  className="cd-input"
                  value={receiptForm.concept}
                  onChange={(e)=>setReceiptForm(s=>({...s, concept:e.target.value}))}
                  placeholder={`Renta/servicio – Reserva ${reservaId || ''}`}
                />
              </div>
              <div>
                <label>Método de pago</label>
                <select
                  className="cd-select"
                  value={receiptForm.paymentMethod}
                  onChange={(e)=>setReceiptForm(s=>({...s, paymentMethod:e.target.value}))}
                >
                  <option value="EFECTIVO">EFECTIVO</option>
                  <option value="TARJETA">TARJETA</option>
                  <option value="TRANSFERENCIA">TRANSFERENCIA</option>
                  <option value="OTRO">OTRO</option>
                </select>
              </div>
              <div>
                <label>Moneda</label>
                <select
                  className="cd-select"
                  value={receiptForm.currency}
                  onChange={(e)=>setReceiptForm(s=>({...s, currency:e.target.value}))}
                >
                  <option value="MXN">MXN</option>
                  <option value="USD">USD</option>
                </select>
              </div>
              <div>
                <label>IVA / Tasa impuesto</label>
                <input
                  className="cd-input"
                  type="number"
                  step="0.01"
                  min="0"
                  max="1"
                  value={receiptForm.taxRate}
                  onChange={(e)=>setReceiptForm(s=>({...s, taxRate:Number(e.target.value || 0)}))}
                  placeholder="0.16"
                />
                <small className="small">Ejemplo: 0.16 = 16%</small>
              </div>

              <div>
                <label>Monto a cobrar ahora</label>
                <input
                  className="cd-input"
                  type="number"
                  step="0.01"
                  min="0"
                  max={Math.max(0, saldoRestante)}
                  value={paymentAmount}
                  onChange={(e)=> {
                    const v = Number(e.target.value || 0);
                    // clamp para no pasar del saldo
                    setPaymentAmount(Math.max(0, Math.min(v, Math.max(0, saldoRestante))));
                  }}
                  placeholder={saldoRestante.toFixed(2)}
                />
                <small className="small">
                  Saldo restante actual: <strong>{money(saldoRestante)}</strong> (Total: ${totalConDescuento.toFixed(2)} • Pagado: ${totalPagado.toFixed(2)})
                </small>
              </div>

              <div style={{ gridColumn:'1 / -1' }}>
                <label style={{ fontSize: '17px', fontWeight: '700' }}>Notas</label>
                <input
                  className="cd-input"
                  value={receiptForm.notes}
                  onChange={(e)=>setReceiptForm(s=>({...s, notes:e.target.value}))}
                  placeholder="Observaciones"
                />
              </div>
            </div>

            <div style={{ marginTop: 14 }}>
              <h4 style={{ marginBottom: 6 }}>Artículos del recibo</h4>
              {Object.values(seleccion).length === 0 ? (
                <div className="empty">No hay artículos seleccionados.</div>
              ) : (
                <div style={{ border:'1px solid #eee', borderRadius:8, padding:10 }}>
                  {Object.values(seleccion).map(({ item, qty }) => {
                    const p = priceFor(item.id);
                    return (
                      <div key={item.id} className="sel-item">
                        <div><strong>{item.nombre}</strong> <small>• {item.categoria}</small></div>
                        <div className="small">
                          {qty} {item.unidad || 'pza'} × ${p.toFixed(2)} = <strong>${(qty*p).toFixed(2)}</strong>
                        </div>
                      </div>
                    );
                  })}
                  <div style={{ display:'flex', justifyContent:'space-between', marginTop:8 }}>
                    <span>Subtotal estimado</span>
                    <strong>{money(subTotalUI)}</strong>
                  </div>
                  <div style={{ display:'flex', justifyContent:'space-between', color:'#dc2626' }}>
                    <span>Descuento aplicado</span>
                    <strong>- ${descuentoMonto.toFixed(2)}</strong>
                  </div>
                  <div style={{ display:'flex', justifyContent:'space-between', fontSize:16 }}>
                    <span>Total estimado</span>
                    <strong>${totalConDescuento.toFixed(2)}</strong>
                  </div>
                </div>
              )}
            </div>


            {/*<div style={{ marginTop: 16 }}>
  <h4 style={{ marginBottom: 8 }}>Historial de recibos</h4>
  {loadingReceipts ? (
    <div className="empty">Cargando historial…</div>
  ) : (receipts || []).length === 0 ? (
    <div className="empty">Aún no hay pagos registrados.</div>
  ) : (
    <div style={{ border:'1px solid #eee', borderRadius:8, overflow:'hidden' }}>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr 1fr', fontWeight:600, padding:'8px 10px', background:'#fafafa' }}>
        <div>Fecha</div><div>Método</div><div>Folio</div><div>Monto</div>
      </div>
      {(receipts || []).map((rc) => (
  <div
    key={rc._id}
    onDoubleClick={() => openReceiptPdfById(rc._id)}     // ⬅️ doble click abre PDF
    role="button"
    tabIndex={0}
    title="Doble click para abrir el PDF del recibo"
    onKeyDown={(e) => { if (e.key === 'Enter') openReceiptPdfById(rc._id); }} // accesible con Enter
    style={{
      display:'grid',
      gridTemplateColumns:'1fr 1fr 1fr 1fr',
      padding:'8px 10px',
      borderTop:'1px solid #eee',
      cursor:'pointer',                                   // feedback visual
      userSelect:'none'
    }}
  >
    <div>{rc.issuedAt ? new Date(rc.issuedAt).toLocaleString('es-MX') : '—'}</div>
    <div>{rc.paymentMethod || '—'}</div>
    <div>{rc.folio || rc._id?.slice(-6)?.toUpperCase() || '—'}</div>
    <div>${Number(rc.amount || 0).toFixed(2)}</div>
  </div>
))}

      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr 1fr', padding:'10px', background:'#fafafa', borderTop:'1px solid #eee' }}>
        <div style={{ gridColumn:'1 / 3' }}><strong>Totales</strong></div>
        <div><strong>Pagado:</strong></div>
        <div><strong>${totalPagado.toFixed(2)}</strong></div>
      </div>
    </div>
  )}
</div>*/}


            <div style={{ display:'flex', justifyContent:'flex-end', gap:8, marginTop:16 }}>
              <button className="cd-btn cd-btn-clear" onClick={()=>setShowReceiptModal(false)}>Cancelar</button>
              <button className="cd-btn" onClick={submitReceipt}>Generar y abrir PDF</button>
            </div>
          </div>
        </div>
      )}

      {showHistorial && (
  <div className="modal-overlay">
    <div className="modal-content">
      <h2>Historial de cambios</h2>

      {historial.length === 0 && <p>No hay cambios registrados.</p>}

      {historial.map((h) => (
        <div key={h._id} className="historial-item">
          <strong>{formatearCambio(h)}</strong>

          <div>
            Antes: {h.tipo === 'descuento'
              ? `$${h.descuentoAntes}`
              : h.cantidadAntes}
          </div>

          <div>
            Después: {h.tipo === 'descuento'
              ? `$${h.descuentoDespues}`
              : h.cantidadDespues}
          </div>

          <div style={{ fontSize: '12px', color: '#666' }}>
            {new Date(h.fecha).toLocaleString()}
          </div>
        </div>
      ))}

      <button onClick={() => setShowHistorial(false)}>
        Cerrar
      </button>
    </div>
  </div>
)}


      {/* MODAL: Historial de Recibos (solo staff) */}
      {showHistoryModal && isStaff && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,.35)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1150
          }}
          onClick={() => setShowHistoryModal(false)}
        >
          <div
            style={{
              background: '#fff',
              width: 'min(720px, 96%)',
              borderRadius: 12,
              padding: 16,
              maxHeight: '80vh',
              overflow: 'auto'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 8
              }}
            >
              <h3 style={{ margin: 0 }}>Historial de recibos</h3>
              <button className="del" onClick={() => setShowHistoryModal(false)}>
                Cerrar
              </button>
            </div>

            <div className="small" style={{ marginBottom: 10, color: '#555' }}>
              <div>
                Reserva: <strong>{reservaId || '—'}</strong>
              </div>
              <div>
                Total con descuento: <strong>${totalConDescuento.toFixed(2)}</strong>
              </div>
              <div>
                Total pagado: <strong>${totalPagado.toFixed(2)}</strong>
              </div>
              <div>
                Saldo restante: <strong>{money(saldoRestante)}</strong>
              </div>
            </div>

            {loadingReceipts ? (
              <div className="empty">Cargando historial…</div>
            ) : (receipts || []).length === 0 ? (
              <div className="empty">Aún no hay pagos registrados.</div>
            ) : (
              <div style={{ border: '1px solid #eee', borderRadius: 8, overflow: 'hidden' }}>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr 1fr 1fr',
                    fontWeight: 600,
                    padding: '8px 10px',
                    background: '#fafafa'
                  }}
                >
                  <div>Fecha</div>
                  <div>Método</div>
                  <div>Folio</div>
                  <div>Monto</div>
                </div>

                {(receipts || []).map((rc) => (
        <div
          key={rc._id}
          onDoubleClick={() => openReceiptPdfById(rc._id)}
          role="button"
          tabIndex={0}
          title="Doble click para abrir el PDF del recibo"
          onKeyDown={(e) => {
            if (e.key === 'Enter') openReceiptPdfById(rc._id);
          }}
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr 1fr 1fr',
            padding: '8px 10px',
            borderTop: '1px solid #eee',
            cursor: 'pointer',
            userSelect: 'none'
          }}
        >
          <div>{rc.issuedAt ? new Date(rc.issuedAt).toLocaleString('es-MX') : '—'}</div>
          <div>{rc.paymentMethod || '—'}</div>
          <div>{rc.folio || rc._id?.slice(-6)?.toUpperCase() || '—'}</div>

          {/* Columna monto + botón eliminar */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
            <span>{money(rc.amount)}</span>
            <button
              type="button"
              className="del"
              style={{ fontSize: 11, padding: '2px 8px' }}
              onClick={(e) => {
                e.stopPropagation();           // para que no dispare el doble click de abrir PDF
                deleteReceiptById(rc._id);
              }}
            >
              Eliminar
            </button>
          </div>
        </div>
      ))}


                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr 1fr 1fr',
                    padding: '10px',
                    background: '#fafafa',
                    borderTop: '1px solid #eee'
                  }}
                >
                  <div style={{ gridColumn: '1 / 3' }}>
                    <strong>Totales</strong>
                  </div>
                  <div>
                    <strong>Pagado:</strong>
                  </div>
                  <div>
                    <strong>{money(totalPagado)}</strong>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL: Invitaciones QR */}
      <ModalAccesoInvitaciones
        open={showModalInvitaciones}
        onClose={() => setShowModalInvitaciones(false)}
        reservaId={reservaSeleccionadaId}
      />


    </div>
  );
};

export default DashboardCliente;
