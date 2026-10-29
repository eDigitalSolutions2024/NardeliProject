import { StatusBar } from 'expo-status-bar';
import { View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from './src/context/AuthContext';
import { OfflineProvider } from './src/offline/OfflineContext';
import RootNavigator from './src/navigation/RootNavigator';
import GlobalOfflineBanner from './src/components/GlobalOfflineBanner';

export default function App() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <OfflineProvider>
          <StatusBar style="auto" />
          {/* Fuera del Stack.Navigator a propósito: así el aviso de
              conexión/sincronización se ve igual sin importar en qué
              pantalla esté la persona, no solo en Home. */}
          <View style={{ flex: 1 }}>
            <GlobalOfflineBanner />
            <RootNavigator />
          </View>
        </OfflineProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
