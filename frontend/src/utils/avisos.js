// Avisos del sistema con la apariencia de la marca. Reemplazan a alert(), confirm() y prompt() del navegador.
//   aviso('Texto')                       → mensaje flotante (no bloquea); el tipo se deduce del texto
//   aviso('Texto', 'error')              → 'success' | 'error' | 'warning' | 'info'
//   if (!(await pedirConfirmacion('¿Eliminar…?'))) return;
//   const valor = await pedirValor('Nuevo precio', '10.00');   // null si se cancela
import Swal from 'sweetalert2';
import { toast } from 'sonner';

// quita emojis sueltos del inicio ("✅ Guardado" -> "Guardado")
const limpiar = (m) => String(m ?? '').replace(/^[\p{Extended_Pictographic}️\s]+/u, '').trim();

const tipoDe = (texto) => {
  const t = texto.toLowerCase();
  if (/(no se pudo|no pude|error|fall[oó])/.test(t)) return 'error';
  if (/(debes|ingresa|inv[aá]lid|no hay|a[uú]n no|no se encontr|no puede|mayor|negativ|selecciona|no tiene|no es una)/.test(t)) return 'warning';
  if (/(guardad|eliminad|creado|actualizad|finalizada|convertid|registrado|correctamente|cancelad)/.test(t)) return 'success';
  return 'info';
};

export function aviso(mensaje, tipo) {
  const texto = limpiar(mensaje);
  if (!texto) return;
  const k = tipo || tipoDe(texto);
  const fn = toast[k] || toast;
  fn(texto, { duration: k === 'error' ? 6500 : 4200 });
}

const BASE = {
  confirmButtonColor: '#7b247f',
  cancelButtonColor: '#6b7280',
  reverseButtons: true,
  focusCancel: false,
  customClass: { popup: 'nd-swal-popup' },
  // El z-index (para que no quede detrás de otros modales de la app) se
  // sube por CSS en index.css (`.swal2-container`) — Swal.fire() no tiene
  // una opción "zIndex" real en esta versión, la ignora en silencio.
};

// Devuelve true si la persona confirma.
export async function pedirConfirmacion(mensaje, opciones = {}) {
  const texto = limpiar(mensaje);
  const peligro = opciones.peligro ?? /eliminar|cancelar esta|desactivar|restablecer/i.test(texto);
  const r = await Swal.fire({
    ...BASE,
    icon: peligro ? 'warning' : 'question',
    title: opciones.titulo || (peligro ? '¿Estás seguro?' : 'Confirmar'),
    text: texto,
    showCancelButton: true,
    confirmButtonText: opciones.confirmar || (peligro ? 'Sí, continuar' : 'Aceptar'),
    cancelButtonText: 'Cancelar',
    confirmButtonColor: peligro ? '#c0392b' : '#7b247f',
  });
  return !!r.isConfirmed;
}

// Pide un texto o número. Devuelve el valor escrito, o null si se cancela.
export async function pedirValor(titulo, valorInicial = '', { tipo = 'text', etiqueta } = {}) {
  const r = await Swal.fire({
    ...BASE,
    title: titulo,
    input: tipo,
    inputValue: valorInicial,
    inputLabel: etiqueta,
    inputAttributes: tipo === 'number' ? { step: 'any', min: '0' } : {},
    showCancelButton: true,
    confirmButtonText: 'Aceptar',
    cancelButtonText: 'Cancelar',
    inputValidator: (v) => (v === '' || v == null ? 'Escribe un valor' : undefined),
  });
  return r.isConfirmed ? String(r.value) : null;
}
