import { randomBytes, randomUUID } from "node:crypto";
import express from "express";
import { z } from "zod";
import { buildCloudInitScript } from "./cloud-init.js";
import { ContaboClient } from "./contabo.js";
import { SqliteJobStore } from "./storage-sqlite.js";

const WORKER_POLL_MS = Number(process.env.WORKER_POLL_MS ?? 3000);
const INSTANCE_POLL_SECONDS = Number(process.env.INSTANCE_POLL_SECONDS ?? 20);

const createAssistantSchema = z.object({
  idempotencyKey: z.string().min(8).max(128),
  tenant_id: safeSingleLineString(),
  account_id: safeSingleLineString(),
  user_id: safeSingleLineString(),
  support_hub_api_key: safeSingleLineString(),
  displayName: z.string().min(3).max(255).default("SupportSquadAI"),
  productId: z.string().min(2).max(20).default("V92"),
  region: z.string().min(2).max(20).default("EU"),
  period: z.number().int().min(1).max(12).default(1),
  imageId: z.string().min(16).default("afecbb85-e2fc-46f0-9684-b46b1faf00bb"),
  defaultUser: z.enum(["root", "admin", "administrator"]).default("root"),
  rootPassword: safeSingleLineString().optional(),
  gatewayToken: safeSingleLineString().optional(),
  gatewayMode: z.enum(["local", "remote"]).default("local"),
  gatewayBind: z.enum(["lan", "loopback"]).default("lan"),
  gatewayPort: z.number().int().min(1).max(65535).default(18789),
  bridgePort: z.number().int().min(1).max(65535).default(18790),
  gitRef: z.string().min(1).max(64).default("main"),
  repoUrl: z.url().default("https://github.com/Support-Squad-NL/Support-Squad-AI.git"),
  modelEnv: envMapSchema().default({}),
  extraEnv: envMapSchema().default({}),
});

const deprovisionSchema = z.object({
  idempotencyKey: z.string().min(8).max(128),
});

const app = express();
app.use(express.json({ limit: "1mb" }));
const store = new SqliteJobStore();
let workerRunning = false;

app.get("/health", (_req, res) => {
  res.json({
    ok: true,
    service: "provision-api",
    uptimeSec: Math.floor(process.uptime()),
    storage: {
      type: "sqlite",
      path: store.dbPath,
    },
    worker: {
      pollMs: WORKER_POLL_MS,
    },
  });
});

app.post("/assistants", createAssistantHandler);

function createAssistantHandler(req, res) {
  const parsed = createAssistantSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid request body", issues: parsed.error.issues });
  }
  const input = parsed.data;
  const existingJob = store.getJobByIdempotencyKey(input.idempotencyKey);
  if (existingJob) {
    return res.status(200).json({ job: sanitizeJob(existingJob), deduplicated: true });
  }

  const assistant = upsertAssistantFromInput(input);
  const job = createProvisionJob(assistant, input);
  try {
    store.createJob(job);
  } catch (error) {
    if (isSqliteUniqueConstraintError(error)) {
      const raceWinner = store.getJobByIdempotencyKey(input.idempotencyKey);
      return res.status(200).json({ job: sanitizeJob(raceWinner), deduplicated: true });
    }
    throw error;
  }
  appendEvent(job.id, "info", "Provision job queued", { assistantId: assistant.assistantId });
  const latestAssistant = {
    ...assistant,
    status: "provisioning_requested",
    lastJobId: job.id,
    updatedAt: nowIso(),
  };
  store.upsertAssistant(latestAssistant);
  return res.status(202).json({
    assistant: sanitizeAssistant(latestAssistant),
    job: sanitizeJob(job),
  });
}

app.get("/assistants/:assistantId", (req, res) => {
  const assistant = store.getAssistant(req.params.assistantId);
  if (!assistant) {
    return res.status(404).json({ error: "Assistant not found" });
  }
  const latestJob = store.getLatestJobForAssistant(assistant.assistantId);
  return res.status(200).json({
    assistant: sanitizeAssistant(assistant),
    latestJob: latestJob ? sanitizeJob(latestJob) : null,
  });
});

app.post("/assistants/:assistantId/deprovision", deprovisionAssistantHandler);

