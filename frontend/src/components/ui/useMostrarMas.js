import { useEffect, useState } from 'react';

const TELEFONO = '(max-width: 640px)';

/**
 * Limita una lista a unos cuantos elementos en teléfono, con un botón "Mostrar más".
 * En pantallas grandes devuelve la lista completa (no cambia nada).
 *
 *   const m = useMostrarMas(lista);          // 5 por tanda
 *   m.visibles.map(...)  +  <MostrarMas m={m} />
 *
 * Al cambiar la lista (por ejemplo al buscar o filtrar) vuelve a mostrar solo los primeros.
 */
export default function useMostrarMas(lista, paso = 5) {
  const [esTelefono, setEsTelefono] = useState(() => !!window.matchMedia?.(TELEFONO).matches);
  const [limite, setLimite] = useState(paso);

  useEffect(() => {
    const mq = window.matchMedia?.(TELEFONO);
    if (!mq) return undefined;
    const cambio = (e) => setEsTelefono(e.matches);
    mq.addEventListener?.('change', cambio);
    return () => mq.removeEventListener?.('change', cambio);
  }, []);

  const total = lista.length;
  const huella = `${total}|${lista[0]?.id ?? lista[0]?._id ?? ''}`;
  useEffect(() => { setLimite(paso); }, [huella, paso]);

  const visibles = esTelefono ? lista.slice(0, limite) : lista;
  return {
    visibles,
    activo: esTelefono && total > paso,
    restantes: Math.max(0, total - visibles.length),
    total,
    paso,
    puedeOcultar: esTelefono && limite > paso,
    mostrarMas: () => setLimite((l) => l + paso),
    mostrarMenos: () => setLimite(paso),
  };
}
