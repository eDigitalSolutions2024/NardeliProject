import React, { useEffect, useMemo, useRef } from 'react';
import './Sparkles.css';

const COLORES = ['#f7e0a5', '#ffffff', '#c9b3e6', '#f7e0a5'];

const reducirMovimiento = () =>
  typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

// Destellos que suben y se desvanecen. Usa la API nativa de animaciones del navegador (element.animate) con
// solo transform + opacity, así corren en la GPU y casi no gastan CPU. Se colocan sobre un contenedor relativo.
export default function Sparkles({ count = 24 }) {
  const ref = useRef(null);
  const items = useMemo(
    () => Array.from({ length: count }, (_, i) => ({
      id: i,
      left: Math.random() * 100,
      top: 8 + Math.random() * 84,
      size: 2 + Math.random() * 5,
      color: COLORES[i % COLORES.length],
    })),
    [count]
  );

  useEffect(() => {
    const root = ref.current;
    if (!root || reducirMovimiento() || !root.firstChild?.animate) return undefined;
    const animaciones = Array.from(root.children).map((el) => {
      const dur = 5000 + Math.random() * 6000;
      const dx = (Math.random() - 0.5) * 80;
      const dy = -(70 + Math.random() * 140);
      return el.animate(
        [
          { opacity: 0, transform: 'translate3d(0, 0, 0) scale(0.5)' },
          { opacity: 0.95, offset: 0.35 },
          { opacity: 0, transform: `translate3d(${dx}px, ${dy}px, 0) scale(1.3)` },
        ],
        { duration: dur, delay: -Math.random() * dur, iterations: Infinity, easing: 'ease-in-out' }
      );
    });
    return () => animaciones.forEach((a) => a.cancel());
  }, [items]);

  return (
    <div className="fx-sparkles" ref={ref} aria-hidden="true">
      {items.map((p) => (
        <span
          key={p.id}
          className="fx-sparkle"
          style={{ left: `${p.left}%`, top: `${p.top}%`, width: p.size, height: p.size, color: p.color }}
        />
      ))}
    </div>
  );
}
