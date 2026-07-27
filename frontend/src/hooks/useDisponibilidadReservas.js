import { useCallback, useMemo, useRef, useState } from 'react';
import API_BASE_URL from '../api';

const pad2 = (n) => String(n).padStart(2, '0');
const monthKey = (year, month) => `${year}-${pad2(month + 1)}`; // month: 0-11
const fmtYmd = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;

function rangoDelMes(year, month) {
  const desde = new Date(year, month, 1);
  const hasta = new Date(year, month + 1, 0);
  return { desde: fmtYmd(desde), hasta: fmtYmd(hasta) };
}

// Cachea por mes ("YYYY-MM") las fechas ocupadas/cotizadas que reporta el backend,
// para no volver a pedir un mes ya cargado cada vez que el usuario cambia de día.
export default function useDisponibilidadReservas() {
  const cacheRef = useRef(new Map());
  const inFlightRef = useRef(new Map());
  const [version, setVersion] = useState(0);

  const cargarMes = useCallback((year, month) => {
    const key = monthKey(year, month);

    if (cacheRef.current.has(key)) return Promise.resolve(cacheRef.current.get(key));
    if (inFlightRef.current.has(key)) return inFlightRef.current.get(key);

    const { desde, hasta } = rangoDelMes(year, month);
    const promesa = fetch(`${API_BASE_URL}/reservas/disponibilidad?desde=${desde}&hasta=${hasta}`)
      .then((r) => (r.ok ? r.json() : { fechas: [] }))
      .then((data) => (Array.isArray(data?.fechas) ? data.fechas : []))
      .catch(() => [])
      .then((fechas) => {
        cacheRef.current.set(key, fechas);
        inFlightRef.current.delete(key);
        setVersion((v) => v + 1);
        return fechas;
      });

    inFlightRef.current.set(key, promesa);
    return promesa;
  }, []);

  // Precarga el mes indicado y los siguientes `meses` (para navegación fluida del calendario).
  const precargarDesde = useCallback((year, month, meses = 2) => {
    for (let i = 0; i <= meses; i++) {
      const d = new Date(year, month + i, 1);
      cargarMes(d.getFullYear(), d.getMonth());
    }
  }, [cargarMes]);

  const porFecha = useMemo(() => {
    const map = new Map();
    for (const fechas of cacheRef.current.values()) {
      for (const item of fechas) {
        const lista = map.get(item.fecha) || [];
        lista.push(item);
        map.set(item.fecha, lista);
      }
    }
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [version]);

  const estadoFecha = useCallback((fechaStr, excluirId = null) => {
    const items = (porFecha.get(fechaStr) || []).filter(
      (i) => !excluirId || String(i.id) !== String(excluirId)
    );
    const evento = items.find((i) => i.ocupaFecha);
    return {
      ocupado: !!evento,
      evento: evento || null,
      cotizaciones: items.filter((i) => !i.ocupaFecha),
    };
  }, [porFecha]);

  return { cargarMes, precargarDesde, porFecha, estadoFecha };
}
