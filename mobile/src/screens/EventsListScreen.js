import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import client from '../api/client';
import { useAuth } from '../context/AuthContext';

function formatFecha(fecha) {
  try {
    return new Date(fecha).toLocaleDateString('es-MX', {
      weekday: 'short',
      day: '2-digit',
      month: 'short',
    });
  } catch {
    return fecha;
  }
}

const ESTADO_COLORS = {
  confirmada: '#2e7d32',
  finalizado: '#616161',
  pendiente: '#f9a825',
};

export default function EventsListScreen({ navigation }) {
  const { user, logout } = useAuth();
  const [reservas, setReservas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

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

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#8a2b52" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Eventos</Text>
          {!!user?.fullname && <Text style={styles.headerUser}>{user.fullname}</Text>}
        </View>
        <TouchableOpacity onPress={logout}>
          <Text style={styles.logout}>Salir</Text>
        </TouchableOpacity>
      </View>

      {!!error && <Text style={styles.error}>{error}</Text>}

      <FlatList
        data={reservas}
        keyExtractor={(item) => item._id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        contentContainerStyle={reservas.length === 0 && styles.emptyContainer}
        ListEmptyComponent={
          <Text style={styles.emptyText}>No hay eventos próximos</Text>
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.card}
            onPress={() => navigation.navigate('EventDashboard', { reservaId: item._id })}
          >
            <View style={styles.cardHeader}>
              <Text style={styles.cardDate}>{formatFecha(item.fecha)}</Text>
              <View
                style={[
                  styles.badge,
                  { backgroundColor: ESTADO_COLORS[item.estado] || '#999' },
                ]}
              >
                <Text style={styles.badgeText}>{item.estado}</Text>
              </View>
            </View>
            <Text style={styles.cardTitle}>{item.cliente}</Text>
            <Text style={styles.cardSubtitle}>
              {item.tipoEvento} · {item.horaInicio}–{item.horaFin}
            </Text>
            {item.requiereConfirmarFin && (
              <Text style={styles.warning}>⚠ Requiere confirmar cierre</Text>
            )}
          </TouchableOpacity>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    paddingTop: 8,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  headerTitle: { fontSize: 22, fontWeight: '700', color: '#8a2b52' },
  headerUser: { fontSize: 12, color: '#888' },
  logout: { color: '#c0392b', fontWeight: '600' },
  error: { color: '#c0392b', textAlign: 'center', padding: 8 },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyText: { color: '#999' },
  card: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginTop: 12,
    padding: 16,
    borderRadius: 12,
    elevation: 1,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  cardDate: { fontSize: 12, color: '#888', textTransform: 'capitalize' },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  badgeText: { color: '#fff', fontSize: 11, fontWeight: '600', textTransform: 'capitalize' },
  cardTitle: { fontSize: 18, fontWeight: '600' },
  cardSubtitle: { fontSize: 13, color: '#666', marginTop: 2 },
  warning: { color: '#e67e22', marginTop: 6, fontSize: 12, fontWeight: '600' },
});
