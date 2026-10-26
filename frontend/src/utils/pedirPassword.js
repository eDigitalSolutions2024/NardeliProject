import Swal from 'sweetalert2';

// Pide la contraseña de administrador en un cuadro con el campo OCULTO (los puntos no dejan
// ver lo que se escribe). Reemplaza a window.prompt, que mostraba el texto tal cual.
// Devuelve la contraseña escrita, o null si la persona cancela.
export async function pedirPasswordAdmin(mensaje) {
  const { value, isConfirmed } = await Swal.fire({
    icon: 'warning',
    title: 'Contraseña de administrador',
    text: mensaje || 'Ingresa la contraseña de un administrador para continuar.',
    input: 'password',
    inputPlaceholder: 'Contraseña de administrador',
    inputAttributes: { autocapitalize: 'off', autocomplete: 'new-password', spellcheck: 'false' },
    showCancelButton: true,
    confirmButtonText: 'Continuar',
    cancelButtonText: 'Cancelar',
    confirmButtonColor: '#7b247f',
    inputValidator: (v) => (!v || !String(v).trim() ? 'Debes ingresar una contraseña' : undefined),
    // El z-index se sube por CSS en index.css (`.swal2-container`), no aquí
    // — Swal.fire() no tiene una opción "zIndex" real en esta versión.
  });
  return isConfirmed ? value : null;
}
