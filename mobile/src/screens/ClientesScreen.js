import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import client from '../api/client';
import { colors, radius, shadow, spacing, type } from '../theme';

function initials(name) {
  const parts = String(name || '').trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() || '').join('') || '?';
}

function agruparClientes(reservas) {
  const map = new Map();
  for (const r of reservas) {
    const key = (r.correo || `${r.cliente}-${r.telefono}`).toLowerCase();
    const prev = map.get(key);
    if (!prev) {
      map.set(key, {
        key,
        cliente: r.cliente,
        correo: r.correo,
        telefono: r.telefono,
        total: 1,
        ultimaFecha: r.fecha,
        ultimoEstado: r.estado,
      });
    } else {
      prev.total += 1;
      if (new Date(r.fecha) > new Date(prev.ultimaFecha)) {
        prev.ultimaFecha = r.fecha;
        prev.ultimoEstado = r.estado;
      }
    }
  }
  return Array.from(map.values()).sort(
    (a, b) => new Date(b.ultimaFecha) - new Date(a.ultimaFecha)
  );
}

export default function ClientesScreen({ navigation }) {
  const [clientes, setClientes] = useState([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setError('');
    try {
      const { data } = await client.get('/reservas');
      setClientes(agruparClientes(Array.isArray(data) ? data : []));
    } catch (e) {
      setError(e?.response?.data?.msg || 'No se pudieron cargar los clientes');
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      load().finally(() => setLoading(false));
    }, [load])
  );

  const filtrados = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return clientes;
    return clientes.filter(
      (c) =>
        c.cliente?.toLowerCase().includes(q) ||
        c.correo?.toLowerCase().includes(q) ||
        c.telefono?.toLowerCase().includes(q)
    );
  }, [clientes, query]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.searchBox}>
        <Ionicons name="search" size={17} color={colors.textMuted} />
        <TextInput
          style={styles.searchInput}
          placeholder="Buscar por nombre, correo o teléfono"
          placeholderTextColor="#b9a7b0"
          value={query}
          onChangeText={setQuery}
          autoCapitalize="none"
        />
        {!!query && (
          <TouchableOpacity onPress={() => setQuery('')} hitSlop={8}>
            <Ionicons name="close-circle" size={17} color={colors.textMuted} />
          </TouchableOpacity>
        )}
      </View>

      {!!error && <Text style={styles.error}>{error}</Text>}

      <FlatList
        data={filtrados}
        keyExtractor={(item) => item.key}
        contentContainerStyle={{ padding: spacing.md, paddingTop: spacing.sm }}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="people-outline" size={28} color={colors.border} />
            <Text style={styles.emptyText}>
              {query ? 'Sin resultados para tu búsqueda' : 'Aún no hay clientes registrados'}
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.card}
            activeOpacity={0.85}
            onPress={() =>
              navigation.navigate('ClienteDetalle', { correo: item.correo, cliente: item.cliente })
            }
          >
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{initials(item.cliente)}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardName}>{item.cliente}</Text>
              {!!item.correo && (
                <Text style={styles.cardMeta} numberOfLines={1}>{item.correo}</Text>
              )}
              {!!item.telefono && <Text style={styles.cardMeta}>{item.telefono}</Text>}
            </View>
            <View style={styles.countBadge}>
              <Text style={styles.countBadgeText}>{item.total}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
          </TouchableOpacity>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  error: { color: colors.danger, textAlign: 'center', paddingHorizontal: spacing.md },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.surface,
    marginHorizontal: spacing.md,
    marginTop: spacing.md,
    paddingHorizontal: 14,
    height: 46,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    ...shadow.sm,
  },
  searchInput: { flex: 1, fontSize: 14, color: colors.text },
  emptyState: { alignItems: 'center', gap: 8, paddingTop: 60 },
  emptyText: { color: colors.textMuted, textAlign: 'center' },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md - 2,
    marginBottom: 10,
    ...shadow.sm,
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: colors.primary, fontWeight: '800', fontSize: 14 },
  cardName: { ...type.h3, fontSize: 15 },
  cardMeta: { fontSize: 12, color: colors.textMuted, marginTop: 1 },
  countBadge: {
    minWidth: 24,
    height: 24,
    borderRadius: 12,
    paddingHorizontal: 6,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  countBadgeText: { color: '#fff', fontWeight: '700', fontSize: 12 },
});
