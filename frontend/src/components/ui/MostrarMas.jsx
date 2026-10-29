import React from 'react';
import { LuChevronDown, LuChevronUp } from 'react-icons/lu';

/** Botones "Mostrar más / Mostrar menos" para listas limitadas con useMostrarMas (solo se ven en teléfono). */
export default function MostrarMas({ m }) {
  if (!m?.activo) return null;
  return (
    <div className="ui-mostrar-mas">
      {m.restantes > 0 && (
        <button type="button" className="ui-mostrar-mas-btn" onClick={m.mostrarMas}>
          <LuChevronDown aria-hidden="true" />
          Mostrar más <span>({Math.min(m.paso, m.restantes)} de {m.restantes} restantes)</span>
        </button>
      )}
      {m.restantes === 0 && m.puedeOcultar && (
        <button type="button" className="ui-mostrar-mas-btn ui-mostrar-menos" onClick={m.mostrarMenos}>
          <LuChevronUp aria-hidden="true" /> Mostrar menos
        </button>
      )}
    </div>
  );
}
