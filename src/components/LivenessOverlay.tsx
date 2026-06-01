import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { CHALLENGE_PROMPT, type LivenessState } from '../liveness';
import { palette } from '../navigation/theme';

const STATUS_ICON: Record<string, string> = {
  pending: '○',
  active: '▶',
  passed: '✓',
  failed: '✗',
};
const STATUS_COLOR: Record<string, string> = {
  pending: palette.textMuted,
  active: '#FFFFFF',
  passed: palette.success,
  failed: palette.danger,
};

interface Props {
  liveness: LivenessState;
  prompt: string;
  antiSpoofState: 'loading' | 'loaded' | 'error';
  timeoutMs: number;
}

/** Non-interactive HUD: prompt, challenge progress, countdown, pass/fail banner. */
export function LivenessOverlay({
  liveness,
  prompt,
  antiSpoofState,
  timeoutMs,
}: Props): React.JSX.Element {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (liveness.phase !== 'running') return;
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [liveness.phase]);

  const current = liveness.challenges[liveness.currentIndex];
  const remaining =
    liveness.phase === 'running' && current && current.startedAt != null
      ? Math.max(0, Math.ceil((current.startedAt + timeoutMs - now) / 1000))
      : null;

  const bannerTone =
    liveness.phase === 'passed'
      ? palette.success
      : liveness.phase === 'failed'
        ? palette.danger
        : null;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <View style={styles.top}>
        <Text style={styles.prompt}>{prompt}</Text>
        {remaining != null ? <Text style={styles.count}>{remaining}s</Text> : null}
      </View>

      <View style={styles.chips}>
        {liveness.challenges.map((c, i) => (
          <View key={i} style={styles.chip}>
            <Text style={[styles.chipIcon, { color: STATUS_COLOR[c.status] }]}>
              {STATUS_ICON[c.status]}
            </Text>
            <Text style={styles.chipText}>{CHALLENGE_PROMPT[c.type]}</Text>
          </View>
        ))}
      </View>

      {antiSpoofState === 'error' && liveness.phase === 'antispoof' ? (
        <View style={styles.warn}>
          <Text style={styles.warnText}>
            Passive anti-spoof model not installed — liveness is failing closed
            (secure default). Run: python scripts/convert_minifasnet.py
          </Text>
        </View>
      ) : null}

      {bannerTone ? (
        <View style={[styles.banner, { backgroundColor: bannerTone }]}>
          <Text style={styles.bannerText}>
            {liveness.phase === 'passed'
              ? 'LIVENESS CONFIRMED'
              : `LIVENESS FAILED${liveness.reason ? ` · ${liveness.reason}` : ''}`}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  top: {
    position: 'absolute',
    top: 24,
    left: 0,
    right: 0,
    alignItems: 'center',
    gap: 6,
  },
  prompt: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '800',
    textAlign: 'center',
    paddingHorizontal: 24,
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowRadius: 6,
  },
  count: { color: '#FFFFFF', fontSize: 16, fontWeight: '700', opacity: 0.9 },
  chips: {
    position: 'absolute',
    bottom: 96,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(0,0,0,0.55)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
  },
  chipIcon: { fontSize: 14, fontWeight: '900' },
  chipText: { color: '#FFFFFF', fontSize: 13, fontWeight: '600' },
  warn: {
    position: 'absolute',
    top: 100,
    left: 16,
    right: 16,
    backgroundColor: 'rgba(217,119,6,0.92)',
    padding: 12,
    borderRadius: 10,
  },
  warnText: { color: '#FFFFFF', fontSize: 13, fontWeight: '600', textAlign: 'center' },
  banner: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingVertical: 18,
    alignItems: 'center',
  },
  bannerText: { color: '#FFFFFF', fontSize: 18, fontWeight: '800', letterSpacing: 0.5 },
});
