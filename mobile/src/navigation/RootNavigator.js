import React from 'react';
import { Image, TouchableOpacity, View, ActivityIndicator, StyleSheet } from 'react-native';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { colors } from '../theme';

import LoginScreen from '../screens/LoginScreen';
import HomeScreen from '../screens/HomeScreen';
import EventsListScreen from '../screens/EventsListScreen';
import EventDashboardScreen from '../screens/EventDashboardScreen';
import ChecklistsScreen from '../screens/ChecklistsScreen';
import ChecklistDetailScreen from '../screens/ChecklistDetailScreen';
import ScanQRScreen from '../screens/ScanQRScreen';
import CalendarScreen from '../screens/CalendarScreen';
import EditReservaScreen from '../screens/EditReservaScreen';
import InvitacionesScreen from '../screens/InvitacionesScreen';
import PanelClienteScreen from '../screens/PanelClienteScreen';
import ClientesScreen from '../screens/ClientesScreen';
import ClienteDetalleScreen from '../screens/ClienteDetalleScreen';
import ReportesScreen from '../screens/ReportesScreen';
import InventarioScreen from '../screens/InventarioScreen';
import SyncStatusScreen from '../screens/SyncStatusScreen';
import ConflictsScreen from '../screens/ConflictsScreen';

const markWhite = require('../../assets/nardeli-mark-white.png');

const Stack = createNativeStackNavigator();

const navTheme = {
  ...DefaultTheme,
  colors: { ...DefaultTheme.colors, background: colors.bg, primary: colors.primary },
};

function HeaderLogo() {
  return <Image source={markWhite} style={styles.headerLogo} resizeMode="contain" />;
}

const screenOptions = {
  headerStyle: { backgroundColor: colors.primary },
  headerShadowVisible: false,
  headerTintColor: '#fff',
  headerTitleStyle: { fontWeight: '700', fontSize: 17 },
  headerRight: HeaderLogo,
};

export default function RootNavigator() {
  const { user, initializing } = useAuth();

  if (initializing) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <NavigationContainer theme={navTheme}>
      <Stack.Navigator screenOptions={screenOptions}>
        {!user ? (
          <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
        ) : (
          <>
            <Stack.Screen name="Home" component={HomeScreen} options={{ headerShown: false }} />
            <Stack.Screen
              name="Events"
              component={EventsListScreen}
              options={({ navigation }) => ({
                title: 'Eventos',
                headerRight: () => (
                  <TouchableOpacity
                    onPress={() => navigation.navigate('Calendar')}
                    hitSlop={10}
                    style={styles.headerIconBtn}
                  >
                    <Ionicons name="calendar-outline" size={20} color="#fff" />
                  </TouchableOpacity>
                ),
              })}
            />
            <Stack.Screen
              name="Clientes"
              component={ClientesScreen}
              options={{ title: 'Clientes' }}
            />
            <Stack.Screen
              name="ClienteDetalle"
              component={ClienteDetalleScreen}
              options={{ title: 'Historial del cliente' }}
            />
            <Stack.Screen
              name="Reportes"
              component={ReportesScreen}
              options={{ title: 'Reportes de ingresos' }}
            />
            <Stack.Screen
              name="Inventario"
              component={InventarioScreen}
              options={{ title: 'Inventario' }}
            />
            <Stack.Screen
              name="EventDashboard"
              component={EventDashboardScreen}
              options={{ title: 'Evento' }}
            />
            <Stack.Screen
              name="Checklists"
              component={ChecklistsScreen}
              options={{ title: 'Checklists' }}
            />
            <Stack.Screen
              name="ChecklistDetail"
              component={ChecklistDetailScreen}
              options={{ title: 'Detalle' }}
            />
            <Stack.Screen
              name="ScanQR"
              component={ScanQRScreen}
              options={{ title: 'Escanear QR' }}
            />
            <Stack.Screen
              name="Calendar"
              component={CalendarScreen}
              options={{ title: 'Calendario de eventos' }}
            />
            <Stack.Screen
              name="EditReserva"
              component={EditReservaScreen}
              options={{ title: 'Editar reserva' }}
            />
            <Stack.Screen
              name="PanelCliente"
              component={PanelClienteScreen}
              options={{ title: 'Panel de cliente' }}
            />
            <Stack.Screen
              name="Invitaciones"
              component={InvitacionesScreen}
              options={{ title: 'Invitaciones' }}
            />
            <Stack.Screen
              name="SyncStatus"
              component={SyncStatusScreen}
              options={{ title: 'Sincronización' }}
            />
            <Stack.Screen
              name="Conflicts"
              component={ConflictsScreen}
              options={{ title: 'Conflictos' }}
            />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.bg },
  headerLogo: { width: 22, height: 22, marginRight: 16, opacity: 0.9 },
  headerIconBtn: { marginRight: 14 },
});
