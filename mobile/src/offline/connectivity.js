import { Platform, Linking } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { startActivityAsync, ActivityAction } from 'expo-intent-launcher';

let currentlyOnline = true; // optimista hasta el primer chequeo real
let initialized = false;
const listeners = new Set();

function computeOnline(state) {
  // isInternetReachable puede ser null mientras se determina; en ese caso
  // nos quedamos con isConnected como mejor aproximación.
  if (state.isInternetReachable === false) return false;
  return !!state.isConnected;
}

function ensureInitialized() {
  if (initialized) return;
  initialized = true;
  NetInfo.addEventListener((state) => {
    const wasOnline = currentlyOnline;
    currentlyOnline = computeOnline(state);
    if (!wasOnline && currentlyOnline) {
      listeners.forEach((cb) => cb('online'));
    } else if (wasOnline && !currentlyOnline) {
      listeners.forEach((cb) => cb('offline'));
    }
  });
  NetInfo.fetch().then((state) => {
    currentlyOnline = computeOnline(state);
  });
}

export function isOnline() {
  ensureInitialized();
  return currentlyOnline;
}

// cb recibe 'online' | 'offline' solo en transiciones (no en cada chequeo).
export function subscribeConnectivity(cb) {
  ensureInitialized();
  listeners.add(cb);
  return () => listeners.delete(cb);
}

// Fuerza un chequeo real contra el sistema operativo (no el último valor que
// ya teníamos en memoria) y avisa a quien esté escuchando si cambió. Úsalo
// antes de reintentar algo después de ver "sin conexión", en vez de confiar
// en el estado viejo — NetInfo.fetch() sí dispara una consulta nueva cada
// vez que se llama, a diferencia de leer la variable en caché.
export async function forceCheck() {
  ensureInitialized();
  const state = await NetInfo.fetch();
  const wasOnline = currentlyOnline;
  currentlyOnline = computeOnline(state);
  if (wasOnline !== currentlyOnline) {
    listeners.forEach((cb) => cb(currentlyOnline ? 'online' : 'offline'));
  }
  return currentlyOnline;
}

// Manda a la persona directo a donde puede prender datos o conectarse a
// WiFi, en vez de solo decirle "no hay internet" y dejarla sola.
//  - Android: abre el panel rápido de conectividad (WiFi + datos juntos,
//    el mismo que aparece al jalar la barra de notificaciones en Android
//    10+); si ese panel no existe en ese Android, cae a la pantalla de
//    ajustes inalámbricos completa.
//  - iOS: Apple no permite abrir WiFi/Datos Móviles directo desde una app
//    (ninguna URL pública lo hace, y usar una privada arriesga el rechazo
//    en App Store) — lo más cerca que se puede llegar es abrir los
//    Ajustes de la app, desde donde la persona entra a Wi-Fi/Celular con
//    un toque más.
export async function openNetworkSettings() {
  if (Platform.OS === 'android') {
    try {
      await startActivityAsync(ActivityAction.PANEL_INTERNET_CONNECTIVITY);
      return;
    } catch {
      try {
        await startActivityAsync(ActivityAction.WIRELESS_SETTINGS);
        return;
      } catch {
        // sigue al Linking.openSettings() de abajo como último recurso
      }
    }
  }
  await Linking.openSettings();
}
