// Sistema de diseño compartido de la app. Centraliza colores, espaciados,
// tipografía y sombras para que todas las pantallas se vean consistentes.

export const colors = {
  // Morado de marca, tomado directo del sistema web (Dashboard/Calendario/Home)
  primary: '#6b2c5e',
  primaryDark: '#491656',
  primaryLight: '#94678b',
  primarySoft: '#f5f0f4',

  accent: '#e6a13b',
  accentDark: '#c8841f',

  bg: '#f7f4f5',
  surface: '#ffffff',

  text: '#241118',
  textMuted: '#7c6a72',
  textOnPrimary: '#ffffff',
  border: '#ece3e6',

  success: '#2e7d32',
  successSoft: '#e8f5e9',
  warning: '#c8841f',
  warningSoft: '#fff3e0',
  danger: '#c0392b',
  dangerSoft: '#fdecea',
  neutral: '#8a8a8a',
};

export const estadoColors = {
  confirmada: colors.success,
  finalizado: colors.neutral,
  pendiente: colors.warning,
  activa: colors.success,
  agotada: colors.warning,
  cancelada: colors.danger,
};

export const radius = {
  sm: 8,
  md: 12,
  lg: 18,
  xl: 26,
  pill: 999,
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const type = {
  h1: { fontSize: 28, fontWeight: '800' },
  h2: { fontSize: 22, fontWeight: '700' },
  h3: { fontSize: 17, fontWeight: '700' },
  body: { fontSize: 15, fontWeight: '400' },
  label: { fontSize: 12, fontWeight: '700', letterSpacing: 0.4 },
  caption: { fontSize: 12, fontWeight: '500' },
};

export const shadow = {
  sm: {
    shadowColor: '#3e1349',
    shadowOpacity: 0.06,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  md: {
    shadowColor: '#3e1349',
    shadowOpacity: 0.1,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  lg: {
    shadowColor: '#3e1349',
    shadowOpacity: 0.16,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
    elevation: 12,
  },
};

const theme = { colors, estadoColors, radius, spacing, type, shadow };
export default theme;
