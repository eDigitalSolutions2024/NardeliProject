// Formatea una fecha/hora del servidor en la zona horaria del salón
// (Ciudad Juárez), sin depender de la hora local del celular. Se arma a
// mano a partir de Intl.DateTimeFormat en vez de toLocaleString() directo
// porque el separador y el "a. m./p. m." varían entre motores JS.
export function formatUploadedAt(date) {
  if (!date) return '';
  const d = new Date(date);
  if (isNaN(d.getTime())) return '';

  const parts = new Intl.DateTimeFormat('es-MX', {
    timeZone: 'America/Ciudad_Juarez',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).formatToParts(d);

  const get = (type) => parts.find((p) => p.type === type)?.value || '';
  const day = get('day');
  const month = get('month');
  const year = get('year');
  const hour = get('hour');
  const minute = get('minute');
  const meridiem = get('dayPeriod').toLowerCase().startsWith('a') ? 'a.m.' : 'p.m.';

  return `${day}/${month}/${year} ${hour}:${minute} ${meridiem}`;
}
