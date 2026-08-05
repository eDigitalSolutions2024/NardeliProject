import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';
import client from '../api/client';
import { colors, radius, shadow, spacing, type, estadoColors } from '../theme';

export default function ScanQRScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const [invitacion, setInvitacion] = useState(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const scannedRef = useRef(false);

  const handleScanned = async ({ data: scanned }) => {
    if (scannedRef.current) return;
    scannedRef.current = true;
    setLoading(true);
    try {
      // El QR que se le manda al invitado codifica la URL completa del
      // portal (https://.../invitacion-qr/<token>), no el token suelto.
      // Nos quedamos con el último segmento para soportar ambos casos.
      const qrToken = String(scanned || '').split(/[/?#]/).filter(Boolean).pop();
      const { data } = await client.get(`/scan-invitacion-qr/${qrToken}`);
      setInvitacion({ ...data, qrToken });
    } catch (e) {
      Alert.alert('Código no válido', e?.response?.data?.msg || 'No se encontró la invitación', [
        { text: 'OK', onPress: reset },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    scannedRef.current = false;
    setInvitacion(null);
  };

  const registrarAcceso = async (cantidad) => {
    setBusy(true);
    try {
      const { data } = await client.post(
        `/scan-invitacion-qr/${invitacion.qrToken}/scan`,
        { cantidad }
      );
      Alert.alert('Acceso registrado', data.msg, [{ text: 'OK', onPress: reset }]);
    } catch (e) {
      Alert.alert('Error', e?.response?.data?.msg || 'No se pudo registrar el acceso');
    } finally {
      setBusy(false);
    }
  };

  if (!permission) {
    return <View style={styles.center} />;
  }

  if (!permission.granted) {
    return (
      <View style={styles.center}>
        <View style={styles.permIconWrap}>
          <Ionicons name="camera-outline" size={30} color={colors.primary} />
        </View>
        <Text style={styles.permText}>Necesitamos acceso a tu cámara para escanear QR.</Text>
        <TouchableOpacity style={styles.button} activeOpacity={0.85} onPress={requestPermission}>
          <Text style={styles.buttonText}>Dar permiso</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <CameraView
        style={StyleSheet.absoluteFillObject}
        facing="back"
        barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
        onBarcodeScanned={invitacion || loading ? undefined : handleScanned}
      />

      {!invitacion && (
        <View style={styles.frameWrap} pointerEvents="none">
          <View style={styles.frame}>
            <View style={[styles.corner, styles.cornerTL]} />
            <View style={[styles.corner, styles.cornerTR]} />
            <View style={[styles.corner, styles.cornerBL]} />
            <View style={[styles.corner, styles.cornerBR]} />
          </View>
        </View>
      )}

      <View style={styles.overlay}>
        {loading && <ActivityIndicator size="large" color="#fff" />}

        {!loading && !invitacion && (
          <View style={styles.hintBox}>
            <Ionicons name="qr-code-outline" size={16} color="#fff" />
            <Text style={styles.hint}>Apunta la cámara al código QR de la invitación</Text>
          </View>
        )}

        {invitacion && (
          <View style={styles.card}>
            <View style={styles.cardHeaderRow}>
              <Text style={styles.cardTitle}>{invitacion.nombreFamilia}</Text>
              <View
                style={[
                  styles.estadoBadge,
                  { backgroundColor: estadoColors[invitacion.estado] || colors.neutral },
                ]}
              >
                <Text style={styles.estadoBadgeText}>{invitacion.estado}</Text>
              </View>
            </View>
            <Text style={styles.cardInfo}>
              Autorizadas: {invitacion.personasAutorizadas} · Restantes:{' '}
              {invitacion.entradasRestantes}
            </Text>

            {invitacion.estado === 'cancelada' ? (
              <View style={styles.blockedRow}>
                <Ionicons name="close-circle" size={16} color={colors.danger} />
                <Text style={styles.blocked}>Esta invitación está cancelada</Text>
              </View>
            ) : invitacion.entradasRestantes <= 0 ? (
              <View style={styles.blockedRow}>
                <Ionicons name="close-circle" size={16} color={colors.danger} />
                <Text style={styles.blocked}>Ya no quedan accesos disponibles</Text>
              </View>
            ) : (
              <TouchableOpacity
                style={styles.button}
                activeOpacity={0.85}
                disabled={busy}
                onPress={() => registrarAcceso(invitacion.entradasRestantes)}
              >
                {busy ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <Ionicons name="checkmark-circle-outline" size={17} color="#fff" />
                    <Text style={styles.buttonText}>
                      Registrar {invitacion.entradasRestantes} entrada(s)
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            )}

            <TouchableOpacity style={styles.cancelButton} onPress={reset} disabled={busy}>
              <Text style={styles.cancelButtonText}>Escanear otro</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </View>
  );
}

const CORNER = 32;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, backgroundColor: colors.bg },
  permIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  permText: { textAlign: 'center', marginBottom: 16, color: colors.textMuted },
  frameWrap: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  frame: { width: 240, height: 240 },
  corner: {
    position: 'absolute',
    width: CORNER,
    height: CORNER,
    borderColor: colors.accent,
  },
  cornerTL: { top: 0, left: 0, borderTopWidth: 4, borderLeftWidth: 4, borderTopLeftRadius: 12 },
  cornerTR: { top: 0, right: 0, borderTopWidth: 4, borderRightWidth: 4, borderTopRightRadius: 12 },
  cornerBL: { bottom: 0, left: 0, borderBottomWidth: 4, borderLeftWidth: 4, borderBottomLeftRadius: 12 },
  cornerBR: { bottom: 0, right: 0, borderBottomWidth: 4, borderRightWidth: 4, borderBottomRightRadius: 12 },
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    alignItems: 'center',
    padding: spacing.lg,
  },
  hintBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(0,0,0,0.55)',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: radius.pill,
  },
  hint: {
    color: '#fff',
    textAlign: 'center',
    fontSize: 13,
    fontWeight: '600',
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    width: '100%',
    ...shadow.lg,
  },
  cardHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  cardTitle: { ...type.h3, fontSize: 20, flexShrink: 1 },
  cardInfo: { color: colors.textMuted, marginTop: 6 },
  estadoBadge: { paddingHorizontal: 9, paddingVertical: 3, borderRadius: radius.pill },
  estadoBadgeText: { color: '#fff', fontSize: 11, fontWeight: '700', textTransform: 'capitalize' },
  blockedRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 14 },
  blocked: { color: colors.danger, fontWeight: '700' },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: 14,
    marginTop: 14,
    ...shadow.sm,
  },
  buttonText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  cancelButton: { alignItems: 'center', marginTop: 12 },
  cancelButtonText: { color: colors.primary, fontWeight: '700' },
});
