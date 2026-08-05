// Dirección del backend. Por defecto apunta al sistema real en producción,
// así la app funciona en cualquier red (no depende de tu compu ni de estar
// en el mismo Wi-Fi).
//
// Para probar contra tu backend local en su lugar, corre Expo así:
//   EXPO_PUBLIC_API_URL=http://TU_IP:8020/api npx expo start
// (TU_IP la ves con `ipconfig` en la sección de tu red Wi-Fi; el celular y
// la compu deben estar en la misma red y el firewall no debe bloquear el
// puerto 8020).

const PRODUCTION_API_URL = 'https://www.sistemanardeli.com/api';

export const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || PRODUCTION_API_URL;

// Origen del backend sin el sufijo /api, para armar URLs de imágenes
// que el servidor devuelve como rutas relativas (p. ej. /api/media/...).
export const API_ORIGIN = API_BASE_URL.replace(/\/api\/?$/, '');
