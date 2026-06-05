import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Camera, useCameraDevice } from 'react-native-vision-camera';

import {
  ScreenContainer,
  Section,
  Paragraph,
  StatusPill,
  PrimaryButton,
  DebugSlider,
} from '../components';
import { useCameraAccess, useDebugRecognition } from '../hooks';
import {
  getDb,
  countEnrollments,
  getAllEnrollments,
  deleteEnrollment,
} from '../db';
import { useDebugStore } from '../store/debugStore';
import { config } from '../config/env';
import {
  APP_NAME,
  EMBEDDING_DIM,
  MODEL_FOOTPRINT_BUDGET_MB,
  TARGET_E2E_LATENCY_MS,
} from '../utils';
import { palette } from '../navigation/theme';

const DEV_KEY = 'dev-placeholder-key-phase5-will-rotate';

interface EnrollItem {
  id: string;
  personId: string;
  name: string;
  dim: number;
}

/** Admin / settings: build config, hard-constraint targets, and a Debug Panel. */
export function AdminScreen(): React.JSX.Element {
  // ---- Debug settings store (sliders + last-measured values) ----
  const {
    similarityThreshold,
    yawThresholdDeg,
    challengeTimeoutMs,
    lastScore,
    lastLivenessPassed,
    lastChallengeType,
    setSimilarityThreshold,
    setYawThresholdDeg,
    setChallengeTimeoutMs,
    setLastScore,
  } = useDebugStore();

  // ---- Stats ----
  const [enrolledCount, setEnrolledCount] = useState(0);
  const [dbScore, setDbScore] = useState<number | null>(null);
  const [dbLiveness, setDbLiveness] = useState<boolean | null>(null);

  // ---- "View All Enrollments" ----
  const [showList, setShowList] = useState(false);
  const [enrollList, setEnrollList] = useState<EnrollItem[]>([]);

  // ---- "Test Recognition Score" camera modal ----
  const [testOpen, setTestOpen] = useState(false);

  const loadStats = useCallback(() => {
    try {
      const db = getDb(DEV_KEY);
      setEnrolledCount(countEnrollments(db));
      // Best-effort: derive last score/liveness from the most recent attendance
      // row (read-only — no service change). Rows may be purged after sync.
      const r = db.executeSync(
        'SELECT match_score, liveness_passed FROM attendance_queue ORDER BY created_at DESC LIMIT 1',
      );
      const row = r.rows?.[0] as
        | { match_score?: number | null; liveness_passed?: number | null }
        | undefined;
      if (row) {
        setDbScore(row.match_score != null ? Number(row.match_score) : null);
        setDbLiveness(
          row.liveness_passed != null ? Number(row.liveness_passed) === 1 : null,
        );
      }
    } catch {
      setEnrolledCount(0);
    }
  }, []);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  const onViewAll = useCallback(() => {
    try {
      const db = getDb(DEV_KEY);
      const rows = getAllEnrollments(db);
      setEnrollList(
        rows.map(r => ({
          id: r.id,
          personId: r.personId,
          name: r.displayName,
          dim: r.embedding.length,
        })),
      );
      setShowList(s => !s);
    } catch (e) {
      Alert.alert('Error', String(e));
    }
  }, []);

  const onClearAll = useCallback(() => {
    Alert.alert(
      'Clear all enrollments',
      'Delete ALL enrolled faces from the database? This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete all',
          style: 'destructive',
          onPress: () => {
            try {
              const db = getDb(DEV_KEY);
              for (const r of getAllEnrollments(db)) deleteEnrollment(db, r.id);
              setShowList(false);
              setEnrollList([]);
              loadStats();
              Alert.alert('Done', 'All enrollments cleared.');
            } catch (e) {
              Alert.alert('Error', String(e));
            }
          },
        },
      ],
    );
  }, [loadStats]);

  // Stats display helpers (debug-store value takes precedence over DB fallback).
  const scoreText =
    lastScore != null
      ? lastScore.toFixed(3)
      : dbScore != null
        ? dbScore.toFixed(3)
        : '—';
  const livenessText =
    lastLivenessPassed != null
      ? lastLivenessPassed
        ? 'Passed'
        : 'Failed'
      : dbLiveness != null
        ? dbLiveness
          ? 'Passed'
          : 'Failed'
        : '—';
  const challengeText = lastChallengeType ?? '—';

  return (
    <ScreenContainer>
      <Section title="App" caption="Build & runtime configuration">
        <Paragraph>{APP_NAME} — offline face attendance</Paragraph>
        <Paragraph>AWS region: {config.awsRegion}</Paragraph>
        <Paragraph>
          API endpoint: {config.awsApiBaseUrl ?? 'not configured (set via env)'}
        </Paragraph>
      </Section>

      <Section title="AI targets" caption="The hard constraints we are graded on">
        <Paragraph>Model footprint budget: ≤ {MODEL_FOOTPRINT_BUDGET_MB} MB</Paragraph>
        <Paragraph>Embedding dimension: {EMBEDDING_DIM}-D (MobileFaceNet)</Paragraph>
        <Paragraph>End-to-end latency target: under {TARGET_E2E_LATENCY_MS} ms</Paragraph>
        <Paragraph>Match threshold (cosine): {config.faceMatchThreshold}</Paragraph>
      </Section>

      <Section title="Security policy" caption="Enforced in Phase 4–5">
        <StatusPill
          label={`Active liveness: ${config.livenessRequired ? 'required' : 'off'}`}
          tone={config.livenessRequired ? 'success' : 'neutral'}
        />
        <StatusPill
          label={`Passive anti-spoof: ${
            config.passiveAntiSpoofRequired ? 'required' : 'off'
          }`}
          tone={config.passiveAntiSpoofRequired ? 'success' : 'neutral'}
        />
      </Section>

      {/* ============================ DEBUG PANEL ============================ */}
      <Section
        title="🔧 Debug Panel"
        caption="Calibration + diagnostics (dev only)">
        <View style={styles.statsCard}>
          <StatRow label="Total enrolled faces" value={String(enrolledCount)} />
          <StatRow label="Last recognition score" value={scoreText} />
          <StatRow label="Last liveness result" value={livenessText} />
          <StatRow label="Last challenge type" value={challengeText} />
        </View>
      </Section>

      <Section title="Debug actions">
        <PrimaryButton
          label={showList ? 'Hide Enrollments' : 'View All Enrollments'}
          onPress={onViewAll}
        />
        {showList &&
          (enrollList.length === 0 ? (
            <Paragraph>No enrollments.</Paragraph>
          ) : (
            enrollList.map(e => (
              <View key={e.id} style={styles.enrollRow}>
                <Text style={styles.enrollName}>{e.name}</Text>
                <Text style={styles.enrollMeta}>
                  {e.personId} · {e.dim}-D
                </Text>
              </View>
            ))
          ))}

        <View style={styles.gap} />
        <PrimaryButton
          label="Test Recognition Score"
          onPress={() => setTestOpen(true)}
        />

        <View style={styles.gap} />
        <Pressable style={styles.dangerBtn} onPress={onClearAll}>
          <Text style={styles.dangerLabel}>Clear All Enrollments</Text>
        </Pressable>
      </Section>

      <Section
        title="Tuning"
        caption="Live values used by the Test Recognition tool below.">
        <DebugSlider
          label="Similarity threshold"
          min={0.3}
          max={0.7}
          step={0.01}
          value={similarityThreshold}
          onChange={setSimilarityThreshold}
          format={v => v.toFixed(2)}
        />
        <DebugSlider
          label="Yaw angle threshold"
          min={8}
          max={25}
          step={1}
          value={yawThresholdDeg}
          onChange={setYawThresholdDeg}
          format={v => `${v.toFixed(0)}°`}
        />
        <DebugSlider
          label="Challenge timeout"
          min={3000}
          max={10000}
          step={500}
          value={challengeTimeoutMs}
          onChange={setChallengeTimeoutMs}
          format={v => `${(v / 1000).toFixed(1)}s`}
        />
      </Section>

      <TestRecognitionModal
        visible={testOpen}
        threshold={similarityThreshold}
        onClose={(measured: number | null) => {
          if (measured != null) setLastScore(measured);
          setTestOpen(false);
          loadStats();
        }}
      />
    </ScreenContainer>
  );
}

