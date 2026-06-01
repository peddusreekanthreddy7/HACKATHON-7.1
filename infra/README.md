# Attendance Sync Backend (AWS SAM)

Open-source IaC for the sync endpoint: **API Gateway → Lambda → DynamoDB**,
idempotent by record id. MIT-licensed; no proprietary services.

```
infra/
  template.yaml      # SAM template (API + Lambda + DynamoDB table)
  src/
    handler.mjs      # Lambda: conditional PutItem (idempotent), 200 + ack
    package.json     # @aws-sdk/* deps
```

## Deploy

```bash
cd infra
npm --prefix src install        # install Lambda deps
sam build
sam deploy --guided             # first time; creates the stack
```

`sam deploy` prints the **ApiUrl** output — paste it into the app's
`DEFAULT_SYNC_CONFIG.endpointUrl` (`src/sync/config.ts`).

## Contract

`POST /attendance`

- Header `Idempotency-Key: <record id>` (falls back to `body.id`)
- Body: the `AttendancePayload` JSON (`src/sync/types.ts`)
- `200 { ok: true, id, duplicate: false }` — stored (device may now purge)
- `200 { ok: true, id, duplicate: true }` — already had it (safe replay)
- `400` — malformed/missing fields (permanent; the client won't retry)
- `5xx` — transient (the client retries with exponential backoff)

## Demo without AWS

Use the local mock server (`../mock-server/`) — same contract, in-memory store,
zero cloud dependencies. Point `endpointUrl` at it and the full
offline→online→purge lifecycle is demoable on a laptop.
