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
- `GCP_API_KEYS_PROJECT_ID` (Google Cloud project id for API key provisioning)
- `GCP_API_KEYS_SERVICE_ACCOUNT_JSON` (preferred) OR:
  - `GCP_API_KEYS_SERVICE_ACCOUNT_EMAIL`
  - `GCP_API_KEYS_SERVICE_ACCOUNT_PRIVATE_KEY`
- `SQLITE_DB_PATH` (optional, defaults to `./data/provision-api.sqlite`)
- `WEBHOOK_PUBLIC_BASE_URL` (optional; e.g. `https://assistant.example.com`, used for webhook endpoint output)
- `WORKER_POLL_MS` (optional, defaults to `3000`)
- `PORT` (optional, defaults to `8080`)
- `CONTABO_REUSE_INSTANCE_ID` (optional; when set, provisioning re-installs this existing VPS instead of creating a new one)

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
    "autoCreateGeminiKey": true,
    "modelEnv": {
      "OPENAI_API_KEY": "sk-..."
    }
  }'
```

When `autoCreateGeminiKey` is `true` (default), provisioning does this automatically:

1. Create a Gemini-compatible Google API key through Google API Keys API.
2. Inject it as `GEMINI_API_KEY` (and `GOOGLE_API_KEY`) on the VPS.
3. Set default model to `google/gemini-3-pro-preview`.
4. Start SupportSquadAI + dashboard so it is directly usable after bootstrap.

## Reuse one VPS for repeated tests

For lower test costs, set `CONTABO_REUSE_INSTANCE_ID=<instance-id>`.

- Each `POST /assistants` run starts from a clean base by calling Contabo **reinstall** on that instance.
- This keeps one reusable test VPS while still forcing a fresh OS + fresh cloud-init bootstrap each test.
- In this mode, deprovision endpoint skips provider cancel for that reusable instance.

## Notes

- Job and event state are stored in SQLite for now.
- Worker executes jobs asynchronously; API requests return quickly with job IDs.
- API responses intentionally do not expose `support_hub_api_key`, root password, or gateway token.
- API responses intentionally do not expose `support_hub_api_key`, root password, gateway token, or Gemini API key value.
- Assistant webhook endpoint is exposed via assistant state (`assistant.webhook.endpoint`) once available.

## Chat widget integration contract (Gateway)

Use the `assistant.widget` object from `GET /assistants/:assistantId` as the canonical client bundle:

- `assistant.widget.websocketUrl`
- `assistant.widget.token`
- `assistant.widget.sessionKey` (default `owner:main`)
- `assistant.assistantId`

### 1) WebSocket connect flow

1. Connect to `assistant.widget.websocketUrl`.
2. Wait for server frame: `{"type":"event","event":"connect.challenge","payload":{"nonce":"..."}}`.
3. Send JSON-RPC `connect` request (`type: "req"`), not a custom auth envelope.
4. After `connect` success, send `chat.send` requests.

### 2) Connect payload requirements

`connect` parameters must include:

- `auth.token`: gateway token from provision response.
- `sessionKey`: usually `owner:main`.
- `role`: e.g. `operator`.
- `scopes`: must include `operator.write` for `chat.send`.
- `device`: signed device identity payload (required for secure/default mode).

Device signing payload format is:

`v2|<deviceId>|<clientId>|<clientMode>|<role>|<scopesCsv>|<signedAtMs>|<token>|<nonce>`

Requirements:

- `signedAtMs` is epoch milliseconds.
- `nonce` must come from `connect.challenge`.
- `deviceId` is the fingerprint of the raw Ed25519 public key bytes.
- Signature and key fields must use base64url where expected by the gateway/device auth path.

### 3) `chat.send` contract

Send as JSON-RPC frame:

- `type: "req"`
- `method: "chat.send"`
- `params.message` (string)
- `params.sessionKey`
- `params.idempotencyKey` (unique per send attempt)

Idempotency guidance:

- Reusing the same `idempotencyKey` can return cached/silent outcomes.
- On empty/no-output finals, retry with a new `idempotencyKey`.

### 4) Attachments

Current gateway behavior for `chat.send.attachments`:

- Supported: inline base64 image attachments (`image/*`).
- Not supported as first-class model attachments: audio/pdf/docs/video in this RPC path.
- Data URL input is allowed (`data:image/png;base64,...`); gateway strips prefix.

For non-image files in widget UX:

- upload file to your backend/object storage,
- optionally preprocess (STT/OCR/PDF extract),
- send extracted text + file reference in `message`.

### 5) How to obtain credentials

1. Create assistant: `POST /assistants`.
2. Poll job/assistant state until `assistant.status` is `ready`.
3. Read `assistant.widget` from `GET /assistants/:assistantId`.
4. Pass that bundle to frontend widget bootstrap.
