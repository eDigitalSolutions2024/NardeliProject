import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import client from '../api/client';
import { colors, radius, shadow, spacing, type } from '../theme';

function StatBox({ label, value, icon }) {
  return (
    <View style={styles.statBox}>
      <Ionicons name={icon} size={16} color={colors.primary} style={{ marginBottom: 4 }} />
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

export default function EventDashboardScreen({ route, navigation }) {
  const { reservaId } = route.params;
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setError('');
    try {
      const { data: res } = await client.get(`/app/dashboard/${reservaId}`);
      setData(res);
    } catch (e) {
      setError(e?.response?.data?.msg || 'No se pudo cargar el evento');
    }
  }, [reservaId]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      load().finally(() => setLoading(false));
    }, [load])
  );

  const runAction = async (path, body) => {
    setBusy(true);
    try {
      await client.patch(`/app/reservas/${reservaId}/${path}`, body || {});
      await load();
    } catch (e) {
      Alert.alert('Error', e?.response?.data?.msg || 'No se pudo completar la acción');
    } finally {
      setBusy(false);
    }
  };

  const confirmarFinalizar = () => {
    Alert.alert('Finalizar evento', '¿Confirmas el cierre de este evento?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Finalizar', style: 'destructive', onPress: () => runAction('finalizar') },
    ]);
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (error || !data) {
    return (
      <View style={styles.center}>
        <Ionicons name="alert-circle-outline" size={32} color={colors.danger} />
        <Text style={styles.error}>{error || 'Evento no disponible'}</Text>
      </View>
    );
  }

  const { reserva, resumen } = data;

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: spacing.md }}>
      <View style={styles.titleRow}>
        <Text style={styles.title}>{reserva.cliente}</Text>
        <Text style={styles.subtitle}>
          {reserva.tipoEvento} · {reserva.horaInicio}–{reserva.horaFin}
        </Text>
      </View>

      <View style={styles.headerActionsRow}>
        <TouchableOpacity
          style={[styles.headerActionBtn, styles.headerActionBtnOutline]}
          activeOpacity={0.85}
          onPress={() => navigation.navigate('EditReserva', { reservaId })}
        >
          <Ionicons name="pencil" size={14} color={colors.primary} />
          <Text style={styles.headerActionBtnOutlineText}>Editar</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.headerActionBtn}
          activeOpacity={0.85}
          onPress={() => navigation.navigate('PanelCliente', { reservaId })}
        >
          <Ionicons name="receipt-outline" size={14} color="#fff" />
          <Text style={styles.headerActionBtnText}>Panel cliente</Text>
        </TouchableOpacity>
      </View>

      {reserva.requiereConfirmarFin && (
        <View style={styles.alertBox}>
          <Text style={styles.alertText}>
            El evento ya pasó su hora de fin. ¿Confirmas el cierre?
          </Text>
          <View style={styles.alertActions}>
            <TouchableOpacity
              style={[styles.smallButton, styles.smallButtonOutline]}
              disabled={busy}
              onPress={() => runAction('posponer-fin', { horas: 2 })}
            >
              <Text style={styles.smallButtonOutlineText}>Posponer 2h</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.smallButton}
              disabled={busy}
              onPress={confirmarFinalizar}
            >
              <Text style={styles.smallButtonText}>Finalizar</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      <View style={styles.statsGrid}>
        <StatBox label="Invitaciones" value={resumen.invitaciones} icon="mail-outline" />
        <StatBox label="Personas autorizadas" value={resumen.personasAutorizadas} icon="people-outline" />
        <StatBox label="Entradas registradas" value={resumen.entradas} icon="checkmark-done-outline" />
        <StatBox label="Restantes" value={resumen.restantes} icon="hourglass-outline" />
        <StatBox label="Capacidad" value={resumen.capacidadEvento} icon="business-outline" />
        <StatBox label="% ocupación" value={`${Math.round(resumen.porcentajeCapacidad)}%`} icon="stats-chart-outline" />
      </View>

      {resumen.sobreCupo > 0 && (
        <View style={styles.overCapacityRow}>
          <Ionicons name="warning" size={15} color={colors.danger} />
          <Text style={styles.overCapacity}>{resumen.sobreCupo} persona(s) sobre cupo</Text>
        </View>
      )}

      <TouchableOpacity
        style={styles.actionCard}
        activeOpacity={0.85}
        onPress={() => navigation.navigate('Checklists', { eventId: reservaId })}
      >
        <View style={styles.actionIconWrap}>
          <Ionicons name="checkbox-outline" size={18} color={colors.primary} />
        </View>
        <Text style={styles.actionCardText}>Ver checklists del evento</Text>
        <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.actionCard}
        activeOpacity={0.85}
        onPress={() => navigation.navigate('Invitaciones', { reservaId })}
      >
        <View style={styles.actionIconWrap}>
          <Ionicons name="ticket-outline" size={18} color={colors.primary} />
        </View>
        <Text style={styles.actionCardText}>Invitaciones</Text>
        <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
      </TouchableOpacity>

      {data.ultimosAccesos?.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Últimos accesos</Text>
          {data.ultimosAccesos.map((acc) => (
            <View key={acc._id} style={styles.accessRow}>
              <Text style={styles.accessName}>{acc.nombreFamilia}</Text>
              <Text style={styles.accessInfo}>
                {acc.personasIngresadas} pers. · quedan {acc.entradasRestantes}
              </Text>
            </View>
          ))}
        </View>
      )}

      {reserva.estado === 'finalizado' && (
        <TouchableOpacity
          style={[styles.smallButton, styles.smallButtonOutline, { marginTop: spacing.md }]}
          disabled={busy}
          onPress={() => runAction('reactivar')}
        >
          <Text style={styles.smallButtonOutlineText}>Reabrir evento</Text>
        </TouchableOpacity>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, gap: 10 },
  error: { color: colors.danger, textAlign: 'center' },
  titleRow: { marginBottom: spacing.sm + 2 },
  title: { ...type.h1, fontSize: 24 },
  subtitle: { fontSize: 14, color: colors.textMuted, marginTop: 2 },
  headerActionsRow: { flexDirection: 'row', gap: 8, marginBottom: spacing.md },
  headerActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: colors.primary,
    paddingVertical: 10,
    borderRadius: radius.pill,
  },
  headerActionBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  headerActionBtnOutline: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: colors.primary,
  },
  headerActionBtnOutlineText: { color: colors.primary, fontWeight: '700', fontSize: 13 },
  alertBox: {
    backgroundColor: colors.warningSoft,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  alertText: { color: '#8a5a00', marginBottom: 8 },
  alertActions: { flexDirection: 'row', gap: 8 },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: spacing.sm },
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
  overCapacityRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: spacing.sm },
  overCapacity: { color: colors.danger, fontWeight: '700' },
  actionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: 10,
    ...shadow.sm,
  },
  actionIconWrap: {
    width: 34,
    height: 34,
    borderRadius: radius.sm,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionCardText: { flex: 1, fontSize: 15, fontWeight: '600', color: colors.text },
  section: { marginTop: spacing.md },
  sectionTitle: { ...type.h3, marginBottom: spacing.sm },
  accessRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    padding: 10,
    borderRadius: radius.sm,
    marginBottom: 6,
  },
  accessName: { fontWeight: '600', color: colors.text },
  accessInfo: { color: colors.textMuted, fontSize: 12 },
  smallButton: {
    backgroundColor: colors.primary,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: radius.sm,
    flex: 1,
    alignItems: 'center',
  },
  smallButtonText: { color: '#fff', fontWeight: '700' },
  smallButtonOutline: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: colors.primary,
  },
  smallButtonOutlineText: { color: colors.primary, fontWeight: '700' },
});
