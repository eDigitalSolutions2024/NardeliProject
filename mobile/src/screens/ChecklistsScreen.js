import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import client from '../api/client';

export default function ChecklistsScreen({ route, navigation }) {
  const { eventId } = route.params;
  const [checklists, setChecklists] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setError('');
    try {
      const { data } = await client.get(`/app/checklists/evento/${eventId}`);
      setChecklists(Array.isArray(data) ? data : []);
    } catch (e) {
      setError(e?.response?.data?.error || 'No se pudieron cargar los checklists');
    }
  }, [eventId]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      load().finally(() => setLoading(false));
    }, [load])
  );

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#8a2b52" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {!!error && <Text style={styles.error}>{error}</Text>}
      <FlatList
        data={checklists}
        keyExtractor={(item) => item._id}
        contentContainerStyle={{ padding: 16 }}
        renderItem={({ item }) => {
          const done = item.status === 'completed' || item.completedCount === item.totalCount;
          return (
            <TouchableOpacity
              style={styles.card}
              onPress={() => navigation.navigate('ChecklistDetail', { checklistId: item._id })}
            >
              <Text style={styles.icon}>{item.icon}</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardTitle}>{item.categoryName}</Text>
                <Text style={styles.cardProgress}>
                  {item.completedCount}/{item.totalCount} completado
                </Text>
              </View>
              {done && <Text style={styles.check}>✓</Text>}
            </TouchableOpacity>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  error: { color: '#c0392b', textAlign: 'center', padding: 8 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 14,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  icon: { fontSize: 24 },
  cardTitle: { fontSize: 16, fontWeight: '600' },
  cardProgress: { fontSize: 12, color: '#666', marginTop: 2 },
  check: { color: '#2e7d32', fontSize: 20, fontWeight: '700' },
});
