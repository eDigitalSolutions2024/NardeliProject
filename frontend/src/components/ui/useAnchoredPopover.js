import { useEffect, useLayoutEffect, useRef, useState } from 'react';

// Posiciona un panel flotante (lista o calendario) pegado a un elemento "ancla".
// Se dibuja con position: fixed (vía portal), así no lo recortan modales ni contenedores con scroll.
// Se abre hacia arriba si abajo no hay espacio. Cierra con clic afuera o Escape.
export default function useAnchoredPopover({ open, onClose, estimatedHeight = 300 }) {
  const anchorRef = useRef(null);
  const popRef = useRef(null);
  const [pos, setPos] = useState(null);

  useLayoutEffect(() => {
    if (!open) { setPos(null); return undefined; }
    const update = (ev) => {
      // un scroll dentro del propio panel (columnas de hora, lista) no debe reposicionarlo
      if (ev && ev.target && popRef.current && popRef.current.contains(ev.target)) return;
      const a = anchorRef.current;
      if (!a) return;
      const r = a.getBoundingClientRect();
      const h = popRef.current?.offsetHeight || estimatedHeight;
      const abajo = window.innerHeight - r.bottom;
      const arriba = r.top;
      const hacia = abajo < h + 12 && arriba > abajo ? 'arriba' : 'abajo';
      setPos({
        left: Math.max(8, Math.min(r.left, window.innerWidth - 8 - (popRef.current?.offsetWidth || r.width))),
        width: r.width,
        top: hacia === 'abajo' ? r.bottom + 6 : undefined,
        bottom: hacia === 'arriba' ? window.innerHeight - r.top + 6 : undefined,
        maxHeight: Math.max(160, (hacia === 'abajo' ? abajo : arriba) - 18),
        hacia,
      });
    };
    update();
    // una segunda pasada, cuando el panel ya existe y se conoce su tamaño real
    const raf = requestAnimationFrame(update);
    window.addEventListener('scroll', update, true);
    window.addEventListener('resize', update);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('scroll', update, true);
      window.removeEventListener('resize', update);
    };
  }, [open, estimatedHeight]);

  useEffect(() => {
    if (!open) return undefined;
    const fuera = (e) => {
      if (popRef.current?.contains(e.target) || anchorRef.current?.contains(e.target)) return;
      onClose();
    };
    const tecla = (e) => { if (e.key === 'Escape') { onClose(); anchorRef.current?.querySelector('button, input')?.focus(); } };
    document.addEventListener('mousedown', fuera);
    document.addEventListener('keydown', tecla);
    return () => {
      document.removeEventListener('mousedown', fuera);
      document.removeEventListener('keydown', tecla);
    };
  }, [open, onClose]);

  return { anchorRef, popRef, pos };
}
