import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Share,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import client from '../offline/offlineClient';
import { API_ORIGIN } from '../api/config';
import { useAuth } from '../context/AuthContext';
import { colors, estadoColors, radius, shadow, spacing, type } from '../theme';

function NuevaInvitacionForm({ onCrear, creando }) {
  const [nombreFamilia, setNombreFamilia] = useState('');
  const [personas, setPersonas] = useState('');
  const [notas, setNotas] = useState('');

  const enviar = () => {
    const n = Number(personas);
    if (!nombreFamilia.trim()) return Alert.alert('Falta el nombre de la familia/invitado');
    if (!Number.isFinite(n) || n < 1) return Alert.alert('La cantidad de personas debe ser mayor a 0');
    onCrear({ nombreFamilia: nombreFamilia.trim(), personasAutorizadas: n, notas }, () => {
      setNombreFamilia('');
      setPersonas('');
      setNotas('');
    });
  };

  return (
    <View style={styles.formCard}>
      <View style={styles.formTitleRow}>
        <Ionicons name="add-circle" size={17} color={colors.primary} />
        <Text style={styles.formTitle}>Nueva invitación</Text>
      </View>
      <TextInput
        style={styles.input}
        placeholder="Nombre de la familia / invitado"
        placeholderTextColor="#b9a7b0"
        value={nombreFamilia}
        onChangeText={setNombreFamilia}
      />
      <TextInput
        style={styles.input}
        placeholder="Personas autorizadas"
        placeholderTextColor="#b9a7b0"
        keyboardType="number-pad"
        value={personas}
        onChangeText={setPersonas}
      />
      <TextInput
        style={styles.input}
        placeholder="Notas (opcional)"
        placeholderTextColor="#b9a7b0"
        value={notas}
        onChangeText={setNotas}
      />
      <TouchableOpacity style={styles.primaryBtn} activeOpacity={0.85} disabled={creando} onPress={enviar}>
        {creando ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryBtnText}>Generar invitación</Text>}
      </TouchableOpacity>
    </View>
  );
}

function InvitacionRow({ inv, isAdmin, onCancelar, onEditar }) {
  const [editando, setEditando] = useState(false);
  const [personas, setPersonas] = useState(String(inv.personasAutorizadas));
  const [entradas, setEntradas] = useState(String(inv.entradasRestantes));
  const [guardando, setGuardando] = useState(false);

  const guardar = async () => {
    setGuardando(true);
    await onEditar(inv, Number(personas), Number(entradas));
    setGuardando(false);
    setEditando(false);
  };

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardTitle}>{inv.nombreFamilia}</Text>
        <View style={[styles.badge, { backgroundColor: estadoColors[inv.estado] || colors.neutral }]}>
          <Text style={styles.badgeText}>{inv.estado}</Text>
        </View>
      </View>

      {editando ? (
        <View>
          <Text style={styles.smallLabel}>Personas autorizadas</Text>
          <TextInput style={styles.inputSmall} keyboardType="number-pad" value={personas} onChangeText={setPersonas} />
          <Text style={styles.smallLabel}>Entradas restantes</Text>
          <TextInput style={styles.inputSmall} keyboardType="number-pad" value={entradas} onChangeText={setEntradas} />
          <View style={styles.rowActions}>
            <TouchableOpacity style={styles.outlineBtnSmall} onPress={() => setEditando(false)}>
              <Text style={styles.outlineBtnSmallText}>Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.primaryBtnSmall} disabled={guardando} onPress={guardar}>
              {guardando ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.primaryBtnSmallText}>Guardar</Text>}
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <>
          <Text style={styles.cardSubtitle}>
            {inv.personasAutorizadas} autorizadas · {inv.entradasRestantes} restantes
          </Text>
          {!!inv.notas && <Text style={styles.cardNotas}>{inv.notas}</Text>}
          {inv.estado !== 'cancelada' && (
            <View style={styles.rowActions}>
              {isAdmin && (
                <TouchableOpacity style={styles.outlineBtnSmall} onPress={() => setEditando(true)}>
                  <Text style={styles.outlineBtnSmallText}>Editar</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity style={styles.dangerBtnSmall} onPress={() => onCancelar(inv)}>
                <Text style={styles.dangerBtnSmallText}>Cancelar invitación</Text>
              </TouchableOpacity>
            </View>
          )}
        </>
      )}
    </View>
  );
}

