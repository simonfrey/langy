import { useEffect, useRef } from 'react';
import { syncAll } from '../db/sync';
import { useAuth } from './useAuth';

export function useSync() {
  const { user } = useAuth();
  const syncingRef = useRef(false);

  useEffect(() => {
    if (!user) return;

    async function guardedSync() {
      if (syncingRef.current) return;
      syncingRef.current = true;
      try {
        await syncAll();
      } finally {
        syncingRef.current = false;
      }
    }

    guardedSync();

    const handleOnline = () => guardedSync();
    window.addEventListener('online', handleOnline);

    const interval = setInterval(guardedSync, 60_000);

    return () => {
      window.removeEventListener('online', handleOnline);
      clearInterval(interval);
    };
  }, [user]);
}
