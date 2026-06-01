import { useEffect, useState } from 'react';
import NetInfo from '@react-native-community/netinfo';

/**
 * Live network reachability.
 * Returns `null` until the first reading arrives, then `true`/`false`.
 * Drives the offline-first UX: attendance capture works regardless, but sync
 * is gated on this being `true` (hard constraint #8).
 */
export function useIsOnline(): boolean | null {
  const [online, setOnline] = useState<boolean | null>(null);

  useEffect(() => {
    const compute = (isConnected: boolean | null, reachable: boolean | null) =>
      Boolean(isConnected && reachable !== false);

    const unsubscribe = NetInfo.addEventListener(state => {
      setOnline(compute(state.isConnected, state.isInternetReachable));
    });

    NetInfo.fetch().then(state => {
      setOnline(compute(state.isConnected, state.isInternetReachable));
    });

    return unsubscribe;
  }, []);

  return online;
}