function deprovisionAssistantHandler(req, res) {
  const parsed = deprovisionSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid request body", issues: parsed.error.issues });
  }
  const assistant = store.getAssistant(req.params.assistantId);
  if (!assistant) {
    return res.status(404).json({ error: "Assistant not found" });
  }
  const existingJob = store.getJobByIdempotencyKey(parsed.data.idempotencyKey);
  if (existingJob) {
    return res.status(200).json({ job: sanitizeJob(existingJob), deduplicated: true });
  }
  const job = {
    id: randomUUID(),
    assistantId: assistant.assistantId,
    idempotencyKey: parsed.data.idempotencyKey,
    type: "deprovision",
    state: "queued",
    runAfter: nowIso(),
    attempts: 0,
    createdAt: nowIso(),
    updatedAt: nowIso(),
    payload: {
      instanceId: assistant.instance?.id ?? null,
    },
    result: null,
    error: null,
  };
  store.createJob(job);
  appendEvent(job.id, "warn", "Deprovision job queued", { assistantId: assistant.assistantId });
  const updatedAssistant = {
    ...assistant,
    status: "deprovision_requested",
    lastJobId: job.id,
    updatedAt: nowIso(),
  };
  store.upsertAssistant(updatedAssistant);
  return res.status(202).json({
    assistant: sanitizeAssistant(updatedAssistant),
    job: sanitizeJob(job),
  });
}

app.get("/jobs/:jobId", (req, res) => {
  const job = store.getJob(req.params.jobId);
  if (!job) {
    return res.status(404).json({ error: "Job not found" });
  }
  return res.status(200).json({ job: sanitizeJob(job) });
});

app.get("/jobs/:jobId/events", (req, res) => {
  const job = store.getJob(req.params.jobId);
  if (!job) {
    return res.status(404).json({ error: "Job not found" });
  }
  return res.status(200).json({ jobId: job.id, events: store.listEvents(job.id) });
});

// Backward-compatible aliases.
app.post("/provision", createAssistantHandler);
app.get("/provision/:jobId", (req, res) => {
  const job = store.getJob(req.params.jobId);
  if (!job) {
    return res.status(404).json({ error: "Job not found" });
  }
  return res.status(200).json({ job: sanitizeJob(job) });
});
app.get("/provision/:jobId/events", (req, res) => {
  const job = store.getJob(req.params.jobId);
  if (!job) {
    return res.status(404).json({ error: "Job not found" });
  }
  return res.status(200).json({ jobId: job.id, events: store.listEvents(job.id) });
});
app.post("/provision/:jobId/deprovision", (req, res) => {
  const job = store.getJob(req.params.jobId);
  if (!job) {
    return res.status(404).json({ error: "Job not found" });
  }
  req.params.assistantId = job.assistantId;
  return deprovisionAssistantHandler(req, res);
});

const port = Number(process.env.PORT ?? 8080);
app.listen(port, () => {
  console.log(`[provision-api] listening on :${port}`);
  console.log(`[provision-api] worker polling every ${WORKER_POLL_MS}ms`);
});

setInterval(() => {
  runWorkerTick().catch((error) => {
    console.error("[provision-api] worker tick error", error);
  });
}, WORKER_POLL_MS);

async function runWorkerTick() {
  if (workerRunning) {
    return;
  }
  workerRunning = true;
  try {
    const job = store.claimNextRunnableJob(nowIso());
    if (!job) {
      return;
    }
    appendEvent(job.id, "info", "Job claimed by worker", { type: job.type, attempt: job.attempts });
    if (job.type === "provision") {
      await processProvisionJob(job);
      return;
    }
    if (job.type === "deprovision") {
      await processDeprovisionJob(job);
      return;
    }
    throw new Error(`Unsupported job type: ${job.type}`);
  } finally {
    workerRunning = false;
  }
}

