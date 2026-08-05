import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import client from '../api/client';
import { colors, radius, shadow, spacing, type } from '../theme';

const WEEKDAYS = ['LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB', 'DOM'];
const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

const pad2 = (n) => String(n).padStart(2, '0');
const toYmd = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
const todayYmd = toYmd(new Date());

// Arma la cuadricula del mes en filas completas de 7 dias (lun-dom), sin
// depender de wrap automatico: evita el bug de columnas que ya se dio en
// la version web (margin/flex-basis descuadrados). Aqui cada celda tiene
// un ancho fijo controlado directamente.
function getMonthRows(year, month) {
  const firstOfMonth = new Date(year, month, 1);
  const startWeekday = (firstOfMonth.getDay() + 6) % 7; // 0=lun ... 6=dom
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInPrevMonth = new Date(year, month, 0).getDate();

  const cells = [];
  for (let i = startWeekday - 1; i >= 0; i--) {
    const day = daysInPrevMonth - i;
    cells.push({ day, currentMonth: false, date: new Date(year, month - 1, day) });
  }
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ day: d, currentMonth: true, date: new Date(year, month, d) });
  }
  let nextDay = 1;
  while (cells.length % 7 !== 0) {
    cells.push({ day: nextDay, currentMonth: false, date: new Date(year, month + 1, nextDay) });
    nextDay += 1;
  }

  const rows = [];
  for (let i = 0; i < cells.length; i += 7) {
    rows.push(cells.slice(i, i + 7));
  }
  return rows;
}

