import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";

export class SqliteJobStore {
  constructor(options = {}) {
    const configuredPath =
      options.dbPath ?? process.env.SQLITE_DB_PATH ?? "./data/provision-api.sqlite";
    this.dbPath = resolve(configuredPath);
    mkdirSync(dirname(this.dbPath), { recursive: true });
    this.db = new DatabaseSync(this.dbPath);
    this.db.exec("PRAGMA journal_mode = WAL;");
    this.#migrate();
    this.insertAssistantStmt = this.db.prepare(
      `INSERT INTO assistants (
        assistant_id, tenant_id, account_id, user_id, support_hub_api_key,
        status, webhook_path, webhook_endpoint, instance_id, instance_ip,
        created_at, updated_at, assistant_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    this.updateAssistantStmt = this.db.prepare(
      `UPDATE assistants
       SET tenant_id = ?, account_id = ?, user_id = ?, support_hub_api_key = ?,
           status = ?, webhook_path = ?, webhook_endpoint = ?, instance_id = ?, instance_ip = ?,
           updated_at = ?, assistant_json = ?
       WHERE assistant_id = ?`,
    );
    this.getAssistantStmt = this.db.prepare(
      "SELECT assistant_json FROM assistants WHERE assistant_id = ?",
    );
    this.getLatestAssistantByAccountIdStmt = this.db.prepare(
      "SELECT assistant_json FROM assistants WHERE account_id = ? ORDER BY updated_at DESC LIMIT 1",
    );

    this.insertJobStmt = this.db.prepare(
      `INSERT INTO provision_jobs (
        id, assistant_id, idempotency_key, type, state, run_after, attempts, created_at, updated_at, job_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    this.updateJobStmt = this.db.prepare(
      "UPDATE provision_jobs SET state = ?, run_after = ?, attempts = ?, updated_at = ?, job_json = ? WHERE id = ?",
    );
    this.getJobStmt = this.db.prepare("SELECT job_json FROM provision_jobs WHERE id = ?");
    this.getJobByKeyStmt = this.db.prepare(
      "SELECT job_json FROM provision_jobs WHERE idempotency_key = ?",
    );
    this.getLatestJobForAssistantStmt = this.db.prepare(
      "SELECT job_json FROM provision_jobs WHERE assistant_id = ? ORDER BY created_at DESC LIMIT 1",
    );
    this.selectNextRunnableJobStmt = this.db.prepare(
      "SELECT id, state, job_json FROM provision_jobs WHERE state = 'queued' AND run_after <= ? ORDER BY created_at ASC LIMIT 1",
    );
    this.updateJobIfStateStmt = this.db.prepare(
      "UPDATE provision_jobs SET state = ?, run_after = ?, attempts = ?, updated_at = ?, job_json = ? WHERE id = ? AND state = ?",
    );
    this.insertEventStmt = this.db.prepare(
      "INSERT INTO job_events (id, job_id, level, message, meta_json, created_at) VALUES (?, ?, ?, ?, ?, ?)",
    );
    this.listEventsStmt = this.db.prepare(
      "SELECT id, job_id, level, message, meta_json, created_at FROM job_events WHERE job_id = ? ORDER BY created_at ASC",
    );
  }

  getAssistant(assistantId) {
    const row = this.getAssistantStmt.get(assistantId);
    return row ? JSON.parse(row.assistant_json) : null;
  }

  getLatestAssistantByAccountId(accountId) {
    const row = this.getLatestAssistantByAccountIdStmt.get(accountId);
    return row ? JSON.parse(row.assistant_json) : null;
  }

  upsertAssistant(assistant) {
    const now = assistant.updatedAt ?? new Date().toISOString();
    const withTimes = {
      ...assistant,
      createdAt: assistant.createdAt ?? now,
      updatedAt: now,
    };
    const existing = this.getAssistant(withTimes.assistantId);
    if (!existing) {
      this.insertAssistantStmt.run(
        withTimes.assistantId,
        withTimes.tenantId,
        withTimes.accountId,
        withTimes.userId,
        withTimes.supportHubApiKey,
        withTimes.status,
        withTimes.webhook.path,
        withTimes.webhook.endpoint,
        withTimes.instance?.id ?? null,
        withTimes.instance?.ip ?? null,
        withTimes.createdAt,
        withTimes.updatedAt,
        JSON.stringify(withTimes),
      );
      return withTimes;
    }
    this.updateAssistantStmt.run(
      withTimes.tenantId,
      withTimes.accountId,
      withTimes.userId,
      withTimes.supportHubApiKey,
      withTimes.status,
      withTimes.webhook.path,
      withTimes.webhook.endpoint,
      withTimes.instance?.id ?? null,
      withTimes.instance?.ip ?? null,
      withTimes.updatedAt,
      JSON.stringify(withTimes),
      withTimes.assistantId,
    );
    return withTimes;
  }

  createJob(job) {
    this.insertJobStmt.run(
      job.id,
      job.assistantId,
      job.idempotencyKey,
      job.type,
      job.state,
      job.runAfter,
      job.attempts ?? 0,
      job.createdAt,
      job.updatedAt,
      JSON.stringify(job),
    );
    return job;
  }

  getJob(jobId) {
    const row = this.getJobStmt.get(jobId);
    return row ? JSON.parse(row.job_json) : null;
  }

  getLatestJobForAssistant(assistantId) {
    const row = this.getLatestJobForAssistantStmt.get(assistantId);
    return row ? JSON.parse(row.job_json) : null;
  }

  getJobByIdempotencyKey(idempotencyKey) {
    const row = this.getJobByKeyStmt.get(idempotencyKey);
    return row ? JSON.parse(row.job_json) : null;
  }

  saveJob(job) {
    this.updateJobStmt.run(
      job.state,
      job.runAfter,
      job.attempts ?? 0,
      job.updatedAt,
      JSON.stringify(job),
      job.id,
    );
    return job;
  }

  claimNextRunnableJob(nowIso) {
    this.db.exec("BEGIN IMMEDIATE;");
    try {
      const row = this.selectNextRunnableJobStmt.get(nowIso);
      if (!row) {
        this.db.exec("COMMIT;");
        return null;
      }
      const job = JSON.parse(row.job_json);
      const updated = {
        ...job,
        state: "running",
        attempts: (job.attempts ?? 0) + 1,
        updatedAt: new Date().toISOString(),
      };
      const result = this.updateJobIfStateStmt.run(
        updated.state,
        updated.runAfter,
        updated.attempts,
        updated.updatedAt,
        JSON.stringify(updated),
        updated.id,
        row.state,
      );
      if (Number(result.changes ?? 0) !== 1) {
        this.db.exec("ROLLBACK;");
        return null;
      }
      this.db.exec("COMMIT;");
      return updated;
    } catch (error) {
      this.db.exec("ROLLBACK;");
      throw error;
    }
  }

  appendEvent(event) {
    this.insertEventStmt.run(
      event.id,
      event.jobId,
      event.level,
      event.message,
      event.metaJson ? JSON.stringify(event.metaJson) : null,
      event.createdAt,
    );
  }

  listEvents(jobId) {
    const rows = this.listEventsStmt.all(jobId);
    return rows.map((row) => ({
      id: row.id,
      jobId: row.job_id,
      level: row.level,
      message: row.message,
      metaJson: row.meta_json ? JSON.parse(row.meta_json) : null,
      createdAt: row.created_at,
    }));
  }

  #migrate() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS assistants (
        assistant_id TEXT PRIMARY KEY,
        tenant_id TEXT NOT NULL,
        account_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        support_hub_api_key TEXT NOT NULL,
        status TEXT NOT NULL,
        webhook_path TEXT NOT NULL,
        webhook_endpoint TEXT,
        instance_id INTEGER,
        instance_ip TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        assistant_json TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS provision_jobs (
        id TEXT PRIMARY KEY,
        assistant_id TEXT NOT NULL,
        idempotency_key TEXT NOT NULL UNIQUE,
        type TEXT NOT NULL,
        state TEXT NOT NULL,
        run_after TEXT NOT NULL,
        attempts INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        job_json TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS job_events (
        id TEXT PRIMARY KEY,
        job_id TEXT NOT NULL,
        level TEXT NOT NULL,
        message TEXT NOT NULL,
        meta_json TEXT,
        created_at TEXT NOT NULL,
        FOREIGN KEY(job_id) REFERENCES provision_jobs(id)
      );

      CREATE INDEX IF NOT EXISTS idx_assistants_status ON assistants(status);
      CREATE INDEX IF NOT EXISTS idx_provision_jobs_state_run_after ON provision_jobs(state, run_after);
      CREATE INDEX IF NOT EXISTS idx_provision_jobs_assistant_id ON provision_jobs(assistant_id);
      CREATE INDEX IF NOT EXISTS idx_job_events_job_id ON job_events(job_id);
      CREATE INDEX IF NOT EXISTS idx_provision_jobs_updated_at ON provision_jobs(updated_at);
    `);
  }
}
