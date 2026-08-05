import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import client from '../api/client';
import { colors, radius, shadow, spacing, type } from '../theme';

function Field({ label, value, onChangeText, keyboardType, placeholder }) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        style={[styles.input, focused && styles.inputFocused]}
        value={value}
        onChangeText={onChangeText}
        keyboardType={keyboardType}
        placeholder={placeholder}
        placeholderTextColor="#b9a7b0"
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
      />
    </View>
  );
}

export default function EditReservaScreen({ route, navigation }) {
  const { reservaId } = route.params;
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [form, setForm] = useState({
    cliente: '',
    correo: '',
    telefono: '',
    tipoEvento: '',
    fecha: '',
    horaInicio: '',
    horaFin: '',
    cantidadPersonas: '',
    descripcion: '',
  });

  const load = useCallback(async () => {
    setError('');
    try {
      const { data } = await client.get(`/reservas/${reservaId}`);
      setForm({
        cliente: data.cliente || '',
        correo: data.correo || '',
        telefono: data.telefono || '',
        tipoEvento: data.tipoEvento || '',
        fecha: data.fechaLocal || String(data.fecha || '').slice(0, 10),
        horaInicio: data.horaInicio || '',
        horaFin: data.horaFin || '',
        cantidadPersonas: String(data.cantidadPersonas ?? ''),
        descripcion: data.descripcion || '',
      });
    } catch (e) {
      setError(e?.response?.data?.msg || 'No se pudo cargar la reserva');
    }
  }, [reservaId]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      load().finally(() => setLoading(false));
    }, [load])
  );

  const setF = (key) => (val) => setForm((prev) => ({ ...prev, [key]: val }));

  const guardar = async () => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(form.fecha)) {
      Alert.alert('Fecha inválida', 'Usa el formato AAAA-MM-DD (ej. 2026-08-15).');
      return;
    }
    if (!/^\d{1,2}:\d{2}$/.test(form.horaInicio) || !/^\d{1,2}:\d{2}$/.test(form.horaFin)) {
      Alert.alert('Horario inválido', 'Usa el formato HH:MM (ej. 18:00).');
      return;
    }
    setSaving(true);
    try {
      await client.put(`/reservas/${reservaId}`, {
        cliente: form.cliente,
        correo: form.correo,
        telefono: form.telefono,
        tipoEvento: form.tipoEvento,
        fecha: form.fecha,
        horaInicio: form.horaInicio,
        horaFin: form.horaFin,
        cantidadPersonas: Number(form.cantidadPersonas) || 0,
        descripcion: form.descripcion,
      });
      Alert.alert('Listo', 'Reserva actualizada', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (e) {
      Alert.alert('No se pudo guardar', e?.response?.data?.msg || 'Error del servidor');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.center}>
        <Ionicons name="alert-circle-outline" size={28} color={colors.danger} />
        <Text style={styles.errorText}>{error}</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: spacing.md }}>
      <View style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>Datos del cliente</Text>
        <Field label="Cliente" value={form.cliente} onChangeText={setF('cliente')} />
        <Field label="Correo" value={form.correo} onChangeText={setF('correo')} keyboardType="email-address" />
        <Field label="Teléfono" value={form.telefono} onChangeText={setF('telefono')} keyboardType="phone-pad" />
      </View>

      <View style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>Detalles del evento</Text>
        <Field label="Tipo de evento" value={form.tipoEvento} onChangeText={setF('tipoEvento')} />
        <Field label="Fecha (AAAA-MM-DD)" value={form.fecha} onChangeText={setF('fecha')} placeholder="2026-08-15" />
        <View style={styles.row}>
          <View style={{ flex: 1, marginRight: 8 }}>
            <Field label="Hora inicio" value={form.horaInicio} onChangeText={setF('horaInicio')} placeholder="18:00" />
          </View>
          <View style={{ flex: 1 }}>
            <Field label="Hora fin" value={form.horaFin} onChangeText={setF('horaFin')} placeholder="23:00" />
          </View>
        </View>
        <Field
          label="Cantidad de personas"
          value={form.cantidadPersonas}
          onChangeText={setF('cantidadPersonas')}
          keyboardType="number-pad"
        />
        <Field label="Descripción" value={form.descripcion} onChangeText={setF('descripcion')} />
      </View>

      <TouchableOpacity style={styles.saveBtn} activeOpacity={0.85} disabled={saving} onPress={guardar}>
        {saving ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <>
            <Ionicons name="save-outline" size={17} color="#fff" />
            <Text style={styles.saveBtnText}>Guardar cambios</Text>
          </>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, gap: 10 },
  errorText: { color: colors.danger, textAlign: 'center' },
  sectionCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    ...shadow.sm,
  },
  sectionTitle: { ...type.h3, fontSize: 15, color: colors.primary, marginBottom: spacing.sm },
  field: { marginBottom: 14 },
  label: { ...type.label, color: colors.textMuted, textTransform: 'uppercase', marginBottom: 6 },
  input: {
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.bg,
    borderRadius: radius.sm,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: colors.text,
  },
  inputFocused: { borderColor: colors.primary, backgroundColor: colors.surface },
  row: { flexDirection: 'row' },
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: 15,
    marginTop: spacing.xs,
    marginBottom: spacing.xl,
    ...shadow.sm,
  },
  saveBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});