async function processProvisionJob(job) {
  const assistant = store.getAssistant(job.assistantId);
  if (!assistant) {
    return failJob(job, `Assistant ${job.assistantId} not found`);
  }
  const step = job.payload?.step ?? "create_instance";
  const client = ContaboClient.fromEnv();

  if (step === "create_instance") {
    const gatewayToken = job.payload.gatewayToken ?? randomBytes(32).toString("hex");
    const rootPassword = job.payload.rootPassword ?? generateRootPassword();
    const rootSecretName = `supportsquadai-root-${job.id.slice(0, 8)}`;
    const cloudInit = buildCloudInitScript({
      ...job.payload.request,
      tenant_id: assistant.tenantId,
      account_id: assistant.accountId,
      user_id: assistant.userId,
      support_hub_api_key: assistant.supportHubApiKey,
      gatewayToken,
    });
    try {
      const secret = await client.createSecret({
        name: rootSecretName,
        value: rootPassword,
        type: "password",
      });
      if (!secret?.secretId) {
        throw new Error("Contabo secret creation returned no secretId.");
      }
      const instance = await client.createInstance({
        productId: job.payload.request.productId,
        region: job.payload.request.region,
        period: job.payload.request.period,
        displayName: job.payload.request.displayName,
        defaultUser: job.payload.request.defaultUser,
        rootPassword: Number(secret.secretId),
        imageId: job.payload.request.imageId,
        userData: cloudInit,
      });
      if (!instance?.instanceId) {
        throw new Error("Contabo instance creation returned no instanceId.");
      }
      const updatedAssistant = {
        ...assistant,
        status: "bootstrapping",
        updatedAt: nowIso(),
        instance: {
          id: Number(instance.instanceId),
          ip: instance?.ipConfig?.v4?.ip ?? null,
          status: instance.status ?? null,
          secretId: Number(secret.secretId),
        },
        webhook: {
          ...assistant.webhook,
          endpoint: buildWebhookEndpoint(
            assistant.webhook.path,
            job.payload.request.gatewayPort,
            instance?.ipConfig?.v4?.ip,
          ),
        },
      };
      store.upsertAssistant(updatedAssistant);
      const queued = {
        ...job,
        state: "queued",
        runAfter: addSeconds(INSTANCE_POLL_SECONDS),
        updatedAt: nowIso(),
        payload: {
          ...job.payload,
          gatewayToken,
          step: "poll_instance",
          contabo: {
            instanceId: Number(instance.instanceId),
            secretId: Number(secret.secretId),
          },
        },
      };
      store.saveJob(queued);
      appendEvent(job.id, "info", "Instance created, switching to poll step", {
        instanceId: Number(instance.instanceId),
        initialStatus: instance.status ?? null,
      });
      return;
    } catch (error) {
      return retryOrFail(job, assistant, error, step);
    }
  }

  if (step === "poll_instance") {
    const instanceId = job.payload?.contabo?.instanceId;
    if (!instanceId) {
      return failJob(job, "Poll step missing contabo.instanceId");
    }
    try {
      const instance = await client.getInstance(instanceId);
      const status = instance?.status ?? "unknown";
      const ip = instance?.ipConfig?.v4?.ip ?? assistant.instance?.ip ?? null;
      const assistantUpdate = {
        ...assistant,
        updatedAt: nowIso(),
        instance: {
          ...assistant.instance,
          id: instanceId,
          ip,
          status,
        },
        webhook: {
          ...assistant.webhook,
          endpoint: buildWebhookEndpoint(
            assistant.webhook.path,
            job.payload.request.gatewayPort,
            ip,
          ),
        },
      };

      if (status === "running") {
        assistantUpdate.status = "ready";
        store.upsertAssistant(assistantUpdate);
        const completed = {
          ...job,
          state: "completed",
          updatedAt: nowIso(),
          result: {
            instanceId,
            instanceIp: ip,
            webhookEndpoint: assistantUpdate.webhook.endpoint,
          },
          error: null,
        };
        store.saveJob(completed);
        appendEvent(job.id, "info", "Provisioning completed", completed.result);
        return;
      }

      if (status === "provisioning" || status === "installing") {
        assistantUpdate.status = "bootstrapping";
        store.upsertAssistant(assistantUpdate);
        const queued = {
          ...job,
          state: "queued",
          runAfter: addSeconds(INSTANCE_POLL_SECONDS),
          updatedAt: nowIso(),
        };
        store.saveJob(queued);
        appendEvent(job.id, "info", "Instance still bootstrapping", { status });
        return;
      }

      if (status === "error") {
        assistantUpdate.status = "failed";
        store.upsertAssistant(assistantUpdate);
        return failJob(job, `Contabo returned error status for instance ${instanceId}`);
      }

      const queued = {
        ...job,
        state: "queued",
        runAfter: addSeconds(INSTANCE_POLL_SECONDS),
        updatedAt: nowIso(),
      };
      store.saveJob(queued);
      appendEvent(job.id, "warn", "Unexpected status during poll, retrying", { status });
      return;
    } catch (error) {
      return retryOrFail(job, assistant, error, step);
    }
  }

  return failJob(job, `Unsupported provision step: ${step}`);
}

