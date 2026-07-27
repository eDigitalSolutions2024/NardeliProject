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
import client from '../api/client';

function StatBox({ label, value }) {
  return (
    <View style={styles.statBox}>
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
        <ActivityIndicator size="large" color="#8a2b52" />
      </View>
    );
  }

  if (error || !data) {
    return (
      <View style={styles.center}>
        <Text style={styles.error}>{error || 'Evento no disponible'}</Text>
      </View>
    );
  }

  const { reserva, resumen } = data;

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 16 }}>
      <Text style={styles.title}>{reserva.cliente}</Text>
      <Text style={styles.subtitle}>
        {reserva.tipoEvento} · {reserva.horaInicio}–{reserva.horaFin}
      </Text>

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
        <StatBox label="Invitaciones" value={resumen.invitaciones} />
        <StatBox label="Personas autorizadas" value={resumen.personasAutorizadas} />
        <StatBox label="Entradas registradas" value={resumen.entradas} />
        <StatBox label="Restantes" value={resumen.restantes} />
        <StatBox label="Capacidad" value={resumen.capacidadEvento} />
        <StatBox label="% ocupación" value={`${Math.round(resumen.porcentajeCapacidad)}%`} />
      </View>

      {resumen.sobreCupo > 0 && (
        <Text style={styles.overCapacity}>⚠ {resumen.sobreCupo} persona(s) sobre cupo</Text>
      )}

      <TouchableOpacity
        style={styles.actionCard}
        onPress={() => navigation.navigate('Checklists', { eventId: reservaId })}
      >
        <Text style={styles.actionCardText}>📋 Ver checklists del evento</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.actionCard}
        onPress={() => navigation.navigate('ScanQR')}
      >
        <Text style={styles.actionCardText}>📷 Escanear invitación QR</Text>
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
          style={[styles.smallButton, styles.smallButtonOutline, { marginTop: 16 }]}
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
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  error: { color: '#c0392b', textAlign: 'center' },
  title: { fontSize: 24, fontWeight: '700' },
  subtitle: { fontSize: 14, color: '#666', marginBottom: 16 },
  alertBox: {
    backgroundColor: '#fff3e0',
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
  },
  alertText: { color: '#8a5a00', marginBottom: 8 },
  alertActions: { flexDirection: 'row', gap: 8 },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 12 },
  statBox: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 12,
    width: '31%',
    alignItems: 'center',
  },
  statValue: { fontSize: 18, fontWeight: '700', color: '#8a2b52' },
  statLabel: { fontSize: 10, color: '#666', textAlign: 'center', marginTop: 2 },
  overCapacity: { color: '#c0392b', fontWeight: '600', marginBottom: 12 },
  actionCard: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 16,
    marginBottom: 10,
  },
  actionCardText: { fontSize: 15, fontWeight: '600' },
  section: { marginTop: 16 },
  sectionTitle: { fontSize: 16, fontWeight: '700', marginBottom: 8 },
  accessRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    padding: 10,
    borderRadius: 8,
    marginBottom: 6,
  },
  accessName: { fontWeight: '600' },
  accessInfo: { color: '#666', fontSize: 12 },
  smallButton: {
    backgroundColor: '#8a2b52',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 8,
    flex: 1,
    alignItems: 'center',
  },
  smallButtonText: { color: '#fff', fontWeight: '600' },
  smallButtonOutline: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#8a2b52',
  },
  smallButtonOutlineText: { color: '#8a2b52', fontWeight: '600' },
});
