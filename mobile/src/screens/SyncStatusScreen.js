import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useOffline } from '../offline/OfflineContext';
import { colors, radius, shadow, spacing, type } from '../theme';

function formatRelative(ts) {
  if (!ts) return 'Nunca';
  const diffMs = Date.now() - ts;
  const min = Math.floor(diffMs / 60000);
  if (min < 1) return 'Hace un momento';
  if (min < 60) return `Hace ${min} min`;
  const hrs = Math.floor(min / 60);
  if (hrs < 24) return `Hace ${hrs} h`;
  const days = Math.floor(hrs / 24);
  return `Hace ${days} d`;
}

function StatRow({ icon, label, value, color }) {
  return (
    <View style={styles.statRow}>
      <View style={[styles.statIconWrap, { backgroundColor: `${color}1a` }]}>
        <Ionicons name={icon} size={18} color={color} />
      </View>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
    </View>
  );
}

export default function SyncStatusScreen({ navigation }) {
  const {
    isOnline,
    pendingCount,
    errorCount,
    conflictCount,
    isSyncing,
    isDownloading,
    downloadProgress,
    lastFullSync,
    lastQueueSync,
    forceSync,
    listErrors,
    retryError,
    discardError,
    refreshCounts,
  } = useOffline();

  const [errors, setErrors] = useState([]);

  const load = useCallback(async () => {
    await refreshCounts();
    const rows = await listErrors();
    setErrors(rows);
  }, [refreshCounts, listErrors]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const handleForceSync = async () => {
    if (!isOnline) {
      Alert.alert('Sin conexión', 'Necesitas conexión a internet para forzar la sincronización.');
      return;
    }
    await forceSync();
    await load();
  };

  const handleRetry = async (id) => {
    await retryError(id);
    await load();
  };

  const handleDiscard = (id) => {
    Alert.alert(
      'Descartar cambio',
      'Se perderá este cambio hecho sin conexión. ¿Continuar?',
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Descartar', style: 'destructive', onPress: async () => { await discardError(id); await load(); } },
      ]
    );
  };

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <View style={[styles.statusBanner, { backgroundColor: isOnline ? colors.successSoft : colors.dangerSoft }]}>
        <Ionicons
          name={isOnline ? 'wifi' : 'cloud-offline-outline'}
          size={20}
          color={isOnline ? colors.success : colors.danger}
        />
        <Text style={[styles.statusText, { color: isOnline ? colors.success : colors.danger }]}>
          {isOnline ? 'Conectado' : 'Sin conexión — trabajando con la copia local'}
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Copia local</Text>
        <Text style={styles.metaText}>Última actualización: {formatRelative(lastFullSync)}</Text>
        <Text style={styles.metaText}>Última subida de cambios: {formatRelative(lastQueueSync)}</Text>

        {(isDownloading || isSyncing) && (
          <View style={styles.progressRow}>
            <ActivityIndicator size="small" color={colors.primary} />
            <Text style={styles.progressText}>
              {isSyncing ? 'Subiendo cambios pendientes…' : 'Actualizando copia local…'}
              {isDownloading && downloadProgress?.total
                ? ` (${downloadProgress.done}/${downloadProgress.total})`
                : ''}
            </Text>
          </View>
        )}

        <TouchableOpacity
          style={[styles.secondaryBtn, !isOnline && styles.secondaryBtnDisabled]}
          onPress={handleForceSync}
          disabled={!isOnline || isSyncing || isDownloading}
        >
          <Ionicons name="sync" size={16} color={isOnline ? colors.primary : colors.neutral} />
          <Text style={[styles.secondaryBtnText, { color: isOnline ? colors.primary : colors.neutral }]}>
            Forzar sincronización ahora
          </Text>
        </TouchableOpacity>
        <Text style={styles.hintText}>
          No es necesario: la copia local se mantiene sola. Usa esto solo si quieres asegurarte justo antes de ir a un lugar sin señal.
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Estado</Text>
        <StatRow icon="time-outline" label="Cambios pendientes de subir" value={pendingCount} color={colors.warning} />
        <StatRow icon="alert-circle-outline" label="Con error" value={errorCount} color={colors.danger} />
        <StatRow
          icon="git-compare-outline"
          label="Conflictos por resolver"
          value={conflictCount}
          color={conflictCount > 0 ? colors.danger : colors.neutral}
        />
        {conflictCount > 0 && (
          <TouchableOpacity style={styles.linkBtn} onPress={() => navigation.navigate('Conflicts')}>
            <Text style={styles.linkBtnText}>Ver y resolver conflictos</Text>
            <Ionicons name="arrow-forward" size={14} color={colors.primary} />
          </TouchableOpacity>
        )}
      </View>

      {errors.length > 0 && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Cambios con error</Text>
          {errors.map((e) => (
            <View key={e.id} style={styles.errorItem}>
              <Text style={styles.errorMethodUrl}>{e.method} {e.url}</Text>
              <Text style={styles.errorMsg}>{e.last_error || 'Error desconocido'}</Text>
              <View style={styles.errorActions}>
                <TouchableOpacity style={styles.smallBtn} onPress={() => handleRetry(e.id)}>
                  <Text style={styles.smallBtnText}>Reintentar</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.smallBtn, styles.smallBtnDanger]} onPress={() => handleDiscard(e.id)}>
                  <Text style={[styles.smallBtnText, { color: colors.danger }]}>Descartar</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.lg, gap: spacing.md },
  statusBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: spacing.md,
    borderRadius: radius.md,
  },
  statusText: { fontWeight: '700', fontSize: 14 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    ...shadow.sm,
  },
  cardTitle: { ...type.h3, color: colors.text, marginBottom: spacing.sm },
  metaText: { ...type.caption, color: colors.textMuted, marginBottom: 2 },
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: spacing.sm },
  progressText: { ...type.caption, color: colors.text },
  secondaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: 10,
    marginTop: spacing.md,
  },
  secondaryBtnDisabled: { borderColor: colors.border },
  secondaryBtnText: { fontWeight: '700', fontSize: 13 },
  hintText: { ...type.caption, color: colors.textMuted, marginTop: 6 },
  statRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 },
  statIconWrap: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  statLabel: { flex: 1, ...type.body, color: colors.text, fontSize: 13 },
  statValue: { fontWeight: '800', fontSize: 15 },
  linkBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: spacing.sm, alignSelf: 'flex-start' },
  linkBtnText: { color: colors.primary, fontWeight: '700', fontSize: 13 },
  errorItem: { borderTopWidth: 1, borderTopColor: colors.border, paddingVertical: spacing.sm },
  errorMethodUrl: { fontWeight: '700', fontSize: 13, color: colors.text },
  errorMsg: { ...type.caption, color: colors.danger, marginTop: 2 },
  errorActions: { flexDirection: 'row', gap: 8, marginTop: 8 },
  smallBtn: {
    backgroundColor: colors.primarySoft,
    borderRadius: radius.sm,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  smallBtnDanger: { backgroundColor: colors.dangerSoft },
  smallBtnText: { fontWeight: '700', fontSize: 12, color: colors.primary },
});