function StatRow({ label, value }: { label: string; value: string }): React.JSX.Element {
  return (
    <View style={styles.statRow}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
    </View>
  );
}

/**
 * Camera modal that shows the RAW best cosine score continuously (no pass/fail)
 * so the operator can hold up faces/photos and calibrate the threshold.
 */
function TestRecognitionModal({
  visible,
  threshold,
  onClose,
}: {
  visible: boolean;
  threshold: number;
  onClose: (measured: number | null) => void;
}): React.JSX.Element {
  const { hasPermission, request } = useCameraAccess();
  const device = useCameraDevice('front');
  const { frameProcessor, result, refresh } = useDebugRecognition();

  useEffect(() => {
    if (visible) refresh();
  }, [visible, refresh]);

  const hasFace = result.score != null && result.score >= 0;
  const scoreLabel = hasFace ? `Score: ${result.score!.toFixed(2)}` : 'Score: —';
  const wouldAccept = hasFace && result.score! >= threshold;

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={() => onClose(null)}>
      <View style={styles.modal}>
        {hasPermission && device != null ? (
          <Camera
            style={StyleSheet.absoluteFill}
            device={device}
            isActive={visible}
            frameProcessor={frameProcessor}
          />
        ) : (
          <View style={styles.modalCenter}>
            <Text style={styles.modalText}>Camera permission needed.</Text>
            <PrimaryButton label="Grant permission" onPress={request} />
          </View>
        )}

        <View style={styles.scorePanel}>
          <Text style={styles.scoreText}>{scoreLabel}</Text>
          <Text style={styles.scoreSub}>
            {hasFace
              ? `${result.name ?? 'unknown'} · threshold ${threshold.toFixed(2)} · ${
                  wouldAccept ? 'WOULD ACCEPT' : 'would reject'
                }`
              : `gallery: ${result.galleryCount} · point camera at a face`}
          </Text>
        </View>

        <View style={styles.modalFooter}>
          <PrimaryButton
            label="Close"
            onPress={() => onClose(hasFace ? result.score! : null)}
          />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  statsCard: { gap: 2 },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: palette.border,
  },
  statLabel: { fontSize: 14, color: palette.textMuted },
  statValue: { fontSize: 14, fontWeight: '700', color: palette.text },
  enrollRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: palette.border,
  },
  enrollName: { fontSize: 14, color: palette.text, fontWeight: '600' },
  enrollMeta: { fontSize: 12, color: palette.textMuted },
  gap: { height: 8 },
  dangerBtn: {
    backgroundColor: palette.danger,
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: 'center',
  },
  dangerLabel: { color: '#FFFFFF', fontWeight: '700', fontSize: 15 },
  modal: { flex: 1, backgroundColor: '#000' },
  modalCenter: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
    padding: 24,
  },
  modalText: { color: '#FFF', fontSize: 16 },
  scorePanel: {
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
  scoreText: { color: '#FFFFFF', fontSize: 30, fontWeight: '800' },
  scoreSub: { color: 'rgba(255,255,255,0.8)', fontSize: 13, textAlign: 'center' },
  modalFooter: { position: 'absolute', bottom: 48, left: 24, right: 24 },
});
