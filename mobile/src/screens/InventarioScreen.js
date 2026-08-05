import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Image,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import client from '../api/client';
import { API_ORIGIN } from '../api/config';
import Stepper from '../components/Stepper';
import { colors, radius, shadow, spacing } from '../theme';

function money(n) {
  const v = Number(n) || 0;
  try {
    return v.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' });
  } catch {
    return `$${v.toFixed(2)}`;
  }
}

function stockColor(stock) {
  if (stock <= 0) return colors.danger;
  if (stock < 5) return colors.warning;
  return colors.success;
}

function ProductoRow({ item, onGuardar }) {
  const [editando, setEditando] = useState(false);
  const [cantidad, setCantidad] = useState(item.cantidad);
  const [precio, setPrecio] = useState(String(item.precio ?? 0));
  const [guardando, setGuardando] = useState(false);

  const cancelar = () => {
    setCantidad(item.cantidad);
    setPrecio(String(item.precio ?? 0));
    setEditando(false);
  };

  const guardar = async () => {
    setGuardando(true);
    try {
      await onGuardar(item._id, { cantidad: Number(cantidad) || 0, precio: Number(precio) || 0 });
      setEditando(false);
    } catch (e) {
      Alert.alert('No se pudo guardar', e?.response?.data?.msg || 'Error del servidor');
    } finally {
      setGuardando(false);
    }
  };

  return (
    <View style={styles.card}>
      <View style={styles.row}>
        {item.imagen ? (
          <Image source={{ uri: `${API_ORIGIN}${item.imagen}` }} style={styles.thumb} />
        ) : (
          <View style={styles.thumbPlaceholder}>
            <Ionicons name="cube-outline" size={20} color={colors.textMuted} />
          </View>
        )}
        <View style={{ flex: 1 }}>
          <Text style={styles.nombre}>{item.nombre}</Text>
          <Text style={styles.categoria}>{item.categoria}</Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={styles.precio}>{money(item.precio)}</Text>
          <View style={[styles.stockBadge, { backgroundColor: stockColor(item.cantidad) }]}>
            <Text style={styles.stockBadgeText}>{item.cantidad} en stock</Text>
          </View>
        </View>
      </View>

      {editando ? (
        <View style={styles.editBox}>
          <Text style={styles.smallLabel}>Existencias</Text>
          <Stepper value={cantidad} onChange={setCantidad} />
          <Text style={styles.smallLabel}>Precio</Text>
          <TextInput
            style={styles.inputSmall}
            keyboardType="decimal-pad"
            value={precio}
            onChangeText={setPrecio}
          />
          <View style={styles.rowActions}>
            <TouchableOpacity style={styles.outlineBtnSmall} onPress={cancelar} disabled={guardando}>
              <Text style={styles.outlineBtnSmallText}>Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.primaryBtnSmall} disabled={guardando} onPress={guardar}>
              {guardando ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.primaryBtnSmallText}>Guardar</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <TouchableOpacity style={styles.editLink} onPress={() => setEditando(true)} hitSlop={8}>
          <Ionicons name="pencil" size={13} color={colors.primary} />
          <Text style={styles.editLinkText}>Editar precio / existencias</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

export default function InventarioScreen() {
  const [productos, setProductos] = useState([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setError('');
    try {
      const { data } = await client.get('/productos');
      setProductos(Array.isArray(data) ? data : []);
    } catch (e) {
      setError(e?.response?.data?.msg || 'No se pudo cargar el inventario');
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      load().finally(() => setLoading(false));
    }, [load])
  );

  const guardarProducto = async (id, cambios) => {
    const { data } = await client.put(`/productos/${id}`, cambios);
    setProductos((prev) => prev.map((p) => (p._id === id ? data : p)));
  };

  const filtrados = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return productos;
    return productos.filter(
      (p) => p.nombre?.toLowerCase().includes(q) || p.categoria?.toLowerCase().includes(q)
    );
  }, [productos, query]);

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
          placeholder="Buscar por nombre o categoría"
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
        keyExtractor={(item) => item._id}
        contentContainerStyle={{ padding: spacing.md, paddingTop: spacing.sm }}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="cube-outline" size={28} color={colors.border} />
            <Text style={styles.emptyText}>
              {query ? 'Sin resultados para tu búsqueda' : 'Sin productos en el catálogo'}
            </Text>
          </View>
        }
        renderItem={({ item }) => <ProductoRow item={item} onGuardar={guardarProducto} />}
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
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md - 2,
    marginBottom: 10,
    ...shadow.sm,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  thumb: { width: 44, height: 44, borderRadius: radius.sm },
  thumbPlaceholder: {
    width: 44,
    height: 44,
    borderRadius: radius.sm,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nombre: { fontSize: 15, fontWeight: '700', color: colors.text },
  categoria: { fontSize: 12, color: colors.textMuted, marginTop: 2, textTransform: 'capitalize' },
  precio: { fontSize: 14, fontWeight: '800', color: colors.text },
  stockBadge: { marginTop: 4, paddingHorizontal: 8, paddingVertical: 2, borderRadius: radius.pill },
  stockBadgeText: { color: '#fff', fontSize: 10, fontWeight: '700' },
  editLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  editLinkText: { color: colors.primary, fontWeight: '700', fontSize: 12 },
  editBox: { marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: colors.border },
  smallLabel: { fontSize: 11, color: colors.textMuted, marginTop: 6, marginBottom: 4 },
  inputSmall: {
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.sm - 2,
    paddingHorizontal: 10,
    paddingVertical: 6,
    fontSize: 13,
    color: colors.text,
  },
  rowActions: { flexDirection: 'row', gap: 8, marginTop: 12 },
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
});