export default function InvitacionesScreen({ route }) {
  const { reservaId } = route.params;
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  const [portal, setPortal] = useState(null); // { token, codigo }
  const [invitaciones, setInvitaciones] = useState([]);
  const [capacidadTotal, setCapacidadTotal] = useState(0);
  const [disponibles, setDisponibles] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [creando, setCreando] = useState(false);

  const cargarInvitaciones = useCallback(async (token) => {
    const { data } = await client.get(`/invitaciones-qr/${token}`);
    setInvitaciones(Array.isArray(data.invitaciones) ? data.invitaciones : []);
    setCapacidadTotal(data.capacidadTotal || 0);
    setDisponibles(data.disponibles || 0);
  }, []);

  const load = useCallback(async () => {
    setError('');
    try {
      const { data } = await client.post(`/invitaciones-portal/generar/${reservaId}`);
      setPortal(data);
      await cargarInvitaciones(data.token);
    } catch (e) {
      setError(e?.response?.data?.msg || 'No se pudo cargar el portal de invitaciones');
    }
  }, [reservaId, cargarInvitaciones]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      load().finally(() => setLoading(false));
    }, [load])
  );

  const compartir = async () => {
    if (!portal) return;
    const link = `${API_ORIGIN}/invitaciones/${portal.token}`;
    try {
      await Share.share({
        message: `Acceso a invitaciones de tu evento Nardeli:\n${link}\nCódigo: ${portal.codigo}`,
      });
    } catch {}
  };

  const crearInvitacion = async (body, onDone) => {
    setCreando(true);
    try {
      await client.post(`/invitaciones-qr/${portal.token}`, body);
      await cargarInvitaciones(portal.token);
      onDone?.();
    } catch (e) {
      Alert.alert('No se pudo crear', e?.response?.data?.msg || 'Error del servidor');
    } finally {
      setCreando(false);
    }
  };

  const cancelarInvitacion = (inv) => {
    Alert.alert('Cancelar invitación', `¿Cancelar la invitación de "${inv.nombreFamilia}"?`, [
      { text: 'No', style: 'cancel' },
      {
        text: 'Sí, cancelar',
        style: 'destructive',
        onPress: async () => {
          try {
            await client.patch(`/invitaciones-qr/${portal.token}/${inv._id}/cancelar`);
            await cargarInvitaciones(portal.token);
          } catch (e) {
            Alert.alert('Error', e?.response?.data?.msg || 'No se pudo cancelar');
          }
        },
      },
    ]);
  };

  const editarInvitacion = async (inv, personasAutorizadas, entradasRestantes) => {
    try {
      await client.patch(`/invitaciones-qr/${portal.token}/${inv._id}`, {
        personasAutorizadas,
        entradasRestantes,
      });
      await cargarInvitaciones(portal.token);
    } catch (e) {
      Alert.alert('No se pudo editar', e?.response?.data?.msg || 'Error del servidor');
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
    <FlatList
      style={styles.container}
      contentContainerStyle={{ padding: spacing.md }}
      data={invitaciones}
      keyExtractor={(item) => item._id}
      ListHeaderComponent={
        <>
          <View style={styles.summaryCard}>
            <View style={styles.summaryTop}>
              <Ionicons name="ticket" size={18} color="#fff" />
              <Text style={styles.summaryText}>
                {disponibles} de {capacidadTotal} pases disponibles
              </Text>
            </View>
            <View style={styles.summaryTrack}>
              <View
                style={[
                  styles.summaryFill,
                  { width: `${capacidadTotal ? Math.min(100, (disponibles / capacidadTotal) * 100) : 0}%` },
                ]}
              />
            </View>
            <TouchableOpacity style={styles.outlineBtn} activeOpacity={0.85} onPress={compartir}>
              <Ionicons name="share-social-outline" size={14} color="#fff" />
              <Text style={styles.outlineBtnText}>Compartir portal · código {portal?.codigo}</Text>
            </TouchableOpacity>
          </View>
          <NuevaInvitacionForm onCrear={crearInvitacion} creando={creando} />
          <Text style={styles.listTitle}>Invitaciones ({invitaciones.length})</Text>
        </>
      }
      ListEmptyComponent={
        <View style={styles.emptyState}>
          <Ionicons name="people-outline" size={28} color={colors.border} />
          <Text style={styles.emptyText}>Sin invitaciones todavía</Text>
        </View>
      }
      renderItem={({ item }) => (
        <InvitacionRow inv={item} isAdmin={isAdmin} onCancelar={cancelarInvitacion} onEditar={editarInvitacion} />
      )}
    />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, gap: 10 },
  errorText: { color: colors.danger, textAlign: 'center' },
  summaryCard: {
    backgroundColor: colors.primary,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    ...shadow.md,
  },
  summaryTop: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  summaryText: { fontSize: 15, fontWeight: '700', color: '#fff' },
  summaryTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.25)',
    overflow: 'hidden',
    marginBottom: 12,
  },
  summaryFill: { height: '100%', borderRadius: 3, backgroundColor: '#fff' },
  formCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    ...shadow.sm,
  },
  formTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 },
  formTitle: { fontSize: 14, fontWeight: '700', color: colors.primary },
  input: {
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.bg,
    borderRadius: radius.sm,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 14,
    color: colors.text,
    marginBottom: 8,
  },
  listTitle: { ...type.h3, fontSize: 14, color: colors.text, marginBottom: spacing.sm },
  emptyState: { alignItems: 'center', gap: 8, paddingTop: 30 },
  emptyText: { color: colors.textMuted, textAlign: 'center' },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: 10,
    ...shadow.sm,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  cardTitle: { fontSize: 15, fontWeight: '700', color: colors.text },
  cardSubtitle: { fontSize: 13, color: colors.textMuted, marginTop: 2 },
  cardNotas: { fontSize: 12, color: colors.textMuted, marginTop: 4, fontStyle: 'italic' },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.pill },
  badgeText: { color: '#fff', fontSize: 11, fontWeight: '700', textTransform: 'capitalize' },
  rowActions: { flexDirection: 'row', gap: 8, marginTop: 10 },
  primaryBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.sm,
    paddingVertical: 11,
    alignItems: 'center',
    marginTop: 4,
  },
  primaryBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  outlineBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.6)',
    borderRadius: radius.sm,
    paddingVertical: 9,
  },
  outlineBtnText: { color: '#fff', fontWeight: '700', fontSize: 12 },
  smallLabel: { fontSize: 11, color: colors.textMuted, marginTop: 6, marginBottom: 2 },
  inputSmall: {
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.sm - 2,
    paddingHorizontal: 10,
    paddingVertical: 6,
    fontSize: 13,
    color: colors.text,
  },
  outlineBtnSmall: {
    borderWidth: 1.5,
    borderColor: colors.primary,
    borderRadius: radius.sm - 2,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  outlineBtnSmallText: { color: colors.primary, fontWeight: '700', fontSize: 12 },
  primaryBtnSmall: {
    backgroundColor: colors.primary,
    borderRadius: radius.sm - 2,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  primaryBtnSmallText: { color: '#fff', fontWeight: '700', fontSize: 12 },
  dangerBtnSmall: {
    borderWidth: 1.5,
    borderColor: colors.danger,
    borderRadius: radius.sm - 2,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  dangerBtnSmallText: { color: colors.danger, fontWeight: '700', fontSize: 12 },
});
