import { useEffect } from 'react';
import { syncAll } from '../db/sync';
import { useAuth } from './useAuth';

export function useSync() {
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;

    syncAll();

    const handleOnline = () => syncAll();
    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, [user]);
}
