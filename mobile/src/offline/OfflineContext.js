import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../context/AuthContext';
import { isOnline as checkOnline, subscribeConnectivity } from './connectivity';
import { countByStatus, getErrorMutations, retryMutation, deleteMutation } from './mutationQueue';
import { countPendingConflicts } from './conflictStore';
import { processQueue } from './syncEngine';
import { downloadInitialCopy } from './downloadInitialCopy';

const LAST_FULL_SYNC_KEY = '@nardeli/lastFullSync';
const LAST_QUEUE_SYNC_KEY = '@nardeli/lastQueueSync';
const AUTO_DOWNLOAD_INTERVAL_MS = 15 * 60 * 1000;

const OfflineContext = createContext(null);

export function OfflineProvider({ children }) {
  const { user, initializing } = useAuth();
  const [online, setOnline] = useState(checkOnline());
  const [pendingCount, setPendingCount] = useState(0);
  const [errorCount, setErrorCount] = useState(0);
  const [conflictCount, setConflictCount] = useState(0);
  const [isSyncingNow, setIsSyncingNow] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(null);
  const [lastFullSync, setLastFullSync] = useState(null);
  const [lastQueueSync, setLastQueueSync] = useState(null);

  // Evita que la descarga automática y una manual ("forzar ahora") corran
  // pisándose una a la otra.
  const downloadingRef = useRef(false);

  const refreshCounts = useCallback(async () => {
    const [pend, err, conf] = await Promise.all([
      countByStatus(['pending']),
      countByStatus(['error']),
      countPendingConflicts(),
    ]);
    setPendingCount(pend);
    setErrorCount(err);
    setConflictCount(conf);
  }, []);

  // Sube lo pendiente al servidor. Silencioso: los resultados (aplicados/
  // conflictos/errores) se reflejan solos en los contadores.
  const runQueueSync = useCallback(async () => {
    if (!checkOnline()) return;
    setIsSyncingNow(true);
    try {
      await processQueue();
      const now = Date.now();
      setLastQueueSync(now);
      AsyncStorage.setItem(LAST_QUEUE_SYNC_KEY, String(now)).catch(() => {});
    } finally {
      setIsSyncingNow(false);
      await refreshCounts();
    }
  }, [refreshCounts]);

  // Refresca la copia local completa. Se ejecuta sola (al abrir la app, al
  // reconectar, y cada 15 min en línea); el botón manual solo la adelanta.
  const downloadNow = useCallback(async () => {
    if (!checkOnline() || downloadingRef.current) return;
    downloadingRef.current = true;
    setIsDownloading(true);
    setDownloadProgress({ done: 0, total: 1 });
    try {
      await downloadInitialCopy((p) => setDownloadProgress(p));
      const now = Date.now();
      setLastFullSync(now);
      AsyncStorage.setItem(LAST_FULL_SYNC_KEY, String(now)).catch(() => {});
    } finally {
      setIsDownloading(false);
      downloadingRef.current = false;
    }
  }, []);

  // Acción del botón secundario "Forzar sincronización ahora": primero sube
  // lo pendiente, luego refresca la copia local con lo que quedó en el servidor.
  const forceSync = useCallback(async () => {
    await runQueueSync();
    await downloadNow();
  }, [runQueueSync, downloadNow]);

  const retryError = useCallback(async (id) => {
    await retryMutation(id);
    await refreshCounts();
  }, [refreshCounts]);

  const discardError = useCallback(async (id) => {
    await deleteMutation(id);
    await refreshCounts();
  }, [refreshCounts]);

  const listErrors = useCallback(() => getErrorMutations(), []);

  useEffect(() => {
    // Sin sesión todavía (o restaurándola desde AsyncStorage): no hay token
    // para llamar a la API, así que no arrancamos nada de sync/descarga.
    if (initializing || !user) return undefined;

    let cancelled = false;

    (async () => {
      try {
        const [[, savedFull], [, savedQueue]] = await AsyncStorage.multiGet([
          LAST_FULL_SYNC_KEY,
          LAST_QUEUE_SYNC_KEY,
        ]);
        if (!cancelled) {
          if (savedFull) setLastFullSync(Number(savedFull));
          if (savedQueue) setLastQueueSync(Number(savedQueue));
        }
      } catch {}

      await refreshCounts();

      // Al abrir la app (ya con sesión): si hay conexión, sube lo
      // pendiente y refresca la copia local sola, sin que nadie toque nada.
      if (checkOnline()) {
        await runQueueSync();
        await downloadNow();
      }
    })();

    const unsubscribe = subscribeConnectivity((event) => {
      setOnline(event === 'online');
      if (event === 'online') {
        runQueueSync().then(() => downloadNow());
      }
    });

    const interval = setInterval(() => {
      if (checkOnline()) downloadNow();
    }, AUTO_DOWNLOAD_INTERVAL_MS);

    return () => {
      cancelled = true;
      unsubscribe();
      clearInterval(interval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initializing, user]);

  const value = {
    isOnline: online,
    pendingCount,
    errorCount,
    conflictCount,
    isSyncing: isSyncingNow,
    isDownloading,
    downloadProgress,
    lastFullSync,
    lastQueueSync,
    forceSync,
    downloadNow,
    refreshCounts,
    retryError,
    discardError,
    listErrors,
  };

  return <OfflineContext.Provider value={value}>{children}</OfflineContext.Provider>;
}

export function useOffline() {
  const ctx = useContext(OfflineContext);
  if (!ctx) throw new Error('useOffline debe usarse dentro de <OfflineProvider>');
  return ctx;
}
