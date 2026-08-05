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
import { Ionicons } from '@expo/vector-icons';
import client from '../api/client';
import { colors, radius, shadow, spacing } from '../theme';

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
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {!!error && <Text style={styles.error}>{error}</Text>}
      <FlatList
        data={checklists}
        keyExtractor={(item) => item._id}
        contentContainerStyle={{ padding: spacing.md }}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="clipboard-outline" size={28} color={colors.border} />
            <Text style={styles.emptyText}>Sin checklists asignados</Text>
          </View>
        }
        renderItem={({ item }) => {
          const done = item.status === 'completed' || item.completedCount === item.totalCount;
          const pct = item.totalCount ? item.completedCount / item.totalCount : 0;
          return (
            <TouchableOpacity
              style={styles.card}
              activeOpacity={0.85}
              onPress={() => navigation.navigate('ChecklistDetail', { checklistId: item._id })}
            >
              <View style={styles.row}>
                <View style={styles.iconWrap}>
                  <Text style={styles.icon}>{item.icon}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardTitle}>{item.categoryName}</Text>
                  <Text style={styles.cardProgress}>
                    {item.completedCount}/{item.totalCount} completado
                  </Text>
                </View>
                {done ? (
                  <View style={styles.doneBadge}>
                    <Ionicons name="checkmark" size={14} color="#fff" />
                  </View>
                ) : (
                  <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
                )}
              </View>
              <View style={styles.progressTrack}>
                <View
                  style={[
                    styles.progressFill,
                    { width: `${Math.round(pct * 100)}%` },
                    done && styles.progressFillDone,
                  ]}
                />
              </View>
            </TouchableOpacity>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  error: { color: colors.danger, textAlign: 'center', padding: 8 },
  emptyState: { alignItems: 'center', gap: 8, paddingTop: 60 },
  emptyText: { color: colors.textMuted },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md - 2,
    marginBottom: 10,
    ...shadow.sm,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: radius.sm,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: { fontSize: 20 },
  cardTitle: { fontSize: 16, fontWeight: '700', color: colors.text },
  cardProgress: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  doneBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.success,
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressTrack: {
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.border,
    marginTop: 10,
    overflow: 'hidden',
  },
  progressFill: { height: '100%', borderRadius: 3, backgroundColor: colors.primary },
  progressFillDone: { backgroundColor: colors.success },
});
