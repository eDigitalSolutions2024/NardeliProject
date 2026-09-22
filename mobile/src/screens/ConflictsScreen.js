import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { getPendingConflicts } from '../offline/conflictStore';
import { resolveConflictKeepLocal, resolveConflictKeepServer } from '../offline/syncEngine';
import { useOffline } from '../offline/OfflineContext';
import { colors, radius, shadow, spacing, type } from '../theme';

const ENTITY_LABELS = {
  reserva: 'Reserva',
  checklist: 'Checklist',
  producto: 'Producto',
  invitacion: 'Invitación',
};

function diffKeys(local, server) {
  if (!local || !server) return Object.keys(local || {});
  const keys = new Set([...Object.keys(local), ...Object.keys(server)]);
  return Array.from(keys).filter((k) => {
    try {
      return JSON.stringify(local[k]) !== JSON.stringify(server[k]);
    } catch {
      return true;
    }
  });
}

function fmt(v) {
  if (v == null) return '—';
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
}

function ConflictCard({ conflict, onResolved }) {
  const [busy, setBusy] = useState(false);
  const label = ENTITY_LABELS[conflict.entity_type] || conflict.entity_type || 'Registro';
  const serverGone = !conflict.serverPayload;
  const keys = diffKeys(conflict.localPayload, conflict.serverPayload);

  const useLocal = async () => {
    setBusy(true);
    try {
      const res = await resolveConflictKeepLocal(conflict.id);
      if (!res.ok) {
        Alert.alert('No se pudo aplicar tu cambio', res.error || 'Intenta de nuevo más tarde.');
        return;
      }
      onResolved();
    } finally {
      setBusy(false);
    }
  };

  const useServer = () => {
    Alert.alert(
      'Descartar tu cambio',
      'Se conservará la versión del servidor y se perderá el cambio que hiciste sin conexión.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Descartar mi cambio',
          style: 'destructive',
          onPress: async () => {
            setBusy(true);
            try {
              await resolveConflictKeepServer(conflict.id);
              onResolved();
            } finally {
              setBusy(false);
            }
          },
        },
      ]
    );
  };

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Ionicons name="git-compare-outline" size={18} color={colors.danger} />
        <Text style={styles.cardTitle}>{label} · {String(conflict.entity_id).slice(-6)}</Text>
      </View>

      {serverGone ? (
        <Text style={styles.goneText}>Este registro ya no existe en el servidor.</Text>
      ) : (
        <View style={styles.diffTable}>
          <View style={styles.diffHeaderRow}>
            <Text style={[styles.diffHeaderCell, { flex: 1 }]}>Campo</Text>
            <Text style={[styles.diffHeaderCell, { flex: 1.3, color: colors.primary }]}>Tu cambio (offline)</Text>
            <Text style={[styles.diffHeaderCell, { flex: 1.3, color: colors.textMuted }]}>En el servidor</Text>
          </View>
          {keys.length === 0 ? (
            <Text style={styles.hintText}>No se detectaron campos distintos a nivel superior.</Text>
          ) : (
            keys.map((k) => (
              <View key={k} style={styles.diffRow}>
                <Text style={[styles.diffCell, { flex: 1, fontWeight: '700' }]}>{k}</Text>
                <Text style={[styles.diffCell, { flex: 1.3, color: colors.primary }]}>{fmt(conflict.localPayload?.[k])}</Text>
                <Text style={[styles.diffCell, { flex: 1.3, color: colors.textMuted }]}>{fmt(conflict.serverPayload?.[k])}</Text>
              </View>
            ))
          )}
        </View>
      )}

      <View style={styles.actions}>
        <TouchableOpacity
          style={[styles.actionBtn, styles.actionBtnPrimary, serverGone && styles.actionBtnDisabled]}
          onPress={useLocal}
          disabled={busy || serverGone}
        >
          {busy ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.actionBtnPrimaryText}>Usar mi cambio</Text>}
        </TouchableOpacity>
        <TouchableOpacity style={[styles.actionBtn, styles.actionBtnSecondary]} onPress={useServer} disabled={busy}>
          <Text style={styles.actionBtnSecondaryText}>Descartar mi cambio</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

export default function ConflictsScreen() {
  const { refreshCounts } = useOffline();
  const [conflicts, setConflicts] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const rows = await getPendingConflicts();
    setConflicts(rows);
    await refreshCounts();
  }, [refreshCounts]);

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

  return (
    <FlatList
      style={styles.root}
      contentContainerStyle={styles.content}
      data={conflicts}
      keyExtractor={(item) => String(item.id)}
      renderItem={({ item }) => <ConflictCard conflict={item} onResolved={load} />}
      ListEmptyComponent={
        <View style={styles.emptyState}>
          <Ionicons name="checkmark-circle-outline" size={32} color={colors.success} />
          <Text style={styles.emptyText}>No hay conflictos pendientes</Text>
        </View>
      }
    />
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.lg, gap: spacing.md, flexGrow: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.bg },
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.md, ...shadow.sm, marginBottom: spacing.md },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: spacing.sm },
  cardTitle: { ...type.h3, fontSize: 15, color: colors.text },
  goneText: { color: colors.danger, ...type.caption, marginBottom: spacing.sm },
  diffTable: { marginBottom: spacing.sm },
  diffHeaderRow: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: colors.border, paddingBottom: 6, marginBottom: 4 },
  diffHeaderCell: { ...type.caption, fontWeight: '800', color: colors.textMuted },
  diffRow: { flexDirection: 'row', paddingVertical: 4 },
  diffCell: { fontSize: 12, color: colors.text },
  hintText: { ...type.caption, color: colors.textMuted },
  actions: { flexDirection: 'row', gap: 8, marginTop: spacing.sm },
  actionBtn: { flex: 1, borderRadius: radius.md, paddingVertical: 10, alignItems: 'center', justifyContent: 'center' },
  actionBtnPrimary: { backgroundColor: colors.primary },
  actionBtnPrimaryText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  actionBtnDisabled: { backgroundColor: colors.neutral },
  actionBtnSecondary: { backgroundColor: colors.dangerSoft },
  actionBtnSecondaryText: { color: colors.danger, fontWeight: '700', fontSize: 13 },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8, paddingTop: spacing.xxl },
  emptyText: { color: colors.textMuted, ...type.body },
});
