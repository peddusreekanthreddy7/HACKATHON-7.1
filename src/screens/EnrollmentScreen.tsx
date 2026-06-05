import React, { useEffect, useState } from 'react';
import {
  Alert,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Camera, useCameraDevice } from 'react-native-vision-camera';
import { useIsFocused } from '@react-navigation/native';

import { ScreenContainer, Section, Paragraph, PrimaryButton, StatusPill } from '../components';
import { useCameraAccess, useEnrollment } from '../hooks';
import { getDb, countEnrollments, getAllEnrollments, deleteEnrollment } from '../db';
import { palette } from '../navigation/theme';

const DEV_KEY = 'dev-placeholder-key-phase5-will-rotate';

/**
 * Enrollment screen: capture a person's face across 7 frames → average
 * embedding → store encrypted in SQLCipher. Never stores raw images.
 */
export function EnrollmentScreen(): React.JSX.Element {
  const { hasPermission, request, status } = useCameraAccess();
  const device = useCameraDevice('front');
  const isFocused = useIsFocused();

  const { frameProcessor, phase, captured, total, start, reset, error } = useEnrollment();

  const [personId, setPersonId] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [enrolledCount, setEnrolledCount] = useState(0);
  const [enrolledList, setEnrolledList] = useState<
    { id: string; displayName: string; personId: string }[]
  >([]);

  const refreshList = () => {
    try {
      const db = getDb(DEV_KEY);
      setEnrolledCount(countEnrollments(db));
      const rows = getAllEnrollments(db);
      setEnrolledList(
        rows.map(r => ({ id: r.id, displayName: r.displayName, personId: r.personId })),
      );
    } catch {
      setEnrolledCount(0);
    }
  };

  useEffect(() => { refreshList(); }, []);

  useEffect(() => {
    if (phase === 'done') {
      refreshList();
      Alert.alert('Enrolled', `${displayName} enrolled successfully.`);
      reset();
      setPersonId('');
      setDisplayName('');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  const onStartEnrollment = () => {
    if (!personId.trim()) { Alert.alert('Required', 'Enter a person ID.'); return; }
    if (!displayName.trim()) { Alert.alert('Required', 'Enter a display name.'); return; }
    start(personId.trim(), displayName.trim());
  };

  const onDelete = (id: string, name: string) => {
    Alert.alert('Delete', `Remove ${name}?`, [
      { text: 'Cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => { deleteEnrollment(getDb(DEV_KEY), id); refreshList(); },
      },
    ]);
  };

  const capturing = phase === 'capturing';
  const saving = phase === 'saving';

  return (
    <View style={styles.fill}>
      {hasPermission && device != null && (
        <Camera
          style={capturing ? styles.camera : styles.hidden}
          device={device}
          isActive={isFocused && capturing}
          frameProcessor={frameProcessor}
        />
      )}

      <ScreenContainer>
        <Section
          title="Enroll field personnel"
          caption="Stores only a math embedding — no photos, ever.">
          <StatusPill
            label={`Camera: ${status}`}
            tone={hasPermission ? 'success' : 'warning'}
          />
          {!hasPermission && (
            <PrimaryButton label="Grant camera permission" onPress={request} />
          )}
        </Section>

        {/* Form — hidden while camera is capturing */}
        {!capturing && !saving && (
          <Section title="New enrollment">
            <TextInput
              style={styles.input}
              placeholder="Person ID  (e.g. EMP-001)"
              placeholderTextColor={palette.textMuted}
              value={personId}
              onChangeText={setPersonId}
              autoCapitalize="none"
            />
            <TextInput
              style={styles.input}
              placeholder="Display name  (e.g. Priya Sharma)"
              placeholderTextColor={palette.textMuted}
              value={displayName}
              onChangeText={setDisplayName}
            />
            <PrimaryButton
              label="Start enrollment"
              onPress={onStartEnrollment}
              disabled={!personId.trim() || !displayName.trim()}
            />
          </Section>
        )}

        {/* Capture progress */}
        {(capturing || saving) && (
          <Section title={saving ? 'Saving…' : 'Look at the camera'}>
            <View style={styles.progressRow}>
              {Array.from({ length: total }, (_, i) => (
                <View key={i} style={[styles.dot, i < captured && styles.dotFilled]} />
              ))}
            </View>
            <Paragraph>
              {saving
                ? 'Encrypting + storing embedding…'
                : `Frame ${captured} / ${total}  — hold still`}
            </Paragraph>
            {!saving && <PrimaryButton label="Cancel" onPress={reset} />}
          </Section>
        )}

        {error != null && (
          <Section title="Error">
            <Paragraph>{error}</Paragraph>
            <PrimaryButton label="Retry" onPress={reset} />
          </Section>
        )}

        {/* Enrolled list */}
        <Section
          title={`Enrolled (${enrolledCount})`}
          caption="SQLCipher-encrypted embeddings  · no images stored.">
          {enrolledList.length === 0 ? (
            <Paragraph>No enrollments yet.</Paragraph>
          ) : (
            enrolledList.map(e => (
              <View key={e.id} style={styles.row}>
                <View style={styles.rowText}>
                  <Text style={styles.name}>{e.displayName}</Text>
                  <Text style={styles.pid}>{e.personId}</Text>
                </View>
                <PrimaryButton
                  label="Delete"
                  onPress={() => onDelete(e.id, e.displayName)}
                />
              </View>
            ))
          )}
        </Section>
      </ScreenContainer>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: palette.bg },
  camera: { width: '100%', height: 240 },
  hidden: { width: 0, height: 0 },
  input: {
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    color: palette.text,
    backgroundColor: palette.card,
    marginBottom: 10,
  },
  progressRow: {
    flexDirection: 'row',
    gap: 8,
    marginVertical: 10,
    justifyContent: 'center',
  },
  dot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: palette.border,
    borderWidth: 1,
    borderColor: palette.textMuted,
  },
  dotFilled: { backgroundColor: palette.brand },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: palette.border,
    gap: 8,
  },
  rowText: { flex: 1 },
  name: { fontSize: 15, fontWeight: '600', color: palette.text },
  pid: { fontSize: 12, color: palette.textMuted },
});
