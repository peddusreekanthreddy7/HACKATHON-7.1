import http from 'http';
import { computeBackoff } from '../src/sync/backoff';
import { pushRecord, recordToPayload, PermanentSyncError } from '../src/sync/pushRecord';
import type { AttendancePayload, SyncConfig } from '../src/sync/types';
import type { AttendanceRecord } from '../src/db/attendance';

const noSleep = () => Promise.resolve();
const zeroRng = () => 0;

const baseConfig: SyncConfig = {
  endpointUrl: '',
  maxRetries: 5,
  baseDelayMs: 1,
  maxDelayMs: 10,
  timeoutMs: 2000,
};

function payload(id = 'att-1'): AttendancePayload {
  return {
    id,
    personId: 'EMP-001',
    deviceId: 'dev-abc',
    capturedAt: 1700000000000,
    latitude: null,
    longitude: null,
    livenessPassed: true,
    antiSpoofScore: null,
    matchScore: 0.91,
  };
}

interface TestServer {
  url: string;
  close: () => Promise<void>;
  getCount: () => number;
}

type Handler = (req: http.IncomingMessage, res: http.ServerResponse, body: string) => void;

function startServer(handler: Handler): Promise<TestServer> {
  const state = { count: 0 };
  const server = http.createServer((req, res) => {
    state.count++;
    let body = '';
    req.on('data', c => (body += c));
    req.on('end', () => handler(req, res, body));
  });
  return new Promise(resolve => {
    server.listen(0, '127.0.0.1', () => {
      const port = (server.address() as { port: number }).port;
      resolve({
        url: `http://127.0.0.1:${port}/attendance`,
        close: () => new Promise<void>(r => server.close(() => r())),
        getCount: () => state.count,
      });
    });
  });
}

function send(res: http.ServerResponse, status: number, body: unknown) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(body));
}

// --------------------------------------------------------------------------

describe('computeBackoff (exponential + full jitter)', () => {
  it('is 0 when rng returns 0', () => {
    expect(computeBackoff(0, 500, 30000, zeroRng)).toBe(0);
  });
  it('scales exponentially with the attempt', () => {
    expect(computeBackoff(0, 500, 30000, () => 0.5)).toBe(250); // 0.5 * 500
    expect(computeBackoff(1, 500, 30000, () => 0.5)).toBe(500); // 0.5 * 1000
    expect(computeBackoff(2, 500, 30000, () => 0.5)).toBe(1000); // 0.5 * 2000
  });
  it('caps at maxMs', () => {
    // attempt 10 → 500 * 2^10 = 512000, capped to 30000
    expect(computeBackoff(10, 500, 30000, () => 0.999)).toBeLessThanOrEqual(30000);
    expect(computeBackoff(10, 500, 30000, () => 0.5)).toBe(15000);
  });
});

describe('recordToPayload', () => {
  it('keeps wire fields and drops local-only fields', () => {
    const rec: AttendanceRecord = {
      id: 'att-9',
      personId: 'EMP-9',
      deviceId: 'dev-9',
      capturedAt: 123,
      latitude: 1.5,
      longitude: 2.5,
      livenessPassed: true,
      antiSpoofScore: 0.8,
      matchScore: 0.95,
      synced: false,
      createdAt: 999,
    };
    const p = recordToPayload(rec);
    expect(p).toEqual({
      id: 'att-9',
      personId: 'EMP-9',
      deviceId: 'dev-9',
      capturedAt: 123,
      latitude: 1.5,
      longitude: 2.5,
      livenessPassed: true,
      antiSpoofScore: 0.8,
      matchScore: 0.95,
    });
    expect('synced' in p).toBe(false);
    expect('createdAt' in p).toBe(false);
  });
});

describe('pushRecord — happy path', () => {
  it('returns ok on 200 and sends the Idempotency-Key header', async () => {
    let seenKey: string | undefined;
    const srv = await startServer((req, res, body) => {
      seenKey = req.headers['idempotency-key'] as string;
      const p = JSON.parse(body);
      send(res, 200, { ok: true, id: p.id, duplicate: false });
    });
    try {
      const ack = await pushRecord(payload('att-key-1'), { ...baseConfig, endpointUrl: srv.url }, {
        sleep: noSleep,
        rng: zeroRng,
      });
      expect(ack.ok).toBe(true);
      expect(ack.duplicate).toBe(false);
      expect(seenKey).toBe('att-key-1');
      expect(srv.getCount()).toBe(1);
    } finally {
      await srv.close();
    }
  });
});

describe('pushRecord — idempotency', () => {
  it('a replayed id returns duplicate:true (server-side dedup)', async () => {
    const store = new Set<string>();
    const srv = await startServer((req, res, body) => {
      const p = JSON.parse(body);
      const dup = store.has(p.id);
      store.add(p.id);
      send(res, 200, { ok: true, id: p.id, duplicate: dup });
    });
    try {
      const cfg = { ...baseConfig, endpointUrl: srv.url };
      const first = await pushRecord(payload('dupe'), cfg, { sleep: noSleep });
      const second = await pushRecord(payload('dupe'), cfg, { sleep: noSleep });
      expect(first.duplicate).toBe(false);
      expect(second.duplicate).toBe(true);
    } finally {
      await srv.close();
    }
  });
});

describe('pushRecord — retry on transient failure', () => {
  it('retries 5xx then succeeds', async () => {
    let n = 0;
    const srv = await startServer((req, res, body) => {
      n++;
      if (n <= 2) return send(res, 500, { ok: false });
      const p = JSON.parse(body);
      send(res, 200, { ok: true, id: p.id, duplicate: false });
    });
    try {
      const ack = await pushRecord(payload(), { ...baseConfig, endpointUrl: srv.url }, {
        sleep: noSleep,
        rng: zeroRng,
      });
      expect(ack.ok).toBe(true);
      expect(srv.getCount()).toBe(3); // 2 failures + 1 success
    } finally {
      await srv.close();
    }
  });

  it('gives up after maxRetries and rejects', async () => {
    const srv = await startServer((_req, res) => send(res, 503, { ok: false }));
    try {
      await expect(
        pushRecord(payload(), { ...baseConfig, maxRetries: 3, endpointUrl: srv.url }, {
          sleep: noSleep,
          rng: zeroRng,
        }),
      ).rejects.toThrow();
      expect(srv.getCount()).toBe(4); // 1 initial + 3 retries
    } finally {
      await srv.close();
    }
  });
});

describe('pushRecord — permanent failure', () => {
  it('does NOT retry a 400 and throws PermanentSyncError', async () => {
    const srv = await startServer((_req, res) => send(res, 400, { ok: false, error: 'bad' }));
    try {
      await expect(
        pushRecord(payload(), { ...baseConfig, endpointUrl: srv.url }, { sleep: noSleep }),
      ).rejects.toBeInstanceOf(PermanentSyncError);
      expect(srv.getCount()).toBe(1); // no retries
    } finally {
      await srv.close();
    }
  });
});
