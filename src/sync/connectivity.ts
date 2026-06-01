import NetInfo, { type NetInfoState } from '@react-native-community/netinfo';

/**
 * Imperative connectivity helpers for non-React contexts (the React hook lives
 * in src/hooks/useIsOnline). Used by the sync manager to gate uploads.
 */
export async function isOnline(): Promise<boolean> {
  const state = await NetInfo.fetch();
  return Boolean(state.isConnected && state.isInternetReachable !== false);
}

export function subscribe(listener: (online: boolean) => void): () => void {
  return NetInfo.addEventListener((state: NetInfoState) => {
    listener(Boolean(state.isConnected && state.isInternetReachable !== false));
  });
}
