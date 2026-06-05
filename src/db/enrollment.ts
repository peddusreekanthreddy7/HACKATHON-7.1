import type { DB } from '@op-engineering/op-sqlite';
import { embeddingToBuffer, bufferToEmbedding } from '../ai/embedding';
import type { Embedding } from '../ai/embedding';

export interface EnrollmentRow {
  id: string;
  personId: string;
  displayName: string;
  embedding: Embedding;
  modelVersion: string;
  createdAt: number;
}

export function insertEnrollment(
  db: DB,
  row: Omit<EnrollmentRow, 'createdAt'>,
): void {
  const blob = embeddingToBuffer(row.embedding);
  db.executeSync(
    `INSERT INTO enrollments (id, person_id, display_name, embedding, model_version, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [row.id, row.personId, row.displayName, blob, row.modelVersion, Date.now()],
  );

  // Diagnostic: read the row straight back and report the stored norm. This
  // isolates a write/read corruption (norm 0 here) from a bad input embedding.
  try {
    const back = db.executeSync('SELECT embedding FROM enrollments WHERE id = ?', [row.id]);
    const storedBlob = back.rows[0]?.embedding as Uint8Array | ArrayBuffer | undefined;
    if (storedBlob) {
      const e = bufferToEmbedding(storedBlob);
      let n = 0;
      for (let i = 0; i < e.length; i++) n += e[i] * e[i];
      console.log(
        `[Enroll] READBACK blobBytes=${(storedBlob as ArrayBuffer).byteLength ?? '?'} len=${e.length} norm=${Math.sqrt(n).toFixed(4)}`,
      );
    } else {
      console.log('[Enroll] READBACK no row found!');
    }
  } catch (err) {
    console.log('[Enroll] READBACK error', String(err));
  }
}

export function getAllEnrollments(db: DB): EnrollmentRow[] {
  const result = db.executeSync('SELECT * FROM enrollments ORDER BY created_at ASC');
  return result.rows.map(r => ({
    id: String(r.id),
    personId: String(r.person_id),
    displayName: String(r.display_name),
    embedding: bufferToEmbedding(r.embedding as Uint8Array),
    modelVersion: String(r.model_version),
    createdAt: Number(r.created_at),
  }));
}

export function countEnrollments(db: DB): number {
  const r = db.executeSync('SELECT COUNT(*) AS n FROM enrollments');
  return Number(r.rows[0]?.n ?? 0);
}

export function deleteEnrollment(db: DB, id: string): void {
  db.executeSync('DELETE FROM enrollments WHERE id = ?', [id]);
}

export function deleteByPersonId(db: DB, personId: string): void {
  db.executeSync('DELETE FROM enrollments WHERE person_id = ?', [personId]);
}
