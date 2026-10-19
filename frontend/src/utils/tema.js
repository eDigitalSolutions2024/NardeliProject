// Tema claro/oscuro: la preferencia se guarda en el navegador. El atributo data-theme="dark" en <html>
// solo está puesto mientras se ve una pantalla interna del sistema (Dashboard, Panel del Cliente, Cotizador).
import { useEffect, useState, useCallback } from 'react';

const KEY = 'nardeli_tema';

// Interruptor general: con false el tema oscuro queda apagado y sus botones ocultos (el código se conserva).
export const TEMA_OSCURO_ACTIVO = false;

const leer = () => {
  if (!TEMA_OSCURO_ACTIVO) return 'claro';
  try { return localStorage.getItem(KEY) === 'oscuro' ? 'oscuro' : 'claro'; } catch { return 'claro'; }
};

export function useTema() {
  const [tema, setTema] = useState(leer);
  useEffect(() => {
    const root = document.documentElement;
    if (tema === 'oscuro') root.setAttribute('data-theme', 'dark'); else root.removeAttribute('data-theme');
    return () => root.removeAttribute('data-theme'); // las pantallas públicas siempre en claro
  }, [tema]);
  const alternar = useCallback(() => {
    setTema((t) => {
      const n = t === 'oscuro' ? 'claro' : 'oscuro';
      try { localStorage.setItem(KEY, n); } catch { /* sin almacenamiento */ }
      return n;
    });
  }, []);
  return [tema, alternar];
}
