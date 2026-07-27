import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import client, { setAuthToken, setUnauthorizedHandler } from '../api/client';

const TOKEN_KEY = '@nardeli/token';
const USER_KEY = '@nardeli/user';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [initializing, setInitializing] = useState(true);

  const logout = useCallback(async () => {
    setAuthToken(null);
    setUser(null);
    await AsyncStorage.multiRemove([TOKEN_KEY, USER_KEY]);
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(logout);
  }, [logout]);

  useEffect(() => {
    (async () => {
      try {
        const [storedToken, storedUser] = await AsyncStorage.multiGet([TOKEN_KEY, USER_KEY]);
        const token = storedToken?.[1];
        const rawUser = storedUser?.[1];
        if (token) {
          setAuthToken(token);
          setUser(rawUser ? JSON.parse(rawUser) : null);
        }
      } finally {
        setInitializing(false);
      }
    })();
  }, []);

  const login = useCallback(async (email, password) => {
    const { data } = await client.post('/login', { email, password });
    if (!data?.success || !data?.token) {
      throw new Error(data?.message || 'No se pudo iniciar sesión');
    }
    setAuthToken(data.token);
    setUser(data.user);
    await AsyncStorage.setItem(TOKEN_KEY, data.token);
    await AsyncStorage.setItem(USER_KEY, JSON.stringify(data.user));
    return data.user;
  }, []);

  return (
    <AuthContext.Provider value={{ user, initializing, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth debe usarse dentro de <AuthProvider>');
  return ctx;
}
