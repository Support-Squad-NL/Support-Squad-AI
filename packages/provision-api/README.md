# Provision API (MVP)

This package exposes a local-first provisioning API with a built-in SQLite-backed worker queue.

- `POST /assistants`: enqueue a VPS+install provisioning job.
- `GET /assistants/:assistantId`: fetch current assistant state and latest job.
- `POST /assistants/:assistantId/deprovision`: enqueue a deprovision job (opzeggen).
- `GET /jobs/:jobId`: fetch job status.
- `GET /jobs/:jobId/events`: list lifecycle events for the job.
- `GET /health`: liveness check.

Legacy aliases are still available:

- `POST /provision` -> `POST /assistants`
- `GET /provision/:jobId` -> `GET /jobs/:jobId`
- `GET /provision/:jobId/events` -> `GET /jobs/:jobId/events`
- `POST /provision/:jobId/deprovision` -> deprovision by job's assistant

## Required environment variables

- `CONTABO_CLIENT_ID`
- `CONTABO_CLIENT_SECRET`
- `CONTABO_API_USER`
- `CONTABO_API_PASSWORD`
- `SQLITE_DB_PATH` (optional, defaults to `./data/provision-api.sqlite`)
- `WEBHOOK_PUBLIC_BASE_URL` (optional; e.g. `https://assistant.example.com`, used for webhook endpoint output)
- `WORKER_POLL_MS` (optional, defaults to `3000`)
- `PORT` (optional, defaults to `8080`)

## Run locally

```bash
pnpm --dir packages/provision-api install
pnpm --dir packages/provision-api dev
```

## Example create-assistant request

```bash
curl -X POST "http://localhost:8080/assistants" \
  -H "content-type: application/json" \
  -d '{
    "idempotencyKey": "customer-123-order-456",
    "tenant_id": "assistant_123",
    "account_id": "account_456",
    "user_id": "user_789",
    "support_hub_api_key": "sh_live_xxx",
    "displayName": "SupportSquadAI-CustomerA",
    "productId": "V92",
    "region": "EU",
    "period": 1,
    "gitRef": "main",
    "repoUrl": "https://github.com/Support-Squad-NL/Support-Squad-AI.git",
    "modelEnv": {
      "OPENAI_API_KEY": "sk-..."
    }
  }'
```

## Notes

- Job and event state are stored in SQLite for now.
- Worker executes jobs asynchronously; API requests return quickly with job IDs.
- API responses intentionally do not expose `support_hub_api_key`, root password, or gateway token.
- Assistant webhook endpoint is exposed via assistant state (`assistant.webhook.endpoint`) once available.
