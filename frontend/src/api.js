const API_BASE_URL =
  window.location.hostname === 'localhost'
    ? 'http://localhost:8010/api'
    : window.location.protocol + '//' + window.location.hostname + '/api';

export default API_BASE_URL;
