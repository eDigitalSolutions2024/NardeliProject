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
import client from '../api/client';

export default function ScanQRScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const [invitacion, setInvitacion] = useState(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const scannedRef = useRef(false);

  const handleScanned = async ({ data: qrToken }) => {
    if (scannedRef.current) return;
    scannedRef.current = true;
    setLoading(true);
    try {
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
        <Text style={styles.permText}>Necesitamos acceso a tu cámara para escanear QR.</Text>
        <TouchableOpacity style={styles.button} onPress={requestPermission}>
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

      <View style={styles.overlay}>
        {loading && <ActivityIndicator size="large" color="#fff" />}

        {!loading && !invitacion && (
          <Text style={styles.hint}>Apunta la cámara al código QR de la invitación</Text>
        )}

        {invitacion && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>{invitacion.nombreFamilia}</Text>
            <Text style={styles.cardInfo}>
              Autorizadas: {invitacion.personasAutorizadas} · Restantes:{' '}
              {invitacion.entradasRestantes}
            </Text>
            <Text style={styles.cardEstado}>Estado: {invitacion.estado}</Text>

            {invitacion.estado === 'cancelada' ? (
              <Text style={styles.blocked}>Esta invitación está cancelada</Text>
            ) : invitacion.entradasRestantes <= 0 ? (
              <Text style={styles.blocked}>Ya no quedan accesos disponibles</Text>
            ) : (
              <TouchableOpacity
                style={styles.button}
                disabled={busy}
                onPress={() => registrarAcceso(invitacion.entradasRestantes)}
              >
                {busy ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.buttonText}>
                    Registrar {invitacion.entradasRestantes} entrada(s)
                  </Text>
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

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  permText: { textAlign: 'center', marginBottom: 16 },
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    alignItems: 'center',
    padding: 24,
  },
  hint: {
    color: '#fff',
    backgroundColor: 'rgba(0,0,0,0.5)',
    padding: 10,
    borderRadius: 8,
    textAlign: 'center',
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 20,
    width: '100%',
  },
  cardTitle: { fontSize: 20, fontWeight: '700' },
  cardInfo: { color: '#444', marginTop: 6 },
  cardEstado: { color: '#666', marginTop: 2, textTransform: 'capitalize' },
  blocked: { color: '#c0392b', fontWeight: '600', marginTop: 14 },
  button: {
    backgroundColor: '#8a2b52',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 14,
  },
  buttonText: { color: '#fff', fontWeight: '600', fontSize: 15 },
  cancelButton: { alignItems: 'center', marginTop: 12 },
  cancelButtonText: { color: '#8a2b52', fontWeight: '600' },
});