async function processDeprovisionJob(job) {
  const assistant = store.getAssistant(job.assistantId);
  if (!assistant) {
    return failJob(job, `Assistant ${job.assistantId} not found`);
  }
  const instanceId = assistant.instance?.id ?? job.payload?.instanceId ?? null;
  if (!instanceId) {
    const done = {
      ...job,
      state: "completed",
      updatedAt: nowIso(),
      result: { noOp: true, reason: "assistant has no instance id" },
      error: null,
    };
    store.saveJob(done);
    appendEvent(job.id, "warn", "Deprovision no-op (no instance id)", {});
    return;
  }
  try {
    const client = ContaboClient.fromEnv();
    const cancelDate = new Date().toISOString().slice(0, 10);
    await client.cancelInstance(instanceId, cancelDate);
    const updatedAssistant = {
      ...assistant,
      status: "deprovision_requested",
      updatedAt: nowIso(),
    };
    store.upsertAssistant(updatedAssistant);
    const done = {
      ...job,
      state: "completed",
      updatedAt: nowIso(),
      result: { instanceId, cancelDate },
      error: null,
    };
    store.saveJob(done);
    appendEvent(job.id, "warn", "Deprovision requested at provider", { instanceId, cancelDate });
  } catch (error) {
    return retryOrFail(job, assistant, error, "deprovision");
  }
}

function retryOrFail(job, assistant, error, step) {
  const maxAttempts = step === "poll_instance" ? 120 : 5;
  if ((job.attempts ?? 0) < maxAttempts) {
    const queued = {
      ...job,
      state: "queued",
      runAfter: addSeconds(Math.min(60, Math.max(5, (job.attempts ?? 0) * 3))),
      updatedAt: nowIso(),
      error: error instanceof Error ? error.message : String(error),
    };
    store.saveJob(queued);
    appendEvent(job.id, "warn", "Step failed, retry scheduled", {
      step,
      attempts: queued.attempts,
      error: queued.error,
    });
    return;
  }
  if (assistant) {
    const failedAssistant = {
      ...assistant,
      status: "failed",
      updatedAt: nowIso(),
    };
    store.upsertAssistant(failedAssistant);
  }
  return failJob(job, error instanceof Error ? error.message : String(error));
}

function failJob(job, message) {
  const failed = {
    ...job,
    state: "failed",
    updatedAt: nowIso(),
    error: message,
  };
  store.saveJob(failed);
  appendEvent(job.id, "error", "Job failed", { error: message });
  return;
}

function upsertAssistantFromInput(input) {
  const assistantId = input.tenant_id;
  const existing = store.getAssistant(assistantId);
  const base = {
    assistantId,
    tenantId: input.tenant_id,
    accountId: input.account_id,
    userId: input.user_id,
    supportHubApiKey: input.support_hub_api_key,
    status: existing?.status ?? "requested",
    webhook: {
      path: "/hooks/agent",
      endpoint: existing?.webhook?.endpoint ?? null,
    },
    instance: existing?.instance ?? null,
    createdAt: existing?.createdAt ?? nowIso(),
    updatedAt: nowIso(),
    lastJobId: existing?.lastJobId ?? null,
  };
  return store.upsertAssistant(base);
}

function createProvisionJob(assistant, input) {
  const createdAt = nowIso();
  return {
    id: randomUUID(),
    assistantId: assistant.assistantId,
    idempotencyKey: input.idempotencyKey,
    type: "provision",
    state: "queued",
    runAfter: createdAt,
    attempts: 0,
    createdAt,
    updatedAt: createdAt,
    payload: {
      step: "create_instance",
      request: {
        displayName: input.displayName,
        productId: input.productId,
        region: input.region,
        period: input.period,
        imageId: input.imageId,
        defaultUser: input.defaultUser,
        gatewayMode: input.gatewayMode,
        gatewayBind: input.gatewayBind,
        gatewayPort: input.gatewayPort,
        bridgePort: input.bridgePort,
        gitRef: input.gitRef,
        repoUrl: input.repoUrl,
        modelEnv: input.modelEnv,
        extraEnv: input.extraEnv,
      },
      gatewayToken: input.gatewayToken ?? randomBytes(32).toString("hex"),
      rootPassword: input.rootPassword ?? generateRootPassword(),
    },
    result: null,
    error: null,
  };
}

