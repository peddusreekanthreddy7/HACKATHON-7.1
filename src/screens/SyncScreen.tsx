import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Alert } from 'react-native';
import { useIsFocused } from '@react-navigation/native';

import {
  ScreenContainer,
  Section,
  Paragraph,
  StatusPill,
  PrimaryButton,
} from '../components';
import { useIsOnline } from '../hooks';
import { getDb, countUnsynced, getSyncMeta } from '../db';
import { runSync, DEFAULT_SYNC_CONFIG } from '../sync';
import { useAppStore } from '../store';

const DEV_KEY = 'dev-placeholder-key-phase5-will-rotate';

/**
 * Sync dashboard (hard constraint #8): pending/synced counts + manual sync.
 * Records queue locally (encrypted) → push to AWS when online → purge after ACK.
 */
export function SyncScreen(): React.JSX.Element {
  const online = useIsOnline();
  const isFocused = useIsFocused();
  const markSynced = useAppStore(s => s.markSynced);

  const [pending, setPending] = useState(0);
  const [syncedTotal, setSyncedTotal] = useState(0);
  const [lastSyncAt, setLastSyncAt] = useState<number | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [lastResult, setLastResult] = useState<string | null>(null);

  const load = useCallback(() => {
    try {
      const db = getDb(DEV_KEY);
      setPending(countUnsynced(db));
      const meta = getSyncMeta(db);
      setSyncedTotal(meta.syncedTotal);
      setLastSyncAt(meta.lastSyncAt);
    } catch {
      /* DB unavailable in this environment — counts stay at 0 */
    }
  }, []);

  useEffect(() => { if (isFocused) load(); }, [isFocused, load]);

  const syncingRef = useRef(false);
  const doSync = useCallback(async () => {
    if (syncingRef.current) return;
    syncingRef.current = true;
    setSyncing(true);
    setLastResult(null);
    try {
      const summary = await runSync(DEFAULT_SYNC_CONFIG);
      setLastResult(
        `Pushed ${summary.synced}/${summary.attempted} · ${summary.failed} failed`,
      );
      if (summary.synced > 0) markSynced(Date.now());
    } catch (e) {
      setLastResult(`Sync error: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      syncingRef.current = false;
      setSyncing(false);
      load();
    }
  }, [load, markSynced]);

  // Auto-sync when we come online and there is something pending.
  useEffect(() => {
    if (online === true && pending > 0 && !syncingRef.current) {
      void doSync();
    }
  }, [online, pending, doSync]);

  const onSyncNow = () => {
    if (online !== true) {
      Alert.alert('Offline', 'Connect to a network to sync. Records stay safe and encrypted until then.');
      return;
    }
    void doSync();
  };

  return (
    <ScreenContainer>
      <Section
        title="Sync & purge"
        caption="Queue encrypted locally → sync to AWS when online → purge after ACK.">
        <StatusPill
          label={online === null ? 'Checking…' : online ? 'Online' : 'Offline'}
          tone={online ? 'success' : 'warning'}
        />
        <Paragraph>Pending (unsynced): {pending}</Paragraph>
        <Paragraph>Synced + purged (lifetime): {syncedTotal}</Paragraph>
        <Paragraph>
          Last confirmed sync: {lastSyncAt ? new Date(lastSyncAt).toLocaleString() : 'never'}
        </Paragraph>
        {lastResult ? <Paragraph>{lastResult}</Paragraph> : null}
      </Section>

      <PrimaryButton
        label={syncing ? 'Syncing…' : online ? 'Sync now' : 'Waiting for network…'}
        onPress={onSyncNow}
        disabled={syncing || online !== true || pending === 0}
      />

      <Section
        title="Guarantee"
        caption="No data loss · no duplicates · no orphaned PII">
        <Paragraph>• A local row is deleted ONLY after the server returns 200 + ack.</Paragraph>
        <Paragraph>• Each push carries an idempotency key, so retries can't double-count.</Paragraph>
        <Paragraph>• Failed pushes retry with exponential backoff; rows stay encrypted at rest until confirmed.</Paragraph>
        <Paragraph>• Endpoint: {DEFAULT_SYNC_CONFIG.endpointUrl}</Paragraph>
      </Section>
    </ScreenContainer>
  );
}
