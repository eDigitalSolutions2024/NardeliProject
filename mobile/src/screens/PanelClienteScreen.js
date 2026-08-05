import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ScrollView,
  FlatList,
  Modal,
  Linking,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import client from '../api/client';
import { API_BASE_URL } from '../api/config';
import { useAuth } from '../context/AuthContext';
import Stepper from '../components/Stepper';
import { colors, radius, shadow, spacing, type } from '../theme';

function money(n, currency = 'MXN') {
  const v = Number(n) || 0;
  try {
    return v.toLocaleString('es-MX', { style: 'currency', currency });
  } catch {
    return `$${v.toFixed(2)}`;
  }
}

function formatFecha(fecha) {
  try {
    return new Date(fecha).toLocaleDateString('es-MX', {
      weekday: 'long',
      day: '2-digit',
      month: 'long',
    });
  } catch {
    return fecha;
  }
}

function formatFechaCorta(fecha) {
  try {
    return new Date(fecha).toLocaleDateString('es-MX', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return fecha;
  }
}

async function abrirUrl(url) {
  try {
    await Linking.openURL(url);
  } catch {
    Alert.alert('No se pudo abrir', 'No se encontró una app para ver el PDF.');
  }
}

function UtensilioRow({ item, isAdmin, onGuardar }) {
  const [editando, setEditando] = useState(false);
  const [cantidad, setCantidad] = useState(item.cantidad);
  const [precio, setPrecio] = useState(String(item.precio ?? 0));
  const [guardando, setGuardando] = useState(false);

  const subtotal = (Number(item.cantidad) || 0) * (Number(item.precio) || 0);

  const cancelar = () => {
    setCantidad(item.cantidad);
    setPrecio(String(item.precio ?? 0));
    setEditando(false);
  };

  const guardar = async () => {
    setGuardando(true);
    try {
      const cambios = { cantidad: Number(cantidad) || 0 };
      if (isAdmin) cambios.precio = Number(precio) || 0;
      await onGuardar(item._id, cambios);
      setEditando(false);
    } catch (e) {
      Alert.alert('No se pudo guardar', e?.response?.data?.msg || 'Error del servidor');
    } finally {
      setGuardando(false);
    }
  };

  return (
    <View style={styles.itemCard}>
      <View style={styles.itemHeaderRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.itemName}>{item.nombre}</Text>
          <Text style={styles.itemMeta}>
            {item.categoria} · {item.unidad}
          </Text>
        </View>
        <Text style={styles.itemSubtotal}>{money(subtotal)}</Text>
      </View>

      {editando ? (
        <View style={styles.editBox}>
          <Text style={styles.smallLabel}>Cantidad</Text>
          <Stepper value={cantidad} onChange={setCantidad} />

          {isAdmin && (
            <>
              <Text style={styles.smallLabel}>Precio unitario</Text>
              <TextInput
                style={styles.inputSmall}
                keyboardType="decimal-pad"
                value={precio}
                onChangeText={setPrecio}
              />
            </>
          )}

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
        <View style={styles.itemFooterRow}>
          <Text style={styles.itemQtyPrice}>
            {item.cantidad} {item.unidad} × {money(item.precio)}
          </Text>
          <TouchableOpacity style={styles.editIconBtn} onPress={() => setEditando(true)} hitSlop={8}>
            <Ionicons name="pencil" size={14} color={colors.primary} />
            <Text style={styles.editIconBtnText}>Editar</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

function ReciboRow({ recibo }) {
  return (
    <View style={styles.reciboCard}>
      <View style={styles.reciboIconWrap}>
        <Ionicons name="receipt-outline" size={16} color={colors.primary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.reciboFolio}>{recibo.folio || 'Recibo'}</Text>
        <Text style={styles.reciboMeta}>
          {formatFechaCorta(recibo.issuedAt || recibo.createdAt)}
          {recibo.paymentMethod ? ` · ${recibo.paymentMethod}` : ''}
        </Text>
        {!!recibo.concept && <Text style={styles.reciboConcepto} numberOfLines={1}>{recibo.concept}</Text>}
      </View>
      <View style={{ alignItems: 'flex-end', gap: 6 }}>
        <Text style={styles.reciboMonto}>{money(recibo.amount, recibo.currency)}</Text>
        <TouchableOpacity
          style={styles.pdfLinkBtn}
          onPress={() => abrirUrl(`${API_BASE_URL}/receipts/${recibo._id}/pdf`)}
          hitSlop={6}
        >
          <Ionicons name="document-text-outline" size={12} color={colors.primary} />
          <Text style={styles.pdfLinkText}>PDF</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

export default function PanelClienteScreen({ route, navigation }) {
  const { reservaId } = route.params;
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  const [reserva, setReserva] = useState(null);
  const [utensilios, setUtensilios] = useState([]);
  const [totales, setTotales] = useState(null);
  const [recibos, setRecibos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [pickerVisible, setPickerVisible] = useState(false);
  const [catalogo, setCatalogo] = useState([]);
  const [catalogoLoaded, setCatalogoLoaded] = useState(false);
  const [catalogoLoading, setCatalogoLoading] = useState(false);
  const [catalogoQuery, setCatalogoQuery] = useState('');
  const [agregandoId, setAgregandoId] = useState(null);

  const load = useCallback(async () => {
    setError('');
    try {
      const [{ data: r }, { data: u }, { data: t }, { data: rec }] = await Promise.all([
        client.get(`/reservas/${reservaId}`),
        client.get(`/reservas/${reservaId}/utensilios`),
        client.get(`/reservas/${reservaId}/totales`),
        client.get(`/reservas/${reservaId}/receipts`),
      ]);
      setReserva(r);
      setUtensilios(Array.isArray(u) ? u : []);
      setTotales(t);
      setRecibos(Array.isArray(rec) ? rec : []);
    } catch (e) {
      setError(e?.response?.data?.msg || 'No se pudo cargar el panel del cliente');
    }
  }, [reservaId]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      load().finally(() => setLoading(false));
    }, [load])
  );

  const refreshTotales = useCallback(async () => {
    try {
      const { data: t } = await client.get(`/reservas/${reservaId}/totales`);
      setTotales(t);
    } catch {}
  }, [reservaId]);

  const guardarLinea = async (lineId, cambios) => {
    const { data } = await client.patch(`/reservas/${reservaId}/utensilios/${lineId}`, cambios);
    setUtensilios(Array.isArray(data) ? data : []);
    refreshTotales();
  };

  const abrirPicker = async () => {
    setPickerVisible(true);
    if (catalogoLoaded) return;
    setCatalogoLoading(true);
    try {
      const { data } = await client.get('/productos');
      setCatalogo(Array.isArray(data) ? data : []);
      setCatalogoLoaded(true);
    } catch (e) {
      Alert.alert('Error', 'No se pudo cargar el catálogo de productos');
    } finally {
      setCatalogoLoading(false);
    }
  };

  const agregadosIds = useMemo(
    () => new Set(utensilios.map((u) => String(u.itemId))),
    [utensilios]
  );

  const catalogoFiltrado = useMemo(() => {
    const q = catalogoQuery.trim().toLowerCase();
    if (!q) return catalogo;
    return catalogo.filter(
      (p) => p.nombre?.toLowerCase().includes(q) || p.categoria?.toLowerCase().includes(q)
    );
  }, [catalogo, catalogoQuery]);

  const agregarUtensilio = async (producto) => {
    setAgregandoId(producto._id);
    try {
      const itemsExistentes = utensilios.map((u) => ({
        itemId: u.itemId,
        nombre: u.nombre,
        cantidad: u.cantidad,
        unidad: u.unidad,
        categoria: u.categoria,
        descripcion: u.descripcion,
        precio: u.precio,
      }));
      const items = [
        ...itemsExistentes,
        {
          itemId: producto._id,
          nombre: producto.nombre,
          cantidad: 1,
          unidad: producto.unidad || 'pza',
          categoria: producto.categoria,
          descripcion: producto.descripcion,
          precio: producto.precio,
        },
      ];
      const discountItems = {};
      utensilios.forEach((u) => {
        if (u.aplicarDescuento && u.itemId) discountItems[String(u.itemId)] = true;
      });

      const { data } = await client.put(`/reservas/${reservaId}/utensilios`, { items, discountItems });
      setUtensilios(Array.isArray(data?.reserva?.utensilios) ? data.reserva.utensilios : []);
      refreshTotales();
    } catch (e) {
      Alert.alert('No se pudo agregar', e?.response?.data?.msg || 'Error del servidor');
    } finally {
      setAgregandoId(null);
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (error || !reserva) {
    return (
      <View style={styles.center}>
        <Ionicons name="alert-circle-outline" size={28} color={colors.danger} />
        <Text style={styles.errorText}>{error || 'Reserva no disponible'}</Text>
      </View>
    );
  }

  const accesorios = reserva.resumenSeleccion?.accesorios || [];

  return (
    <View style={{ flex: 1 }}>
      <ScrollView style={styles.container} contentContainerStyle={{ padding: spacing.md }}>
        <View style={styles.infoCard}>
          <View style={styles.infoHeaderRow}>
            <View style={styles.infoIconWrap}>
              <Ionicons name="person" size={16} color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.infoName}>{reserva.cliente}</Text>
              <Text style={styles.infoSub}>
                {reserva.tipoEvento} · {formatFecha(reserva.fechaLocal || reserva.fecha)}
              </Text>
            </View>
            <TouchableOpacity
              style={styles.editReservaBtn}
              onPress={() => navigation.navigate('EditReserva', { reservaId })}
              hitSlop={8}
            >
              <Ionicons name="pencil" size={14} color={colors.primary} />
            </TouchableOpacity>
          </View>

          <View style={styles.infoGrid}>
            <View style={styles.infoItem}>
              <Ionicons name="time-outline" size={14} color={colors.textMuted} />
              <Text style={styles.infoText}>{reserva.horaInicio}–{reserva.horaFin}</Text>
            </View>
            <View style={styles.infoItem}>
              <Ionicons name="people-outline" size={14} color={colors.textMuted} />
              <Text style={styles.infoText}>{reserva.cantidadPersonas} personas</Text>
            </View>
            <View style={styles.infoItem}>
              <Ionicons name="call-outline" size={14} color={colors.textMuted} />
              <Text style={styles.infoText}>{reserva.telefono}</Text>
            </View>
            <View style={styles.infoItem}>
              <Ionicons name="mail-outline" size={14} color={colors.textMuted} />
              <Text style={styles.infoText} numberOfLines={1}>{reserva.correo}</Text>
            </View>
          </View>

          <TouchableOpacity
            style={styles.pdfReservaBtn}
            activeOpacity={0.85}
            onPress={() => abrirUrl(`${API_BASE_URL}/reservas/${reservaId}/pdf`)}
          >
            <Ionicons name="document-text-outline" size={15} color={colors.primary} />
            <Text style={styles.pdfReservaBtnText}>Ver PDF de la reserva</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.totalesCard}>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Subtotal</Text>
            <Text style={styles.totalValue}>{money(totales?.subTotal)}</Text>
          </View>
          {totales?.descuento > 0 && (
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>
                Descuento{totales?.precios?.descuento?.motivo ? ` · ${totales.precios.descuento.motivo}` : ''}
              </Text>
              <Text style={styles.totalValueNeg}>-{money(totales.descuento)}</Text>
            </View>
          )}
          <View style={[styles.totalRow, styles.totalRowFinal]}>
            <Text style={styles.totalLabelFinal}>Total</Text>
            <Text style={styles.totalValueFinal}>{money(totales?.total)}</Text>
          </View>
        </View>

        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>Utensilios ({utensilios.length})</Text>
          <TouchableOpacity style={styles.addLinkBtn} onPress={abrirPicker} hitSlop={8}>
            <Ionicons name="add-circle" size={16} color={colors.primary} />
            <Text style={styles.addLinkText}>Agregar</Text>
          </TouchableOpacity>
        </View>
        {utensilios.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="cube-outline" size={28} color={colors.border} />
            <Text style={styles.emptyText}>Sin utensilios asignados</Text>
          </View>
        ) : (
          utensilios.map((item) => (
            <UtensilioRow key={item._id} item={item} isAdmin={isAdmin} onGuardar={guardarLinea} />
          ))
        )}

        {accesorios.length > 0 && (
          <>
            <Text style={[styles.sectionTitle, { marginTop: spacing.md }]}>
              Accesorios en préstamo ({accesorios.length})
            </Text>
            {accesorios.map((acc, idx) => (
              <View key={acc.accesorioId || idx} style={styles.accCard}>
                <Ionicons name="cube-outline" size={16} color={colors.primary} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.accName}>{acc.nombre}</Text>
                  <Text style={styles.accMeta}>
                    {acc.cantidad} {acc.unidad || 'pza'} · préstamo (sin costo)
                  </Text>
                </View>
              </View>
            ))}
          </>
        )}

        <Text style={[styles.sectionTitle, { marginTop: spacing.md }]}>
          Historial de recibos ({recibos.length})
        </Text>
        {recibos.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="receipt-outline" size={28} color={colors.border} />
            <Text style={styles.emptyText}>Sin recibos registrados</Text>
          </View>
        ) : (
          recibos.map((r) => <ReciboRow key={r._id} recibo={r} />)
        )}

        {!isAdmin && (
          <Text style={styles.hint}>
            Solo un administrador puede modificar precios. Como asistente puedes ajustar cantidades y
            agregar utensilios.
          </Text>
        )}
      </ScrollView>

      <Modal visible={pickerVisible} animationType="slide" onRequestClose={() => setPickerVisible(false)}>
        <View style={styles.modalRoot}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Agregar utensilio</Text>
            <TouchableOpacity onPress={() => setPickerVisible(false)} hitSlop={8}>
              <Ionicons name="close" size={24} color={colors.text} />
            </TouchableOpacity>
          </View>

          <View style={styles.searchBox}>
            <Ionicons name="search" size={17} color={colors.textMuted} />
            <TextInput
              style={styles.searchInput}
              placeholder="Buscar por nombre o categoría"
              placeholderTextColor="#b9a7b0"
              value={catalogoQuery}
              onChangeText={setCatalogoQuery}
              autoCapitalize="none"
            />
          </View>

          {catalogoLoading ? (
            <View style={styles.center}>
              <ActivityIndicator size="large" color={colors.primary} />
            </View>
          ) : (
            <FlatList
              data={catalogoFiltrado}
              keyExtractor={(item) => item._id}
              contentContainerStyle={{ padding: spacing.md }}
              ListEmptyComponent={
                <View style={styles.emptyState}>
                  <Ionicons name="cube-outline" size={28} color={colors.border} />
                  <Text style={styles.emptyText}>Sin resultados</Text>
                </View>
              }
              renderItem={({ item }) => {
                const yaAgregado = agregadosIds.has(String(item._id));
                const cargando = agregandoId === item._id;
                return (
                  <View style={styles.catalogoRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.nombre}>{item.nombre}</Text>
                      <Text style={styles.categoria}>
                        {item.categoria} · {money(item.precio)} · stock {item.cantidad}
                      </Text>
                    </View>
                    {yaAgregado ? (
                      <View style={styles.yaAgregadoBadge}>
                        <Ionicons name="checkmark" size={13} color={colors.success} />
                        <Text style={styles.yaAgregadoText}>Agregado</Text>
                      </View>
                    ) : (
                      <TouchableOpacity
                        style={styles.primaryBtnSmall}
                        disabled={cargando}
                        onPress={() => agregarUtensilio(item)}
                      >
                        {cargando ? (
                          <ActivityIndicator color="#fff" size="small" />
                        ) : (
                          <Text style={styles.primaryBtnSmallText}>Agregar</Text>
                        )}
                      </TouchableOpacity>
                    )}
                  </View>
                );
              }}
            />
          )}
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, gap: 10 },
  errorText: { color: colors.danger, textAlign: 'center' },

  infoCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    ...shadow.sm,
  },
  infoHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  infoIconWrap: {
    width: 34,
    height: 34,
    borderRadius: radius.sm,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoName: { ...type.h3, fontSize: 17 },
  infoSub: { fontSize: 12, color: colors.textMuted, marginTop: 2, textTransform: 'capitalize' },
  editReservaBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1.5,
    borderColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: spacing.sm + 4,
    paddingTop: spacing.sm + 4,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  infoItem: { flexDirection: 'row', alignItems: 'center', gap: 5, width: '47%' },
  infoText: { fontSize: 12, color: colors.textMuted, flexShrink: 1 },
  pdfReservaBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: spacing.sm + 4,
    paddingTop: spacing.sm + 4,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  pdfReservaBtnText: { color: colors.primary, fontWeight: '700', fontSize: 13 },

  totalesCard: {
    backgroundColor: colors.primary,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    ...shadow.md,
  },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  totalLabel: { color: 'rgba(255,255,255,0.85)', fontSize: 13, fontWeight: '600' },
  totalValue: { color: '#fff', fontSize: 13, fontWeight: '700' },
  totalValueNeg: { color: '#ffd9c2', fontSize: 13, fontWeight: '700' },
  totalRowFinal: {
    marginTop: 6,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.25)',
  },
  totalLabelFinal: { color: '#fff', fontSize: 15, fontWeight: '800' },
  totalValueFinal: { color: '#fff', fontSize: 19, fontWeight: '800' },

  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  sectionTitle: { ...type.h3, fontSize: 15, color: colors.text, marginBottom: spacing.sm },
  addLinkBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  addLinkText: { color: colors.primary, fontWeight: '700', fontSize: 13 },
  emptyState: { alignItems: 'center', gap: 8, paddingVertical: 24 },
  emptyText: { color: colors.textMuted },

  itemCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md - 2,
    marginBottom: 10,
    ...shadow.sm,
  },
  itemHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 },
  itemName: { fontSize: 15, fontWeight: '700', color: colors.text },
  itemMeta: { fontSize: 11, color: colors.textMuted, marginTop: 2, textTransform: 'capitalize' },
  itemSubtotal: { fontSize: 15, fontWeight: '800', color: colors.primary },
  itemFooterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
  },
  itemQtyPrice: { fontSize: 12, color: colors.textMuted },
  editIconBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  editIconBtnText: { color: colors.primary, fontWeight: '700', fontSize: 12 },

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

  accCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.sm + 4,
    marginBottom: 8,
    ...shadow.sm,
  },
  accName: { fontSize: 14, fontWeight: '700', color: colors.text },
  accMeta: { fontSize: 11, color: colors.textMuted, marginTop: 1 },

  reciboCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.sm + 4,
    marginBottom: 8,
    ...shadow.sm,
  },
  reciboIconWrap: {
    width: 32,
    height: 32,
    borderRadius: radius.sm,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reciboFolio: { fontSize: 13, fontWeight: '700', color: colors.text },
  reciboMeta: { fontSize: 11, color: colors.textMuted, marginTop: 1, textTransform: 'capitalize' },
  reciboConcepto: { fontSize: 11, color: colors.textMuted, marginTop: 2, fontStyle: 'italic' },
  reciboMonto: { fontSize: 14, fontWeight: '800', color: colors.primary },
  pdfLinkBtn: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  pdfLinkText: { fontSize: 11, fontWeight: '700', color: colors.primary },

  hint: {
    fontSize: 12,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.md,
    marginBottom: spacing.lg,
    fontStyle: 'italic',
  },

  modalRoot: { flex: 1, backgroundColor: colors.bg },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.xl,
    paddingBottom: spacing.sm,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  modalTitle: { ...type.h2, fontSize: 18 },
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
  },
  searchInput: { flex: 1, fontSize: 14, color: colors.text },
  catalogoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.sm + 4,
    marginBottom: 8,
    ...shadow.sm,
  },
  nombre: { fontSize: 14, fontWeight: '700', color: colors.text },
  categoria: { fontSize: 11, color: colors.textMuted, marginTop: 2, textTransform: 'capitalize' },
  yaAgregadoBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.successSoft,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.sm - 2,
  },
  yaAgregadoText: { color: colors.success, fontWeight: '700', fontSize: 11 },
});
