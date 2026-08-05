import React, { useCallback, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import client from '../api/client';
import { colors, estadoColors, radius, shadow, spacing, type } from '../theme';

function formatFecha(fecha) {
  try {
    return new Date(fecha).toLocaleDateString('es-MX', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return fecha;
  }
}

function initials(name) {
  const parts = String(name || '').trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() || '').join('') || '?';
}

export default function ClienteDetalleScreen({ route, navigation }) {
  const { correo, cliente } = route.params;
  const [reservas, setReservas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setError('');
    try {
      const { data } = await client.get('/reservas', { params: { correo } });
      const lista = Array.isArray(data) ? data : [];
      lista.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
      setReservas(lista);
    } catch (e) {
      setError(e?.response?.data?.msg || 'No se pudo cargar el historial');
    }
  }, [correo]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      load().finally(() => setLoading(false));
    }, [load])
  );

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  const primero = reservas[0];

  return (
    <View style={styles.container}>
      <View style={styles.profileCard}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initials(cliente)}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.profileName}>{cliente}</Text>
          {!!correo && <Text style={styles.profileMeta}>{correo}</Text>}
          {!!primero?.telefono && <Text style={styles.profileMeta}>{primero.telefono}</Text>}
        </View>
      </View>

      {!!error && <Text style={styles.error}>{error}</Text>}

      <FlatList
        data={reservas}
        keyExtractor={(item) => item._id}
        contentContainerStyle={{ padding: spacing.md, paddingTop: spacing.sm }}
        ListHeaderComponent={
          <Text style={styles.sectionTitle}>Historial ({reservas.length})</Text>
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="document-text-outline" size={28} color={colors.border} />
            <Text style={styles.emptyText}>Sin reservas registradas</Text>
          </View>
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.card}
            activeOpacity={0.85}
            onPress={() =>
              navigation.navigate(
                item.tipoReserva === 'evento' ? 'EventDashboard' : 'PanelCliente',
                { reservaId: item._id }
              )
            }
          >
            <View style={styles.cardHeader}>
              <Text style={styles.cardDate}>{formatFecha(item.fecha)}</Text>
              <View style={[styles.badge, { backgroundColor: estadoColors[item.estado] || colors.neutral }]}>
                <Text style={styles.badgeText}>{item.estado}</Text>
              </View>
            </View>
            <Text style={styles.cardTitle}>{item.tipoEvento}</Text>
            <View style={styles.cardFooterRow}>
              <Text style={styles.cardSubtitle}>
                {item.horaInicio}–{item.horaFin} · Folio {item.folio}
              </Text>
              <View style={styles.tipoChip}>
                <Text style={styles.tipoChipText}>
                  {item.tipoReserva === 'evento' ? 'Evento' : 'Cotización'}
                </Text>
              </View>
            </View>
          </TouchableOpacity>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  error: { color: colors.danger, textAlign: 'center', paddingHorizontal: spacing.md },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.surface,
    margin: spacing.md,
    marginBottom: 0,
    padding: spacing.md,
    borderRadius: radius.lg,
    ...shadow.sm,
  },
  avatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: colors.primary, fontWeight: '800', fontSize: 15 },
  profileName: { ...type.h3, fontSize: 17 },
  profileMeta: { fontSize: 12, color: colors.textMuted, marginTop: 1 },
  sectionTitle: { ...type.h3, fontSize: 14, color: colors.text, marginBottom: spacing.sm },
  emptyState: { alignItems: 'center', gap: 8, paddingTop: 40 },
  emptyText: { color: colors.textMuted },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md - 2,
    marginBottom: 10,
    ...shadow.sm,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  cardDate: { fontSize: 12, color: colors.textMuted, fontWeight: '600', textTransform: 'capitalize' },
  badge: { paddingHorizontal: 9, paddingVertical: 3, borderRadius: radius.pill },
  badgeText: { color: '#fff', fontSize: 11, fontWeight: '700', textTransform: 'capitalize' },
  cardTitle: { fontSize: 15, fontWeight: '700', color: colors.text },
  cardFooterRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 },
  cardSubtitle: { fontSize: 12, color: colors.textMuted, flexShrink: 1 },
  tipoChip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.pill,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  tipoChipText: { fontSize: 10, fontWeight: '700', color: colors.textMuted },
});
