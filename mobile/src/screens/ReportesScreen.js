import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import client from '../api/client';
import { colors, radius, shadow, spacing, type } from '../theme';

const pad2 = (n) => String(n).padStart(2, '0');
const toYmd = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;

const PRESETS = [
  { key: 'hoy', label: 'Hoy' },
  { key: 'semana', label: '7 días' },
  { key: 'mes', label: 'Este mes' },
  { key: 'anio', label: 'Este año' },
];

function rangoFor(preset) {
  const now = new Date();
  const to = toYmd(now);
  let from = to;
  if (preset === 'semana') {
    const d = new Date(now);
    d.setDate(d.getDate() - 6);
    from = toYmd(d);
  } else if (preset === 'mes') {
    from = toYmd(new Date(now.getFullYear(), now.getMonth(), 1));
  } else if (preset === 'anio') {
    from = toYmd(new Date(now.getFullYear(), 0, 1));
  }
  return { from, to };
}

function money(n) {
  const v = Number(n) || 0;
  try {
    return v.toLocaleString('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 });
  } catch {
    return `$${Math.round(v)}`;
  }
}

function StatBox({ label, value, icon }) {
  return (
    <View style={styles.statBox}>
      <Ionicons name={icon} size={15} color={colors.primary} style={{ marginBottom: 4 }} />
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

export default function ReportesScreen() {
  const [preset, setPreset] = useState('mes');
  const [resumen, setResumen] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async (p) => {
    setError('');
    const { from, to } = rangoFor(p);
    try {
      const { data } = await client.get('/reportes/resumen', { params: { from, to } });
      setResumen(data);
    } catch (e) {
      setError(e?.response?.data?.msg || e?.response?.data?.error || 'No se pudo cargar el reporte');
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      load(preset).finally(() => setLoading(false));
    }, [load, preset])
  );

  const counts = resumen?.counts || {};
  const money_ = resumen?.money || {};

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: spacing.md }}>
      <View style={styles.presetsRow}>
        {PRESETS.map((p) => {
          const active = p.key === preset;
          return (
            <TouchableOpacity
              key={p.key}
              style={[styles.presetBtn, active && styles.presetBtnActive]}
              activeOpacity={0.85}
              onPress={() => setPreset(p.key)}
            >
              <Text style={[styles.presetBtnText, active && styles.presetBtnTextActive]}>{p.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Ionicons name="alert-circle-outline" size={28} color={colors.danger} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : (
        <>
          <View style={styles.totalCard}>
            <Text style={styles.totalLabel}>Ingresos del periodo</Text>
            <Text style={styles.totalValue}>{money(money_.total)}</Text>
            <View style={styles.totalSubRow}>
              <View style={styles.totalSubItem}>
                <Text style={styles.totalSubLabel}>Cobrado</Text>
                <Text style={styles.totalSubValue}>{money(money_.paid)}</Text>
              </View>
              <View style={styles.totalSubDivider} />
              <View style={styles.totalSubItem}>
                <Text style={styles.totalSubLabel}>Pendiente</Text>
                <Text style={styles.totalSubValue}>{money(money_.remaining)}</Text>
              </View>
              <View style={styles.totalSubDivider} />
              <View style={styles.totalSubItem}>
                <Text style={styles.totalSubLabel}>Ticket prom.</Text>
                <Text style={styles.totalSubValue}>{money(money_.avgTicket)}</Text>
              </View>
            </View>
          </View>

          <Text style={styles.sectionTitle}>Reservas del periodo</Text>
          <View style={styles.statsGrid}>
            <StatBox label="Eventos" value={counts.eventos ?? 0} icon="calendar-outline" />
            <StatBox label="Cotizaciones" value={counts.cotizaciones ?? 0} icon="document-text-outline" />
            <StatBox label="Pagados" value={counts.pagados ?? 0} icon="checkmark-circle-outline" />
            <StatBox label="Parciales" value={counts.parciales ?? 0} icon="time-outline" />
            <StatBox label="Pendientes" value={counts.pendientes ?? 0} icon="alert-circle-outline" />
          </View>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  center: { alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 60 },
  errorText: { color: colors.danger, textAlign: 'center' },
  presetsRow: { flexDirection: 'row', gap: 8, marginBottom: spacing.md },
  presetBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 9,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  presetBtnActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  presetBtnText: { fontSize: 12, fontWeight: '700', color: colors.textMuted },
  presetBtnTextActive: { color: '#fff' },
  totalCard: {
    backgroundColor: colors.primary,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
    ...shadow.md,
  },
  totalLabel: { color: 'rgba(255,255,255,0.8)', fontSize: 13, fontWeight: '700' },
  totalValue: { color: '#fff', fontSize: 32, fontWeight: '800', marginTop: 4 },
  totalSubRow: {
    flexDirection: 'row',
    marginTop: spacing.md,
    paddingTop: spacing.sm + 4,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.25)',
  },
  totalSubItem: { flex: 1, alignItems: 'center' },
  totalSubDivider: { width: 1, backgroundColor: 'rgba(255,255,255,0.25)' },
  totalSubLabel: { color: 'rgba(255,255,255,0.8)', fontSize: 11, fontWeight: '600' },
  totalSubValue: { color: '#fff', fontSize: 14, fontWeight: '800', marginTop: 3 },
  sectionTitle: { ...type.h3, fontSize: 14, color: colors.text, marginBottom: spacing.sm },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  statBox: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.sm + 4,
    width: '31%',
    alignItems: 'center',
    ...shadow.sm,
  },
  statValue: { fontSize: 18, fontWeight: '800', color: colors.text },
  statLabel: { fontSize: 10, color: colors.textMuted, textAlign: 'center', marginTop: 2 },
});
