import React, { useEffect, useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Camera, useCameraDevice } from 'react-native-vision-camera';
import { useIsFocused } from '@react-navigation/native';

import { useCameraAccess, useLiveness, useRecognition, refreshGallery } from '../hooks';
import { LivenessOverlay } from '../components';
import { DEMO_LIVENESS_CONFIG } from '../liveness';
import { palette } from '../navigation/theme';
import { PrimaryButton } from '../components';
import { getDb, recordAttendance } from '../db';
import { useAppStore } from '../store';

const DEV_KEY = 'dev-placeholder-key-phase5-will-rotate';

/**
 * Phase 3 + 4: liveness challenge-response → recognition.
 * Passive anti-spoof gate → 2 random active challenges → face embed + match.
 */
export function AttendanceScreen(): React.JSX.Element {
  const { hasPermission, request } = useCameraAccess();
  const device = useCameraDevice('front');
  const isFocused = useIsFocused();

  const { frameProcessor: livenessProcessor, liveness, prompt, reset: resetLiveness, models } =
    useLiveness(DEMO_LIVENESS_CONFIG);
  const { frameProcessor: recProcessor, phase: recPhase, result, onLivenessUpdate, reset: resetRec } =
    useRecognition();

  // Keep recognition hook in sync with liveness state.
  useEffect(() => { onLivenessUpdate(liveness); }, [liveness, onLivenessUpdate]);

  // Refresh gallery when the screen comes into focus (picks up new enrollments).
  useEffect(() => { if (isFocused) refreshGallery(); }, [isFocused]);

  // On a successful (liveness-passed + recognized) verification, write ONE
  // encrypted attendance record locally (synced=false). The sync/purge runs
  // from the Sync tab. Guarded so it fires exactly once per session.
  const recordedRef = useRef(false);
  const queueAttendance = useAppStore(s => s.queueAttendance);
  useEffect(() => {
    if (recPhase !== 'done') { recordedRef.current = false; return; }
    if (recordedRef.current) return;
    if (result.match && result.match.accepted) {
      recordedRef.current = true;
      try {
        recordAttendance(getDb(DEV_KEY), {
          personId: result.match.personId,
          livenessPassed: true,
          matchScore: result.match.score,
          antiSpoofScore: null, // surfaced from the passive model in a later pass
        });
        queueAttendance();
      } catch {
        recordedRef.current = false; // allow a retry if the write failed
      }
    }
  }, [recPhase, result, queueAttendance]);

  const handleReset = () => { recordedRef.current = false; resetLiveness(); resetRec(); };

  if (!hasPermission) {
    return (
      <View style={styles.centered}>
        <Text style={styles.label}>Camera access needed for verification.</Text>
        <PrimaryButton label="Grant permission" onPress={request} />
      </View>
    );
  }

  if (device == null) {
    return (
      <View style={styles.centered}>
        <Text style={styles.label}>No front camera found.</Text>
      </View>
    );
  }

  const terminal = liveness.phase === 'passed' || liveness.phase === 'failed';
  const showRec = liveness.phase === 'passed';

  // Choose the active frame processor: recognition fires once after liveness passes.
  const activeProcessor = showRec && recPhase === 'running' ? recProcessor : livenessProcessor;

  // Keep the camera ON until recognition has actually produced a result.
  // BUG FIX: previously `isActive={isFocused && !terminal}` switched the camera
  // off the moment liveness passed — but recognition still needs a live frame.
  // That race made verification "stick" on Identifying… whenever the camera
  // stopped before the one recognition frame fired.
  const recDone = recPhase === 'done' || recPhase === 'no-match' || recPhase === 'error';
  const cameraActive =
    isFocused && liveness.phase !== 'failed' && !recDone;

  return (
    <View style={styles.fill}>
      <Camera
        style={StyleSheet.absoluteFill}
        device={device}
        isActive={cameraActive}
        frameProcessor={activeProcessor}
      />

      <LivenessOverlay
        liveness={liveness}
        prompt={prompt}
        antiSpoofState={models.antiSpoof}
        timeoutMs={DEMO_LIVENESS_CONFIG.challengeTimeoutMs}
      />

      {/* Recognition result overlay */}
      {showRec && (
        <View style={styles.recPanel}>
          {recPhase === 'running' && (
            <Text style={styles.recLabel}>Identifying…</Text>
          )}
          {recPhase === 'done' && result.match != null && (
            <>
              <Text style={[styles.recName, result.match.accepted ? styles.green : styles.red]}>
                {result.match.accepted
                  ? `✓  ${result.match.displayName}`
                  : `✗  No match`}
              </Text>
              <Text style={styles.recScore}>
                Confidence: {result.confidence ?? 0}%
                {result.latencyMs != null ? `  ·  ${result.latencyMs} ms` : ''}
              </Text>
            </>
          )}
          {recPhase === 'no-match' && (
            <Text style={styles.recName}>✗  Unknown person</Text>
          )}
          {recPhase === 'error' && (
            <Text style={[styles.recName, styles.red]}>Recognition error</Text>
          )}
        </View>
      )}

      {terminal && (
        <View style={styles.footer}>
          <PrimaryButton label="Try again" onPress={handleReset} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: '#000' },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
    padding: 24,
    backgroundColor: palette.bg,
  },
  label: { color: palette.text, fontSize: 16, textAlign: 'center' },
  recPanel: {
    position: 'absolute',
    top: 56,
    left: 16,
    right: 16,
    backgroundColor: 'rgba(0,0,0,0.72)',
    borderRadius: 14,
    padding: 16,
    alignItems: 'center',
    gap: 6,
  },
  recLabel: { color: '#FFFFFF', fontSize: 16, fontWeight: '600' },
  recName: { color: '#FFFFFF', fontSize: 22, fontWeight: '800' },
  recScore: { color: 'rgba(255,255,255,0.75)', fontSize: 14 },
  green: { color: palette.success },
  red: { color: palette.danger },
  footer: { position: 'absolute', bottom: 72, left: 24, right: 24 },
});
