import React from 'react';

import {
  ScreenContainer,
  Section,
  Paragraph,
  StatusPill,
} from '../components';
import { config } from '../config/env';
import {
  APP_NAME,
  EMBEDDING_DIM,
  MODEL_FOOTPRINT_BUDGET_MB,
  TARGET_E2E_LATENCY_MS,
} from '../utils';

/** Admin / settings: build config + the hard-constraint targets at a glance. */
export function AdminScreen(): React.JSX.Element {
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
    </ScreenContainer>
  );
}
