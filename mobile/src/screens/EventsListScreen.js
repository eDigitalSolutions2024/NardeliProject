import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  SectionList,
  ScrollView,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  Animated,
  Easing,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import client from '../offline/offlineClient';
import { colors, estadoColors, radius, shadow, spacing, type } from '../theme';

const MESES_ABR = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC'];

function dateParts(fecha) {
  const ymd = String(fecha).slice(0, 10);
  const [y, m, d] = ymd.split('-').map(Number);
  return { ymd, y, m, d, day: d, month: MESES_ABR[(m || 1) - 1] };
}

function diffDaysFromYmd(y, m, d) {
  const target = new Date(y, m - 1, d);
  target.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((target - today) / 86400000);
}

function seccionFor(diff) {
  if (diff < 0) return 'Recientes';
  if (diff === 0) return 'Hoy';
  if (diff === 1) return 'Mañana';
  if (diff <= 6) return 'Esta semana';
  return 'Próximos';
}

function countdownLabel(diff) {
  if (diff === 0) return 'Hoy';
  if (diff === 1) return 'Mañana';
  if (diff === -1) return 'Ayer';
  if (diff < 0) return `Hace ${Math.abs(diff)} días`;
  return `En ${diff} días`;
}

function iconForTipo(tipo = '') {
  const t = tipo.toLowerCase();
  if (t.includes('boda')) return 'heart';
  if (t.includes('xv') || t.includes('quince')) return 'sparkles';
  if (t.includes('cumple')) return 'gift';
  if (t.includes('corporat') || t.includes('empresa')) return 'briefcase';
  if (t.includes('bautizo')) return 'water';
  if (t.includes('grad')) return 'school';
  if (t.includes('babyshower') || t.includes('baby shower')) return 'balloon';
  return 'calendar';
}

const FILTROS = [
  { key: 'todos', label: 'Todos', icon: 'apps-outline', tint: colors.primary },
  { key: 'confirmados', label: 'Confirmados', icon: 'checkmark-circle-outline', tint: colors.success },
  { key: 'porCerrar', label: 'Por cerrar', icon: 'alert-circle-outline', tint: colors.warning },
  { key: 'finalizados', label: 'Finalizados', icon: 'flag-outline', tint: colors.neutral },
];

function matchesFilter(item, key) {
  if (key === 'confirmados') return item.estado === 'confirmada' && !item.requiereConfirmarFin;
  if (key === 'porCerrar') return !!item.requiereConfirmarFin;
  if (key === 'finalizados') return item.estado === 'finalizado';
  return true;
}

function AnimatedCard({ delay, children }) {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(anim, {
      toValue: 1,
      duration: 360,
      delay,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [anim, delay]);

  const translateY = anim.interpolate({ inputRange: [0, 1], outputRange: [14, 0] });
  return <Animated.View style={{ opacity: anim, transform: [{ translateY }] }}>{children}</Animated.View>;
}

function EventCard({ item, index, onPress }) {
  const scale = useRef(new Animated.Value(1)).current;
  const { day, month, y, m, d } = dateParts(item.fecha);
  const diff = diffDaysFromYmd(y, m, d);
  const estadoColor = estadoColors[item.estado] || colors.neutral;

  const pressIn = () =>
    Animated.spring(scale, { toValue: 0.97, useNativeDriver: true, speed: 40, bounciness: 0 }).start();
  const pressOut = () =>
    Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 40, bounciness: 6 }).start();

  return (
    <AnimatedCard delay={Math.min(index * 45, 300)}>
      <Pressable onPress={onPress} onPressIn={pressIn} onPressOut={pressOut}>
        <Animated.View style={[styles.card, { transform: [{ scale }] }]}>
          <View style={[styles.cardAccent, { backgroundColor: estadoColor }]} />

          <View style={styles.dateBlock}>
            <Text style={styles.dateDay}>{day}</Text>
            <Text style={styles.dateMonth}>{month}</Text>
          </View>

          <View style={styles.cardBody}>
            <View style={styles.cardTopRow}>
              <View style={styles.tipoIconWrap}>
                <Ionicons name={iconForTipo(item.tipoEvento)} size={13} color={colors.primary} />
              </View>
              <Text style={styles.cardCountdown}>{countdownLabel(diff)}</Text>
              <View style={[styles.badge, { backgroundColor: estadoColor }]}>
                <Text style={styles.badgeText}>{item.estado}</Text>
              </View>
            </View>

            <Text style={styles.cardTitle} numberOfLines={1}>{item.cliente}</Text>
            <Text style={styles.cardSubtitle}>
              {item.tipoEvento} · {item.horaInicio}–{item.horaFin}
            </Text>

            {item.requiereConfirmarFin && (
              <View style={styles.warningRow}>
                <Ionicons name="alert-circle" size={13} color={colors.warning} />
                <Text style={styles.warning}>Requiere confirmar cierre</Text>
              </View>
            )}
          </View>

          <Ionicons name="chevron-forward" size={18} color={colors.textMuted} style={styles.chevron} />
        </Animated.View>
      </Pressable>
    </AnimatedCard>
  );
}

