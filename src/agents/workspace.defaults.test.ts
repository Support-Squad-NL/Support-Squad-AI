import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { resolveDefaultAgentWorkspaceDir } from "./workspace.js";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("DEFAULT_AGENT_WORKSPACE_DIR", () => {
  it("uses SUPPORTSQUADAI_HOME when resolving the default workspace dir", () => {
    const home = path.join(path.sep, "srv", "supportsquadai-home");
    vi.stubEnv("SUPPORTSQUADAI_HOME", home);
    vi.stubEnv("HOME", path.join(path.sep, "home", "other"));

    expect(resolveDefaultAgentWorkspaceDir()).toBe(
      path.join(path.resolve(home), ".supportsquadai", "workspace"),
    );
  });
});
