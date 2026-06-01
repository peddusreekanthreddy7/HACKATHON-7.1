import { open, type DB } from '@op-engineering/op-sqlite';
import { CREATE_TABLES } from './schema';

export type { DB };

let connection: DB | null = null;

/**
 * Opens (once) the encrypted local database.
 *
 * SQLCipher encryption is enabled via op-sqlite's build config. The key is
 * derived from the device Keystore (Android) / Keychain (iOS) in Phase 5 —
 * NEVER hardcoded, NEVER bundled. `encryptionKey` is that secret's wiring point.
 *
 * During development / testing a constant key is acceptable; it MUST be
 * replaced with a Keystore-derived key before any production deployment.
 */
export function getDb(encryptionKey: string): DB {
  if (connection) return connection;

  connection = open({ name: 'datalake.db', encryptionKey });
  connection.executeSync('PRAGMA journal_mode = WAL;');
  connection.executeSync('PRAGMA foreign_keys = ON;');
  for (const statement of CREATE_TABLES) {
    connection.executeSync(statement);
  }
  return connection;
}

/** Closes the connection (used on logout / key rotation). */
export function closeDb(): void {
  connection?.close();
  connection = null;
}

export {
  insertEnrollment,
  getAllEnrollments,
  countEnrollments,
  deleteEnrollment,
  deleteByPersonId,
  type EnrollmentRow,
} from './enrollment';
export {
  recordAttendance,
  getUnsynced,
  countUnsynced,
  purgeSynced,
  getDeviceId,
  getSyncMeta,
  bumpSyncedTotal,
  type AttendanceRecord,
  type NewAttendanceInput,
  type SyncMeta,
} from './attendance';
