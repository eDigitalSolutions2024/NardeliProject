import NetInfo from '@react-native-community/netinfo';

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
