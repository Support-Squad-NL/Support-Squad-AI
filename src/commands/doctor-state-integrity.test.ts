import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SupportSquadAIConfig } from "../config/config.js";
import { resolveStorePath, resolveSessionTranscriptsDirForAgent } from "../config/sessions.js";
import { note } from "../terminal/note.js";
import { noteStateIntegrity } from "./doctor-state-integrity.js";

vi.mock("../terminal/note.js", () => ({
  note: vi.fn(),
}));

type EnvSnapshot = {
  HOME?: string;
  SUPPORTSQUADAI_HOME?: string;
  SUPPORTSQUADAI_STATE_DIR?: string;
  SUPPORTSQUADAI_OAUTH_DIR?: string;
};

function captureEnv(): EnvSnapshot {
  return {
    HOME: process.env.HOME,
    SUPPORTSQUADAI_HOME: process.env.SUPPORTSQUADAI_HOME,
    SUPPORTSQUADAI_STATE_DIR: process.env.SUPPORTSQUADAI_STATE_DIR,
    SUPPORTSQUADAI_OAUTH_DIR: process.env.SUPPORTSQUADAI_OAUTH_DIR,
  };
}

function restoreEnv(snapshot: EnvSnapshot) {
  for (const key of Object.keys(snapshot) as Array<keyof EnvSnapshot>) {
    const value = snapshot[key];
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
}

function setupSessionState(cfg: SupportSquadAIConfig, env: NodeJS.ProcessEnv, homeDir: string) {
  const agentId = "main";
  const sessionsDir = resolveSessionTranscriptsDirForAgent(agentId, env, () => homeDir);
  const storePath = resolveStorePath(cfg.session?.store, { agentId });
  fs.mkdirSync(sessionsDir, { recursive: true });
  fs.mkdirSync(path.dirname(storePath), { recursive: true });
}

function stateIntegrityText(): string {
  return vi
    .mocked(note)
    .mock.calls.filter((call) => call[1] === "State integrity")
    .map((call) => String(call[0]))
    .join("\n");
}

const OAUTH_PROMPT_MATCHER = expect.objectContaining({
  message: expect.stringContaining("Create OAuth dir at"),
});

async function runStateIntegrity(cfg: SupportSquadAIConfig) {
  setupSessionState(cfg, process.env, process.env.HOME ?? "");
  const confirmSkipInNonInteractive = vi.fn(async () => false);
  await noteStateIntegrity(cfg, { confirmSkipInNonInteractive });
  return confirmSkipInNonInteractive;
}

describe("doctor state integrity oauth dir checks", () => {
  let envSnapshot: EnvSnapshot;
  let tempHome = "";

  beforeEach(() => {
    envSnapshot = captureEnv();
    tempHome = fs.mkdtempSync(path.join(os.tmpdir(), "supportsquadai-doctor-state-integrity-"));
    process.env.HOME = tempHome;
    process.env.SUPPORTSQUADAI_HOME = tempHome;
    process.env.SUPPORTSQUADAI_STATE_DIR = path.join(tempHome, ".supportsquadai");
    delete process.env.SUPPORTSQUADAI_OAUTH_DIR;
    fs.mkdirSync(process.env.SUPPORTSQUADAI_STATE_DIR, { recursive: true, mode: 0o700 });
    vi.mocked(note).mockClear();
  });

  afterEach(() => {
    restoreEnv(envSnapshot);
    fs.rmSync(tempHome, { recursive: true, force: true });
  });

  it("does not prompt for oauth dir when no whatsapp/pairing config is active", async () => {
    const cfg: SupportSquadAIConfig = {};
    const confirmSkipInNonInteractive = await runStateIntegrity(cfg);
    expect(confirmSkipInNonInteractive).not.toHaveBeenCalledWith(OAUTH_PROMPT_MATCHER);
    const text = stateIntegrityText();
    expect(text).toContain("OAuth dir not present");
    expect(text).not.toContain("CRITICAL: OAuth dir missing");
  });

  it("prompts for oauth dir when whatsapp is configured", async () => {
    const cfg: SupportSquadAIConfig = {
      channels: {
        whatsapp: {},
      },
    };
    const confirmSkipInNonInteractive = await runStateIntegrity(cfg);
    expect(confirmSkipInNonInteractive).toHaveBeenCalledWith(OAUTH_PROMPT_MATCHER);
    expect(stateIntegrityText()).toContain("CRITICAL: OAuth dir missing");
  });

  it("prompts for oauth dir when a channel dmPolicy is pairing", async () => {
    const cfg: SupportSquadAIConfig = {
      channels: {
        telegram: {
          dmPolicy: "pairing",
        },
      },
    };
    const confirmSkipInNonInteractive = await runStateIntegrity(cfg);
    expect(confirmSkipInNonInteractive).toHaveBeenCalledWith(OAUTH_PROMPT_MATCHER);
  });

  it("prompts for oauth dir when SUPPORTSQUADAI_OAUTH_DIR is explicitly configured", async () => {
    process.env.SUPPORTSQUADAI_OAUTH_DIR = path.join(tempHome, ".oauth");
    const cfg: SupportSquadAIConfig = {};
    const confirmSkipInNonInteractive = await runStateIntegrity(cfg);
    expect(confirmSkipInNonInteractive).toHaveBeenCalledWith(OAUTH_PROMPT_MATCHER);
    expect(stateIntegrityText()).toContain("CRITICAL: OAuth dir missing");
  });
});
