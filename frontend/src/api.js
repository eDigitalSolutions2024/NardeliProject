// src/api.js
const API_BASE_URL =
  window.location.hostname === 'localhost'
    ? 'http://localhost:8010/api'
    : window.location.protocol + '//' + window.location.hostname + '/api';

export default API_BASE_URL;

// 👇 NUEVO: origen del backend (p. ej. http://localhost:8010)
export const API_ORIGIN = API_BASE_URL.replace(/\/api\/?$/, '');