export default function EventsListScreen({ navigation }) {
  const [reservas, setReservas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [filtro, setFiltro] = useState('todos');

  const load = useCallback(async () => {
    setError('');
    try {
      const { data } = await client.get('/app/reservas');
      setReservas(Array.isArray(data) ? data : []);
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

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const matchesQuery = useCallback(
    (r) => {
      const q = query.trim().toLowerCase();
      if (!q) return true;
      return r.cliente?.toLowerCase().includes(q) || r.tipoEvento?.toLowerCase().includes(q);
    },
    [query]
  );

  // Los contadores de los chips deben respetar también la búsqueda activa —
  // si no, muestran el total general aunque la lista ya esté filtrada por texto.
  const counts = useMemo(
    () => ({
      todos: reservas.filter(matchesQuery).length,
      confirmados: reservas.filter((r) => matchesFilter(r, 'confirmados') && matchesQuery(r)).length,
      porCerrar: reservas.filter((r) => matchesFilter(r, 'porCerrar') && matchesQuery(r)).length,
      finalizados: reservas.filter((r) => matchesFilter(r, 'finalizados') && matchesQuery(r)).length,
    }),
    [reservas, matchesQuery]
  );

  const sections = useMemo(() => {
    const filtradas = reservas.filter((r) => matchesFilter(r, filtro) && matchesQuery(r));

    const orden = ['Recientes', 'Hoy', 'Mañana', 'Esta semana', 'Próximos'];
    const grupos = new Map();
    for (const r of filtradas) {
      const { y, m, d } = dateParts(r.fecha);
      const sec = seccionFor(diffDaysFromYmd(y, m, d));
      if (!grupos.has(sec)) grupos.set(sec, []);
      grupos.get(sec).push(r);
    }

    return orden
      .filter((s) => grupos.has(s))
      .map((s) => ({ title: s, data: grupos.get(s) }));
  }, [reservas, filtro, matchesQuery]);

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['left', 'right']}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['left', 'right']}>
      <View style={styles.searchBox}>
        <Ionicons name="search" size={17} color={colors.textMuted} />
        <TextInput
          style={styles.searchInput}
          placeholder="Buscar por cliente o tipo de evento"
          placeholderTextColor="#b9a7b0"
          value={query}
          onChangeText={setQuery}
          autoCapitalize="none"
        />
        {!!query && (
          <Pressable onPress={() => setQuery('')} hitSlop={8}>
            <Ionicons name="close-circle" size={17} color={colors.textMuted} />
          </Pressable>
        )}
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chipsRow}
      >
        {FILTROS.map((f) => {
          const active = f.key === filtro;
          return (
            <Pressable
              key={f.key}
              onPress={() => setFiltro(f.key)}
              style={[styles.chip, active && { backgroundColor: f.tint, borderColor: f.tint }]}
            >
              <Ionicons name={f.icon} size={16} color={active ? '#fff' : f.tint} />
              <Text style={[styles.chipText, active && styles.chipTextActive]}>
                {f.label} · {counts[f.key]}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {!!error && <Text style={styles.error}>{error}</Text>}

      <SectionList
        sections={sections}
        keyExtractor={(item) => item._id}
        stickySectionHeadersEnabled
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
        contentContainerStyle={[
          { paddingBottom: spacing.lg },
          sections.length === 0 && styles.emptyContainer,
        ]}
        renderSectionHeader={({ section: { title, data } }) => (
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionHeaderText}>{title}</Text>
            <Text style={styles.sectionHeaderCount}>{data.length}</Text>
          </View>
        )}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="calendar-clear-outline" size={40} color={colors.border} />
            <Text style={styles.emptyText}>
              {query || filtro !== 'todos' ? 'Sin resultados para este filtro' : 'No hay eventos próximos'}
            </Text>
          </View>
        }
        renderItem={({ item, index }) => (
          <View style={styles.cardWrap}>
            <EventCard
              item={item}
              index={index}
              onPress={() => navigation.navigate('EventDashboard', { reservaId: item._id })}
            />
          </View>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  error: { color: colors.danger, textAlign: 'center', padding: 8 },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.surface,
    marginHorizontal: spacing.md,
    marginTop: spacing.md,
    paddingHorizontal: 14,
    height: 46,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    ...shadow.sm,
  },
  searchInput: { flex: 1, fontSize: 14, color: colors.text },
  chipsRow: { paddingHorizontal: spacing.md, paddingVertical: spacing.md, gap: 8, alignItems: 'center' },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    minHeight: 44,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: radius.pill,
    marginRight: 8,
  },
  chipText: { fontSize: 14, fontWeight: '700', color: colors.textMuted },
  chipTextActive: { color: '#fff' },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyState: { alignItems: 'center', gap: 10, paddingTop: 60 },
  emptyText: { color: colors.textMuted },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.bg,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: 6,
  },
  sectionHeaderText: {
    ...type.label,
    color: colors.primary,
    textTransform: 'uppercase',
    fontSize: 12.5,
  },
  sectionHeaderCount: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textMuted,
    backgroundColor: colors.primarySoft,
    paddingHorizontal: 6,
    borderRadius: radius.pill,
    overflow: 'hidden',
  },
  cardWrap: { paddingHorizontal: spacing.md, paddingTop: spacing.sm },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    overflow: 'hidden',
    ...shadow.sm,
  },
  cardAccent: { width: 4, alignSelf: 'stretch' },
  dateBlock: {
    width: 52,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
  },
  dateDay: { fontSize: 20, fontWeight: '800', color: colors.text, lineHeight: 22 },
  dateMonth: { fontSize: 10, fontWeight: '700', color: colors.textMuted, marginTop: 1 },
  cardBody: { flex: 1, paddingVertical: spacing.sm + 4, paddingRight: 6 },
  cardTopRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  tipoIconWrap: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardCountdown: { flex: 1, fontSize: 11, fontWeight: '700', color: colors.textMuted },
  badge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: radius.pill },
  badgeText: { color: '#fff', fontSize: 10, fontWeight: '700', textTransform: 'capitalize' },
  cardTitle: { fontSize: 16, fontWeight: '800', color: colors.text },
  cardSubtitle: { fontSize: 12.5, color: colors.textMuted, marginTop: 2 },
  warningRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 6 },
  warning: { color: colors.warning, fontSize: 11, fontWeight: '700' },
  chevron: { marginRight: 12 },
});