function sanitizeAssistant(assistant) {
  const webhook = {
    ...assistant.webhook,
    readiness: computeWebhookReadiness(assistant),
  };
  const statusSummary = computeStatusSummary(assistant, webhook.readiness);
  return {
    assistantId: assistant.assistantId,
    tenantId: assistant.tenantId,
    accountId: assistant.accountId,
    userId: assistant.userId,
    status: assistant.status,
    statusSummary,
    webhook,
    readyForChatwoot: webhook.readiness === "ready",
    instance: assistant.instance ?? null,
    createdAt: assistant.createdAt,
    updatedAt: assistant.updatedAt,
    lastJobId: assistant.lastJobId ?? null,
  };
}

function sanitizeJob(job) {
  if (!job) {
    return null;
  }
  return {
    id: job.id,
    assistantId: job.assistantId,
    idempotencyKey: job.idempotencyKey,
    type: job.type,
    state: job.state,
    runAfter: job.runAfter,
    attempts: job.attempts ?? 0,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
    payload: {
      step: job.payload?.step,
      request: job.payload?.request
        ? {
            ...job.payload.request,
            modelEnv: Object.keys(job.payload.request.modelEnv ?? {}),
            extraEnv: Object.keys(job.payload.request.extraEnv ?? {}),
          }
        : undefined,
      contabo: job.payload?.contabo ?? null,
    },
    result: job.result ?? null,
    error: job.error ?? null,
  };
}

function appendEvent(jobId, level, message, metaJson) {
  store.appendEvent({
    id: randomUUID(),
    jobId,
    level,
    message,
    metaJson,
    createdAt: nowIso(),
  });
}

function safeSingleLineString() {
  return z
    .string()
    .min(1)
    .max(4096)
    .refine((value) => !value.includes("\n"), "Value must be single-line");
}

function envMapSchema() {
  return z
    .record(z.string(), safeSingleLineString())
    .refine(
      (obj) => Object.keys(obj).every((key) => /^[A-Z][A-Z0-9_]*$/.test(key)),
      "Environment variable keys must match ^[A-Z][A-Z0-9_]*$",
    );
}

function generateRootPassword() {
  return `Ssa!${randomBytes(8).toString("hex")}#`;
}

function buildWebhookEndpoint(path, gatewayPort, instanceIp) {
  const cleanPath = path?.startsWith("/") ? path : `/${path ?? "hooks/agent"}`;
  const explicitBase = process.env.WEBHOOK_PUBLIC_BASE_URL?.trim();
  if (explicitBase) {
    return `${explicitBase.replace(/\/$/, "")}${cleanPath}`;
  }
  if (!instanceIp) {
    return null;
  }
  return `http://${instanceIp}:${gatewayPort ?? 18789}${cleanPath}`;
}

function nowIso() {
  return new Date().toISOString();
}

function addSeconds(seconds) {
  return new Date(Date.now() + seconds * 1000).toISOString();
}

function isSqliteUniqueConstraintError(error) {
  return (
    error instanceof Error &&
    "code" in error &&
    (error.code === "SQLITE_CONSTRAINT_UNIQUE" || error.code === "SQLITE_CONSTRAINT_PRIMARYKEY")
  );
}

function computeWebhookReadiness(assistant) {
  if (!assistant?.webhook?.endpoint) {
    return "pending";
  }
  return assistant.status === "ready" ? "ready" : "pending";
}

function computeStatusSummary(assistant, webhookReadiness) {
  if (assistant.status === "failed") {
    return "failed";
  }
  if (assistant.status === "ready" && webhookReadiness === "ready") {
    return "ready";
  }
  if (assistant.status === "deprovision_requested") {
    return "deprovisioning";
  }
  const instanceStatus = assistant?.instance?.status;
  if (!assistant?.instance?.id) {
    return "provisioning";
  }
  if (!assistant?.instance?.ip) {
    return "waiting_for_ip";
  }
  if (
    instanceStatus === "provisioning" ||
    instanceStatus === "installing" ||
    assistant.status === "bootstrapping"
  ) {
    return "bootstrapping";
  }
  return "provisioning";
}
