// Dirección del backend Express en tu red local.
// El emulador/celular NO puede usar "localhost" (eso apuntaría al propio
// celular), necesita la IP de la compu donde corre `node index.js`.
//
// Para cambiarla rápido sin editar código, corre Expo así:
//   EXPO_PUBLIC_API_URL=http://TU_IP:8020/api npx expo start
//
// TU_IP la ves con `ipconfig` (Windows) en la sección de tu red Wi-Fi
// ("Dirección IPv4"). El backend ya tiene esa IP habilitada en CORS
// (ver backend/index.js -> allowedOrigins), pero eso no aplica a apps
// nativas: solo asegúrate de que el celular y la compu estén en la
// misma red Wi-Fi y que el firewall no bloquee el puerto 8020.

const FALLBACK_LAN_IP = '192.168.1.90';

export const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_URL || `http://${FALLBACK_LAN_IP}:8020/api`;

// Origen del backend sin el sufijo /api, para armar URLs de imágenes
// que el servidor devuelve como rutas relativas (p. ej. /api/media/...).
export const API_ORIGIN = API_BASE_URL.replace(/\/api\/?$/, '');
