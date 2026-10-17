import React from 'react';
import { LuSearch, LuX } from 'react-icons/lu';
import './ui.css';

/**
 * Buscador con ícono y botón para limpiar.
 *
 *   <SearchField value={texto} onChange={setTexto} placeholder="Buscar…" />
 *
 * Props: value, onChange(texto), placeholder, className, size ('md' | 'sm'), autoFocus, aria-label.
 */
export default function SearchField({
  value = '', onChange, placeholder = 'Buscar…', className = '', size = 'md', autoFocus = false, style, 'aria-label': ariaLabel,
}) {
  return (
    <label className={`ui-field ui-search ui-${size} ${className}`.trim()} style={style}>
      <LuSearch className="ui-lead" aria-hidden="true" />
      <input
        type="text"
        className="ui-search-input"
        value={value}
        placeholder={placeholder}
        autoFocus={autoFocus}
        aria-label={ariaLabel || placeholder}
        onChange={(e) => onChange?.(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Escape' && value) { e.stopPropagation(); onChange?.(''); } }}
      />
      {value ? (
        <button type="button" className="ui-clear" onClick={() => onChange?.('')} aria-label="Limpiar búsqueda" title="Limpiar">
          <LuX />
        </button>
      ) : null}
    </label>
  );
}
