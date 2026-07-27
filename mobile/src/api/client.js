import axios from 'axios';
import { API_BASE_URL } from './config';

const client = axios.create({ baseURL: API_BASE_URL, timeout: 15000 });

let onUnauthorized = null;

export function setAuthToken(token) {
  if (token) {
    client.defaults.headers.common.Authorization = `Bearer ${token}`;
  } else {
    delete client.defaults.headers.common.Authorization;
  }
}

// Permite que AuthContext reaccione (cerrar sesión) cuando el token expiró.
export function setUnauthorizedHandler(fn) {
  onUnauthorized = fn;
}

client.interceptors.response.use(
  (res) => res,
  (error) => {
    if (error?.response?.status === 401 && onUnauthorized) {
      onUnauthorized();
    }
    return Promise.reject(error);
  }
);

export default client;
