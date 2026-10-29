import React, { useState } from 'react';
import { View, Text, Pressable, ActivityIndicator, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useOffline } from '../offline/OfflineContext';
import { colors, radius, spacing } from '../theme';

// Banner de error para pantallas que cargan datos del servidor. Si el
// problema es que no hay internet, ofrece ir directo a los ajustes de red
// y "verificar ahora" (chequeo real) en vez de solo un botón genérico de
// "reintentar" que vuelve a fallar igual si la conexión sigue caída.
export default function OfflineErrorBanner({ error, onRetry, retrying }) {
  const { isOnline, forceCheckConnection, openNetworkSettings } = useOffline();
  const [checking, setChecking] = useState(false);

  if (!error) return null;

  const handleVerificarYReintentar = async () => {
    setChecking(true);
    try {
      const nowOnline = await forceCheckConnection();
      if (nowOnline) await onRetry?.();
    } finally {
      setChecking(false);
    }
  };

  if (!isOnline) {
    return (
      <View style={styles.box}>
        <Ionicons name="cloud-offline-outline" size={16} color={colors.danger} />
        <Text style={styles.text}>Sin conexión a internet — no se pueden traer datos nuevos.</Text>
        <View style={styles.row}>
          <Pressable style={[styles.btn, styles.btnPrimary]} onPress={openNetworkSettings}>
            <Ionicons name="wifi" size={14} color="#fff" />
            <Text style={styles.btnText}>Conectar</Text>
          </Pressable>
          <Pressable style={styles.btn} onPress={handleVerificarYReintentar} disabled={checking}>
            {checking ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <Ionicons name="refresh" size={14} color="#fff" />
                <Text style={styles.btnText}>Verificar</Text>
              </>
            )}
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.box}>
      <Text style={styles.text}>{error}</Text>
      <Pressable style={[styles.btn, styles.btnPrimary]} onPress={onRetry} disabled={retrying}>
        {retrying ? (
          <ActivityIndicator size="small" color="#fff" />
        ) : (
          <>
            <Ionicons name="refresh" size={14} color="#fff" />
            <Text style={styles.btnText}>Reintentar</Text>
          </>
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { alignItems: 'center', paddingBottom: spacing.sm, gap: 8 },
  text: { color: colors.danger, textAlign: 'center', paddingHorizontal: spacing.md },
  row: { flexDirection: 'row', gap: 8 },
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.danger,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: radius.pill,
  },
  btnPrimary: { backgroundColor: colors.primary },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
});
