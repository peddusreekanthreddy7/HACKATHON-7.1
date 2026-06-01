# `/aws` — sync backend (stub)

The cloud side of **sync-and-purge** (hard constraint #8). Field devices work
fully offline; when a network returns they push queued, encrypted attendance
records here, and only purge locally **after a confirmed ACK**.

> Status: **stub**. Fleshed out and deployed in **Phase 6**.

## Architecture

```
App (offline queue, SQLCipher)
        │  POST /attendance   (batch, idempotent by record id)
        ▼
API Gateway ──► Lambda (ingestAttendance) ──► DynamoDB (attendance)
                                           └─► S3 (optional cold archive)
        │  200 { acked: [ids...] }
        ▼
App purges ONLY the acked ids locally
```

- **Idempotent**: records carry a client-generated `id`; re-sending is safe.
- **No images ever leave the device** — payloads contain match metadata only.

## Deploy (Phase 6)

```bash
cd aws
sam build
sam deploy --guided          # prints the API base URL
```

Set the printed URL as `AWS_API_BASE_URL` in the app's `.env`.
