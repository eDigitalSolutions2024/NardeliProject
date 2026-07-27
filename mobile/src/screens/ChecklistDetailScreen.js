import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  TextInput,
  Image,
  Alert,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import client from '../api/client';
import { API_ORIGIN } from '../api/config';

function ChecklistItem({ item, checklistId, onChanged }) {
  const [observation, setObservation] = useState(item.observation || '');
  const [uploading, setUploading] = useState(false);

  const toggleCompleted = async () => {
    try {
      await client.patch(`/app/checklists/${checklistId}/items/${item._id}`, {
        completed: !item.completed,
      });
      onChanged();
    } catch (e) {
      Alert.alert('Error', 'No se pudo actualizar la tarea');
    }
  };

  const saveObservation = async () => {
    if (observation === (item.observation || '')) return;
    try {
      await client.patch(`/app/checklists/${checklistId}/items/${item._id}`, { observation });
      onChanged();
    } catch (e) {
      Alert.alert('Error', 'No se pudo guardar la observación');
    }
  };

  const addPhoto = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permiso requerido', 'Necesitamos acceso a la cámara para adjuntar evidencia');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({ quality: 0.6 });
    if (result.canceled) return;

    const asset = result.assets[0];
    const form = new FormData();
    form.append('photo', {
      uri: asset.uri,
      name: asset.fileName || `evidencia-${Date.now()}.jpg`,
      type: 'image/jpeg',
    });

    setUploading(true);
    try {
      await client.post(
        `/app/checklists/${checklistId}/items/${item._id}/evidence`,
        form,
        { headers: { 'Content-Type': 'multipart/form-data' } }
      );
      onChanged();
    } catch (e) {
      Alert.alert('Error', 'No se pudo subir la foto');
    } finally {
      setUploading(false);
    }
  };

  return (
    <View style={styles.item}>
      <View style={styles.itemRow}>
        <TouchableOpacity
          style={[styles.checkbox, item.completed && styles.checkboxDone]}
          onPress={toggleCompleted}
        >
          {item.completed && <Text style={styles.checkboxMark}>✓</Text>}
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={[styles.itemTitle, item.completed && styles.itemTitleDone]}>
            {item.title}
          </Text>
          {!!item.description && <Text style={styles.itemDesc}>{item.description}</Text>}
        </View>
      </View>

      {item.requiresObservation && (
        <TextInput
          style={styles.observationInput}
          placeholder="Observación..."
          value={observation}
          onChangeText={setObservation}
          onBlur={saveObservation}
          multiline
        />
      )}

      {item.requiresPhoto && (
        <View style={styles.evidenceRow}>
          {(item.evidence || []).map((ev) => (
            <Image
              key={ev._id}
              source={{ uri: `${API_ORIGIN}${ev.url}` }}
              style={styles.evidenceThumb}
            />
          ))}
          <TouchableOpacity style={styles.addPhotoBtn} onPress={addPhoto} disabled={uploading}>
            {uploading ? (
              <ActivityIndicator size="small" color="#8a2b52" />
            ) : (
              <Text style={styles.addPhotoText}>📷 +</Text>
            )}
          </TouchableOpacity>
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
        <ActivityIndicator size="large" color="#8a2b52" />
      </View>
    );
  }

  if (error || !checklist) {
    return (
      <View style={styles.center}>
        <Text style={styles.error}>{error || 'Checklist no encontrado'}</Text>
      </View>
    );
  }

  return (
    <FlatList
      style={styles.container}
      contentContainerStyle={{ padding: 16 }}
      data={checklist.items.slice().sort((a, b) => a.order - b.order)}
      keyExtractor={(item) => item._id}
      ListHeaderComponent={
        <Text style={styles.header}>
          {checklist.icon} {checklist.categoryName} — {checklist.completedCount}/
          {checklist.totalCount}
        </Text>
      }
      renderItem={({ item }) => (
        <ChecklistItem item={item} checklistId={checklistId} onChanged={load} />
      )}
    />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  error: { color: '#c0392b', textAlign: 'center' },
  header: { fontSize: 18, fontWeight: '700', marginBottom: 12 },
  item: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 14,
    marginBottom: 10,
  },
  itemRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  checkbox: {
    width: 26,
    height: 26,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#8a2b52',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxDone: { backgroundColor: '#8a2b52' },
  checkboxMark: { color: '#fff', fontWeight: '700' },
  itemTitle: { fontSize: 15, fontWeight: '600' },
  itemTitleDone: { textDecorationLine: 'line-through', color: '#999' },
  itemDesc: { fontSize: 12, color: '#666', marginTop: 2 },
  observationInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 8,
    marginTop: 10,
    fontSize: 13,
  },
  evidenceRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  evidenceThumb: { width: 56, height: 56, borderRadius: 8 },
  addPhotoBtn: {
    width: 56,
    height: 56,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#8a2b52',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addPhotoText: { fontSize: 12 },
});
