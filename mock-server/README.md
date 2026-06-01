# Local mock sync server

A zero-dependency Node server that mimics the AWS sync endpoint (`infra/`) with
an in-memory store, so the offline→online→purge lifecycle is demoable without a
cloud account. Same request/response contract as the Lambda.

```bash
node mock-server/server.mjs              # http://localhost:8787
PORT=9000 node mock-server/server.mjs    # custom port
FAIL_TIMES=2 node mock-server/server.mjs # first 2 POSTs return 500 (demo retry)
```

| Route | Behaviour |
|-------|-----------|
| `POST /attendance` | idempotent by `Idempotency-Key`/`id` → `200 { ok, id, duplicate }` |
| `GET /records` | dump the in-memory store (debug) |
| `GET /health` | `{ ok: true }` |

From the Android emulator the host is `http://10.0.2.2:8787`; on a physical
device use your machine's LAN IP. See `docs/SYNC.md` for the full lifecycle.
