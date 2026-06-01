/**
 * Local mock of the attendance sync endpoint — same contract as the AWS Lambda
 * (infra/), with an in-memory store. Lets the whole offline→online→purge
 * lifecycle be demoed on a laptop with zero cloud dependencies.
 *
 *   node mock-server/server.mjs            # listens on :8787
 *   PORT=9000 node mock-server/server.mjs  # custom port
 *   FAIL_TIMES=2 node mock-server/server.mjs   # first 2 requests return 500
 *                                              # (to demo retry/backoff)
 *
 * Endpoints:
 *   POST /attendance   -> { ok, id, duplicate }   (idempotent by id)
 *   GET  /records      -> all stored records (debug)
 *   GET  /health       -> { ok: true }
 */
import http from 'node:http';

const store = new Map();
let failBudget = Number(process.env.FAIL_TIMES || 0);

export function createMockServer() {
  return http.createServer((req, res) => {
    const json = (status, body) => {
      res.writeHead(status, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(body));
    };

    if (req.method === 'GET' && req.url === '/health') return json(200, { ok: true });
    if (req.method === 'GET' && req.url === '/records') return json(200, [...store.values()]);

    if (req.method === 'POST' && req.url === '/attendance') {
      let body = '';
      req.on('data', c => (body += c));
      req.on('end', () => {
        // Simulate transient failures to exercise client retry/backoff.
        if (failBudget > 0) {
          failBudget--;
          return json(500, { ok: false, error: 'simulated transient failure' });
        }
        let payload;
        try {
          payload = JSON.parse(body);
        } catch {
          return json(400, { ok: false, error: 'invalid json' });
        }
        const id = req.headers['idempotency-key'] || payload.id;
        if (!id || !payload.personId || !payload.deviceId) {
          return json(400, { ok: false, error: 'missing id/personId/deviceId' });
        }
        const duplicate = store.has(id);
        if (!duplicate) store.set(id, { ...payload, id, receivedAt: Date.now() });
        return json(200, { ok: true, id, duplicate });
      });
      return;
    }

    json(404, { ok: false, error: 'not found' });
  });
}

// Run standalone when invoked directly.
if (import.meta.url === `file://${process.argv[1]}`) {
  const port = Number(process.env.PORT || 8787);
  createMockServer().listen(port, () => {
    // eslint-disable-next-line no-console
    console.log(`Mock attendance sync server on http://localhost:${port}`);
  });
}