export default function CalendarScreen({ navigation }) {
  const now = new Date();
  const [activeYear, setActiveYear] = useState(now.getFullYear());
  const [activeMonth, setActiveMonth] = useState(now.getMonth()); // 0-11
  const [selectedYmd, setSelectedYmd] = useState(todayYmd);
  const [eventos, setEventos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setError('');
    try {
      const { data } = await client.get('/reservas', { params: { tipo: 'evento' } });
      setEventos(Array.isArray(data) ? data : []);
    } catch (e) {
      setError(e?.response?.data?.msg || 'No se pudieron cargar los eventos');
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      load().finally(() => setLoading(false));
    }, [load])
  );

  const eventosPorFecha = useMemo(() => {
    const map = new Map();
    for (const ev of eventos) {
      const ymd = ev.fechaLocal || String(ev.fecha).slice(0, 10);
      const lista = map.get(ymd) || [];
      lista.push(ev);
      map.set(ymd, lista);
    }
    return map;
  }, [eventos]);

  const rows = useMemo(() => getMonthRows(activeYear, activeMonth), [activeYear, activeMonth]);

  const irMesAnterior = () => {
    if (activeMonth === 0) { setActiveYear((y) => y - 1); setActiveMonth(11); }
    else setActiveMonth((m) => m - 1);
  };
  const irMesSiguiente = () => {
    if (activeMonth === 11) { setActiveYear((y) => y + 1); setActiveMonth(0); }
    else setActiveMonth((m) => m + 1);
  };

  const eventosDelDia = eventosPorFecha.get(selectedYmd) || [];

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {!!error && <Text style={styles.error}>{error}</Text>}

      <View style={styles.navRow}>
        <TouchableOpacity onPress={irMesAnterior} style={styles.navBtn} hitSlop={8}>
          <Ionicons name="chevron-back" size={20} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.navLabel}>{MESES[activeMonth]} {activeYear}</Text>
        <TouchableOpacity onPress={irMesSiguiente} style={styles.navBtn} hitSlop={8}>
          <Ionicons name="chevron-forward" size={20} color="#fff" />
        </TouchableOpacity>
      </View>

      <View style={styles.weekdaysRow}>
        {WEEKDAYS.map((wd) => (
          <View key={wd} style={styles.weekdayCell}>
            <Text style={styles.weekdayText}>{wd}</Text>
          </View>
        ))}
      </View>

      {rows.map((row, i) => (
        <View key={i} style={styles.weekRow}>
          {row.map((cell) => {
            const ymd = toYmd(cell.date);
            const numEventos = (eventosPorFecha.get(ymd) || []).length;
            const tieneEventos = numEventos > 0;
            const seleccionado = ymd === selectedYmd;
            const esHoy = ymd === todayYmd;
            return (
              <TouchableOpacity
                key={ymd}
                style={styles.dayCell}
                onPress={() => setSelectedYmd(ymd)}
              >
                <View
                  style={[
                    styles.dayCircle,
                    tieneEventos && !seleccionado && styles.dayCircleEvento,
                    esHoy && !seleccionado && styles.dayCircleToday,
                    seleccionado && styles.dayCircleSelected,
                  ]}
                >
                  <Text
                    style={[
                      styles.dayText,
                      !cell.currentMonth && styles.dayTextMuted,
                      tieneEventos && !seleccionado && styles.dayTextEvento,
                      seleccionado && styles.dayTextSelected,
                    ]}
                  >
                    {cell.day}
                  </Text>
                  {tieneEventos && (
                    <View style={[styles.badgeCount, seleccionado && styles.badgeCountSelected]}>
                      <Text style={styles.badgeCountText}>{numEventos > 9 ? '9+' : numEventos}</Text>
                    </View>
                  )}
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      ))}

      <View style={styles.listHeader}>
        <Text style={styles.listHeaderText}>
          {eventosDelDia.length} evento(s) el {selectedYmd}
        </Text>
      </View>

      <FlatList
        style={styles.list}
        data={eventosDelDia}
        keyExtractor={(item) => item._id}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="calendar-outline" size={28} color={colors.border} />
            <Text style={styles.emptyText}>Sin eventos este día</Text>
          </View>
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.card}
            activeOpacity={0.85}
            onPress={() => navigation.navigate('EventDashboard', { reservaId: item._id })}
          >
            <View style={styles.cardDot} />
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle}>{item.cliente}</Text>
              <Text style={styles.cardSubtitle}>
                {item.tipoEvento} · {item.horaInicio}–{item.horaFin}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
          </TouchableOpacity>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  error: { color: colors.danger, textAlign: 'center', padding: 8 },
  navRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    backgroundColor: colors.primary,
  },
  navBtn: {
    padding: 6,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: radius.pill,
  },
  navLabel: { color: '#fff', fontSize: 16, fontWeight: '700', textTransform: 'capitalize' },
  weekdaysRow: { flexDirection: 'row', paddingTop: spacing.sm, backgroundColor: colors.bg },
  weekdayCell: { width: '14.2857%', alignItems: 'center' },
  weekdayText: { fontSize: 11, fontWeight: '700', color: colors.textMuted },
  weekRow: { flexDirection: 'row', backgroundColor: colors.bg },
  dayCell: { width: '14.2857%', alignItems: 'center', paddingVertical: 4 },
  dayCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  dayCircleEvento: {
    backgroundColor: colors.primary,
  },
  dayCircleSelected: { backgroundColor: colors.accentDark },
  dayCircleToday: { borderWidth: 2, borderColor: colors.accentDark },
  dayText: { fontSize: 13, color: colors.text },
  dayTextMuted: { color: '#d8cdd2' },
  dayTextEvento: { color: '#fff', fontWeight: '700' },
  dayTextSelected: { color: '#fff', fontWeight: '700' },
  badgeCount: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 15,
    height: 15,
    borderRadius: 8,
    backgroundColor: colors.accentDark,
    borderWidth: 1.5,
    borderColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 2,
  },
  badgeCountSelected: { backgroundColor: colors.primaryDark },
  badgeCountText: { color: '#fff', fontSize: 9, fontWeight: '700' },
  listHeader: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: 6,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    marginTop: spacing.sm,
    backgroundColor: colors.bg,
  },
  listHeaderText: { fontWeight: '700', color: colors.text },
  list: { flex: 1, paddingHorizontal: spacing.md, backgroundColor: colors.bg },
  emptyState: { alignItems: 'center', gap: 8, paddingTop: 20 },
  emptyText: { color: colors.textMuted, textAlign: 'center' },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.surface,
    padding: spacing.sm + 4,
    borderRadius: radius.md,
    marginBottom: 8,
    ...shadow.sm,
  },
  cardDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.primary },
  cardTitle: { fontSize: 15, fontWeight: '700', color: colors.text },
  cardSubtitle: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
});
