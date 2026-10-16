import React, { useEffect, useMemo, useRef } from 'react';
import { animate, stagger } from 'animejs';
import './OvalosFlotantes.css';

const reducirMovimiento = () =>
  typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

// Tres capas de profundidad: las lejanas son chicas y poco visibles, las cercanas grandes y desenfocadas.
// `depth` es cuánto se desplazan con el mouse (parallax, lo controla --mx/--my del padre).
const CAPAS = [
  { depth: 6,  count: 9, size: [18, 38], alpha: [0.18, 0.34], blur: 0 },
  { depth: 14, count: 7, size: [38, 66], alpha: [0.16, 0.3],  blur: 1 },
];
const TONOS = [
  ['#f7e0a5', '#d9b45a'],
  ['#e9d6f5', '#a58ebf'],
  ['#ffffff', '#c9b3e6'],
  ['#c98bd0', '#7b247f'],
];

const rango = ([a, b]) => a + Math.random() * (b - a);

// Óvalos (la forma de la marca) que flotan, giran y respiran, con parallax al mover el mouse.
export default function OvalosFlotantes() {
  const ref = useRef(null);
  const capas = useMemo(
    () => CAPAS.map((c) => ({
      ...c,
      items: Array.from({ length: c.count }, (_, i) => {
        const tono = TONOS[Math.floor(Math.random() * TONOS.length)];
        return {
          id: i,
          left: 4 + Math.random() * 92,
          top: 4 + Math.random() * 92,
          w: rango(c.size),
          rot: Math.random() * 180,
          alpha: rango(c.alpha),
          claro: tono[0],
          oscuro: tono[1],
        };
      }),
    })),
    []
  );

  useEffect(() => {
    const root = ref.current;
    if (!root || reducirMovimiento()) return undefined;
    const animaciones = [];

    // entrada: los óvalos brotan escalonados desde el centro
    const entrada = root.querySelectorAll('.ovalo');
    entrada.forEach((el) => { el.style.opacity = 0; });
    animaciones.push(
      animate(entrada, {
        opacity: [0, 1],
        scale: [0, 1],
        duration: 900,
        delay: stagger(60, { from: 'center', start: 500 }),
        ease: 'outBack',
      })
    );

    // movimiento continuo e independiente de cada óvalo, con la API nativa (transform solo: va por la GPU)
    root.querySelectorAll('.ovalo-cuerpo').forEach((el) => {
      const dx = (Math.random() - 0.5) * 36;
      const dy = (Math.random() > 0.5 ? -1 : 1) * (18 + Math.random() * 40);
      const dr = (Math.random() - 0.5) * 70;
      const ds = 0.88 + Math.random() * 0.3;
      const flota = el.animate(
        [
          { transform: 'translate3d(0, 0, 0) rotate(0deg) scale(1)' },
          { transform: `translate3d(${dx}px, ${dy}px, 0) rotate(${dr}deg) scale(${ds})` },
        ],
        {
          duration: 4000 + Math.random() * 5000,
          delay: Math.random() * 1500,
          iterations: Infinity,
          direction: 'alternate',
          easing: 'ease-in-out',
          fill: 'both',
        }
      );
      animaciones.push({ pause: () => flota.cancel() });
    });

    return () => animaciones.forEach((a) => a.pause());
  }, [capas]);

  return (
    <div className="ovalos-flotantes" ref={ref} aria-hidden="true">
      {capas.map((capa, i) => (
        <div key={i} className="ovalos-capa" style={{ '--depth': capa.depth }}>
          {capa.items.map((o) => (
            <span key={o.id} className="ovalo" style={{ left: `${o.left}%`, top: `${o.top}%`, width: o.w, height: o.w * 0.64 }}>
              <span
                className="ovalo-cuerpo"
                style={{
                  opacity: o.alpha / 0.34,
                  rotate: `${o.rot}deg`,
                  background: `radial-gradient(circle at 35% 30%, ${o.claro}, ${o.oscuro})`,
                }}
              />
            </span>
          ))}
        </div>
      ))}
    </div>
  );
}
