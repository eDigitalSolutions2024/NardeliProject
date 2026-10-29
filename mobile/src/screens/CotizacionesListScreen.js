import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  SectionList,
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
import OfflineErrorBanner from '../components/OfflineErrorBanner';
import { colors, radius, shadow, spacing, type } from '../theme';

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

// Para cotizaciones agrupamos más simple que en Eventos: no importa si la
// fecha propuesta ya "pasó" (es solo una propuesta, no un compromiso), así
// que todo lo vencido cae junto en un solo grupo.
function seccionFor(diff) {
  if (diff < 0) return 'Fecha propuesta ya pasó';
  if (diff === 0) return 'Hoy';
  if (diff === 1) return 'Mañana';
  if (diff <= 6) return 'Esta semana';
  return 'Próximas';
}

function iconForTipo(tipo = '') {
  const t = tipo.toLowerCase();
  if (t.includes('boda')) return 'heart';
  if (t.includes('xv') || t.includes('quince')) return 'sparkles';
  if (t.includes('cumple')) return 'gift';
  if (t.includes('corporat') || t.includes('empresa')) return 'briefcase';
  if (t.includes('bautizo')) return 'water';
  if (t.includes('grad')) return 'school';
  return 'document-text';
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

function CotizacionCard({ item, index, onPress }) {
  const scale = useRef(new Animated.Value(1)).current;
  const { day, month } = dateParts(item.fecha);

  const pressIn = () =>
    Animated.spring(scale, { toValue: 0.97, useNativeDriver: true, speed: 40, bounciness: 0 }).start();
  const pressOut = () =>
    Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 40, bounciness: 6 }).start();

  return (
    <AnimatedCard delay={Math.min(index * 45, 300)}>
      <Pressable onPress={onPress} onPressIn={pressIn} onPressOut={pressOut}>
        <Animated.View style={[styles.card, { transform: [{ scale }] }]}>
          <View style={styles.cardAccent} />

          <View style={styles.dateBlock}>
            <Text style={styles.dateDay}>{day}</Text>
            <Text style={styles.dateMonth}>{month}</Text>
          </View>

          <View style={styles.cardBody}>
            <View style={styles.cardTopRow}>
              <View style={styles.tipoIconWrap}>
                <Ionicons name={iconForTipo(item.tipoEvento)} size={13} color={colors.primary} />
              </View>
              <Text style={styles.cardBadgeText}>Cotización</Text>
            </View>

            <Text style={styles.cardTitle} numberOfLines={1}>{item.cliente}</Text>
            <Text style={styles.cardSubtitle}>
              {item.tipoEvento} · {item.horaInicio}–{item.horaFin}
            </Text>
          </View>

          <Ionicons name="chevron-forward" size={18} color={colors.textMuted} style={styles.chevron} />
        </Animated.View>
      </Pressable>
    </AnimatedCard>
  );
}

export default function CotizacionesListScreen({ navigation }) {
  const [cotizaciones, setCotizaciones] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');

  const load = useCallback(async () => {
    setError('');
    try {
      const { data } = await client.get('/app/reservas', { params: { tipo: 'cotizacion' } });
      setCotizaciones(Array.isArray(data) ? data : []);
    } catch (e) {
      setError(e?.response?.data?.msg || 'No se pudieron cargar las cotizaciones');
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

  const sections = useMemo(() => {
    const filtradas = cotizaciones.filter(matchesQuery);

    const orden = ['Hoy', 'Mañana', 'Esta semana', 'Próximas', 'Fecha propuesta ya pasó'];
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
  }, [cotizaciones, matchesQuery]);

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

      <OfflineErrorBanner error={error} onRetry={onRefresh} retrying={refreshing} />

      <SectionList
        sections={sections}
        keyExtractor={(item) => item._id}
        stickySectionHeadersEnabled
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
        contentContainerStyle={[
          { paddingBottom: spacing.lg, paddingTop: spacing.sm },
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
            <Ionicons name="document-text-outline" size={40} color={colors.border} />
            <Text style={styles.emptyText}>
              {query ? 'Sin resultados para esta búsqueda' : 'No hay cotizaciones pendientes'}
            </Text>
          </View>
        }
        renderItem={({ item, index }) => (
          <View style={styles.cardWrap}>
            <CotizacionCard
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
  cardAccent: { width: 4, alignSelf: 'stretch', backgroundColor: colors.primary },
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
  cardBadgeText: { fontSize: 11, fontWeight: '700', color: colors.primary, textTransform: 'uppercase' },
  cardTitle: { fontSize: 16, fontWeight: '800', color: colors.text },
  cardSubtitle: { fontSize: 12.5, color: colors.textMuted, marginTop: 2 },
  chevron: { marginRight: 12 },
});
