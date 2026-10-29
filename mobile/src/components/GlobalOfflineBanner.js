import React, { useState } from 'react';
import { View, Text, Pressable, ActivityIndicator, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useOffline } from '../offline/OfflineContext';
import { colors, radius, spacing } from '../theme';

// Se monta UNA sola vez arriba de toda la navegación (ver App.js), para que
// el aviso de conexión/sincronización se vea en CUALQUIER pantalla, no solo
// en Home. Antes, si alguien editaba un precio en el Panel del Cliente
// estando sin internet, no había ninguna señal ahí de que ese cambio se
// quedó guardado en el teléfono sin llegar al sistema — solo se veía el
// aviso si volvía a la pantalla de inicio. Ahora la sigue a todos lados.
export default function GlobalOfflineBanner() {
  const { isOnline, pendingCount, errorCount, isSyncing, forceCheckConnection, openNetworkSettings } = useOffline();
  const [checking, setChecking] = useState(false);

  const handleVerificar = async () => {
    setChecking(true);
    try {
      await forceCheckConnection();
    } finally {
      setChecking(false);
    }
  };

  if (isOnline && pendingCount === 0 && errorCount === 0 && !isSyncing) return null;

  // Sin conexión: es el caso que de verdad importa — cualquier cambio que
  // haga ahorita se queda guardado SOLO en este teléfono hasta que vuelva
  // a haber internet. Hay que decirlo explícito, no solo "sin conexión".
  if (!isOnline) {
    const plural = pendingCount === 1 ? '' : 's';
    return (
      <SafeAreaView edges={['top']} style={styles.safeDanger}>
        <View style={styles.row}>
          <Ionicons name="cloud-offline-outline" size={16} color="#fff" />
          <Text style={styles.text} numberOfLines={2}>
            {pendingCount > 0
              ? `Sin conexión — ${pendingCount} cambio${plural} guardado${plural} en el teléfono, sin enviar al sistema`
              : 'Sin conexión a internet'}
          </Text>
          <Pressable onPress={openNetworkSettings} style={styles.btn} hitSlop={6}>
            <Text style={styles.btnText}>Conectar</Text>
          </Pressable>
          <Pressable onPress={handleVerificar} disabled={checking} hitSlop={8}>
            {checking ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Ionicons name="refresh" size={17} color="#fff" />
            )}
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  // Ya hay conexión pero todavía está mandando lo que se acumuló mientras
  // estuvo offline (o algo muy puntual se está subiendo ahora) — tranquiliza
  // en vez de alarmar, esto se resuelve solo en segundos.
  if (pendingCount > 0 || isSyncing) {
    const plural = pendingCount === 1 ? '' : 's';
    return (
      <SafeAreaView edges={['top']} style={styles.safeWarning}>
        <View style={styles.row}>
          <ActivityIndicator size="small" color="#fff" />
          <Text style={styles.text}>
            {pendingCount > 0
              ? `Enviando ${pendingCount} cambio${plural} pendiente${plural}…`
              : 'Sincronizando…'}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  // Hay conexión, no hay nada pendiente de subir, pero algo falló al
  // mandarse (ej. choque con otro cambio) y se quedó parado necesitando
  // que alguien lo revise a mano en Sincronización.
  if (errorCount > 0) {
    const plural = errorCount === 1 ? '' : 's';
    const pluralVerbo = errorCount === 1 ? '' : 'n';
    return (
      <SafeAreaView edges={['top']} style={styles.safeDanger}>
        <View style={styles.row}>
          <Ionicons name="alert-circle-outline" size={16} color="#fff" />
          <Text style={styles.text}>
            {errorCount} cambio{plural} no se pudo{pluralVerbo} enviar — revisa Sincronización
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return null;
}

const styles = StyleSheet.create({
  safeDanger: { backgroundColor: colors.danger },
  safeWarning: { backgroundColor: colors.warning },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    paddingVertical: 6,
    paddingHorizontal: spacing.sm,
  },
  text: { color: '#fff', fontSize: 12, fontWeight: '700', flexShrink: 1 },
  btn: {
    backgroundColor: 'rgba(255,255,255,0.25)',
    paddingVertical: 3,
    paddingHorizontal: 10,
    borderRadius: radius.pill,
  },
  btnText: { color: '#fff', fontSize: 11.5, fontWeight: '800' },
});
