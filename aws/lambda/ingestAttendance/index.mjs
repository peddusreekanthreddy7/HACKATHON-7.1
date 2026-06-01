// Ingest attendance batches from field devices (STUB — implemented in Phase 6).
//
// Contract (drives client-side sync-and-purge):
//   Request  : { records: [{ id, personId, capturedAt, livenessPassed, ... }] }
//   Response : 200 { ok: true, acked: [id, ...] }
//   The client purges locally ONLY the ids returned in `acked`.
//
// Idempotent by `id` so client retries never duplicate.
// NOTE: payloads carry match metadata only — NEVER face images or raw embeddings.

export const handler = async event => {
  try {
    const body = JSON.parse(event.body ?? '{}');
    const records = Array.isArray(body.records) ? body.records : [];

    // Phase 6: BatchWriteItem into DynamoDB (process.env.TABLE_NAME),
    // conditional on `id` to stay idempotent.
    const acked = records.map(r => r.id).filter(Boolean);

    return {
      statusCode: 200,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ok: true, acked }),
    };
  } catch {
    return {
      statusCode: 400,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ok: false, error: 'invalid payload' }),
    };
  }
};
