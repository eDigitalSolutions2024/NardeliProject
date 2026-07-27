import React from 'react';
import { View, ActivityIndicator } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuth } from '../context/AuthContext';

import LoginScreen from '../screens/LoginScreen';
import EventsListScreen from '../screens/EventsListScreen';
import EventDashboardScreen from '../screens/EventDashboardScreen';
import ChecklistsScreen from '../screens/ChecklistsScreen';
import ChecklistDetailScreen from '../screens/ChecklistDetailScreen';
import ScanQRScreen from '../screens/ScanQRScreen';

const Stack = createNativeStackNavigator();

const screenOptions = {
  headerStyle: { backgroundColor: '#8a2b52' },
  headerTintColor: '#fff',
  headerTitleStyle: { fontWeight: '600' },
};

export default function RootNavigator() {
  const { user, initializing } = useAuth();

  if (initializing) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#8a2b52" />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={screenOptions}>
        {!user ? (
          <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
        ) : (
          <>
            <Stack.Screen
              name="Events"
              component={EventsListScreen}
              options={{ headerShown: false }}
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
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
