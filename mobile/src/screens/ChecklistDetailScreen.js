import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  Image,
  TouchableOpacity,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import client from '../api/client';
import { API_ORIGIN } from '../api/config';
import { colors, radius, shadow, spacing, type } from '../theme';
import ZoomableImageModal from '../components/ZoomableImageModal';

// Solo lectura: la app móvil únicamente muestra el estado de los checklists
// (marcarlos, agregar observaciones o evidencia se sigue haciendo desde el
// sistema en línea).
function ChecklistItem({ item, onPressPhoto }) {
  return (
    <View style={styles.item}>
      <View style={styles.itemRow}>
        <View style={[styles.checkbox, item.completed && styles.checkboxDone]}>
          {item.completed && <Ionicons name="checkmark" size={15} color="#fff" />}
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.itemTitle, item.completed && styles.itemTitleDone]}>
            {item.title}
          </Text>
          {!!item.description && <Text style={styles.itemDesc}>{item.description}</Text>}
        </View>
      </View>

      {item.requiresObservation && !!item.observation && (
        <View style={styles.observationBox}>
          <Ionicons name="chatbox-outline" size={13} color={colors.textMuted} />
          <Text style={styles.observationText}>{item.observation}</Text>
        </View>
      )}

      {item.requiresPhoto && (item.evidence || []).length > 0 && (
        <View style={styles.evidenceRow}>
          {item.evidence.map((ev, index) => (
            <TouchableOpacity
              key={ev._id}
              onPress={() =>
                onPressPhoto(
                  item.evidence.map((e) => `${API_ORIGIN}${e.url}`),
                  index
                )
              }
            >
              <Image
                source={{ uri: `${API_ORIGIN}${ev.url}` }}
                style={styles.evidenceThumb}
              />
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
}

export default function ChecklistDetailScreen({ route }) {
  const { checklistId } = route.params;
  const [checklist, setChecklist] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [gallery, setGallery] = useState(null); // { images, index }

  const load = useCallback(async () => {
    setError('');
    try {
      const { data } = await client.get(`/app/checklists/${checklistId}`);
      setChecklist(data);
    } catch (e) {
      setError('No se pudo cargar el checklist');
    }
  }, [checklistId]);

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

  if (error || !checklist) {
    return (
      <View style={styles.center}>
        <Ionicons name="alert-circle-outline" size={28} color={colors.danger} />
        <Text style={styles.error}>{error || 'Checklist no encontrado'}</Text>
      </View>
    );
  }

  return (
    <>
      <FlatList
        style={styles.container}
        contentContainerStyle={{ padding: spacing.md }}
        data={checklist.items.slice().sort((a, b) => a.order - b.order)}
        keyExtractor={(item) => item._id}
        ListHeaderComponent={
          <View style={styles.header}>
            <Text style={styles.headerIcon}>{checklist.icon}</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.headerTitle}>{checklist.categoryName}</Text>
              <Text style={styles.headerProgress}>
                {checklist.completedCount}/{checklist.totalCount} completado
              </Text>
            </View>
          </View>
        }
        renderItem={({ item }) => (
          <ChecklistItem
            item={item}
            onPressPhoto={(images, index) => setGallery({ images, index })}
          />
        )}
      />
      <ZoomableImageModal
        visible={!!gallery}
        images={gallery?.images}
        initialIndex={gallery?.index || 0}
        onClose={() => setGallery(null)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 10 },
  error: { color: colors.danger, textAlign: 'center' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    ...shadow.sm,
  },
  headerIcon: { fontSize: 26 },
  headerTitle: { ...type.h3, fontSize: 17 },
  headerProgress: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  item: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md - 2,
    marginBottom: 10,
    ...shadow.sm,
  },
  itemRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  checkbox: {
    width: 26,
    height: 26,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxDone: { backgroundColor: colors.primary },
  itemTitle: { fontSize: 15, fontWeight: '600', color: colors.text },
  itemTitleDone: { textDecorationLine: 'line-through', color: colors.textMuted },
  itemDesc: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  observationBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    marginTop: 10,
    fontSize: 13,
    backgroundColor: colors.bg,
    borderRadius: radius.sm,
    padding: 8,
  },
  observationText: { flex: 1, fontSize: 13, color: colors.textMuted },
  evidenceRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  evidenceThumb: { width: 84, height: 84, borderRadius: radius.sm },
});
