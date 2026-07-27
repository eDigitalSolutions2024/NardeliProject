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

function timeToMinutes(t) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(t || '').trim());
  if (!m) return NaN;
  return Number(m[1]) * 60 + Number(m[2]);
}

function overlap(s1, e1, s2, e2) {
  if ([s1, e1, s2, e2].some((x) => !Number.isFinite(x))) return false;
  return Math.max(s1, s2) < Math.min(e1, e2);
}

// Cachea por mes ("YYYY-MM") las fechas con eventos/cotizaciones que reporta el
// backend, para no volver a pedir un mes ya cargado cada vez que el usuario
// cambia de día u horario.
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

  // Un evento solo "ocupa" el horario indicado si se traslapa con el suyo;
  // si no se pasa horaInicio/horaFin todavía no se puede saber si hay choque.
  // Las cotizaciones siempre se devuelven aparte, solo como referencia.
  const estadoFecha = useCallback((fechaStr, { horaInicio, horaFin, excluirId = null } = {}) => {
    const items = (porFecha.get(fechaStr) || []).filter(
      (i) => !excluirId || String(i.id) !== String(excluirId)
    );
    const eventos = items.filter((i) => i.esEvento);
    const cotizaciones = items.filter((i) => !i.esEvento);

    let conflicto = null;
    if (horaInicio && horaFin) {
      const ini = timeToMinutes(horaInicio);
      const fin = timeToMinutes(horaFin);
      conflicto = eventos.find((e) =>
        overlap(ini, fin, timeToMinutes(e.horaInicio), timeToMinutes(e.horaFin))
      ) || null;
    }

    return { eventos, cotizaciones, conflicto, ocupado: !!conflicto };
  }, [porFecha]);

  return { cargarMes, precargarDesde, porFecha, estadoFecha };
}
