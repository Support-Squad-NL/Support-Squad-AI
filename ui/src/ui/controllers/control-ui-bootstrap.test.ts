/* @vitest-environment jsdom */

import { describe, expect, it, vi } from "vitest";
import { CONTROL_UI_BOOTSTRAP_CONFIG_PATH } from "../../../../src/gateway/control-ui-contract.js";
import { loadControlUiBootstrapConfig } from "./control-ui-bootstrap.ts";

describe("loadControlUiBootstrapConfig", () => {
  it("loads assistant identity from the bootstrap endpoint", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        basePath: "/supportsquadai",
        brandName: "Acme AI",
        brandSubtitle: "Admin Console",
        docsUrl: "https://docs.acme.test",
        assistantName: "Ops",
        assistantAvatar: "O",
        assistantAgentId: "main",
      }),
    });
    vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);

    const state = {
      basePath: "/supportsquadai",
      brandName: "SupportSquadAI",
      brandSubtitle: "Gateway Dashboard",
      docsUrl: "https://docs.supportsquadai.ai",
      assistantName: "Assistant",
      assistantAvatar: null,
      assistantAgentId: null,
    };

    await loadControlUiBootstrapConfig(state);

    expect(fetchMock).toHaveBeenCalledWith(
      `/supportsquadai${CONTROL_UI_BOOTSTRAP_CONFIG_PATH}`,
      expect.objectContaining({ method: "GET" }),
    );
    expect(state.brandName).toBe("Acme AI");
    expect(state.brandSubtitle).toBe("Admin Console");
    expect(state.docsUrl).toBe("https://docs.acme.test");
    expect(state.assistantName).toBe("Ops");
    expect(state.assistantAvatar).toBe("O");
    expect(state.assistantAgentId).toBe("main");

    vi.unstubAllGlobals();
  });

  it("ignores failures", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false });
    vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);

    const state = {
      basePath: "",
      brandName: "SupportSquadAI",
      brandSubtitle: "Gateway Dashboard",
      docsUrl: "https://docs.supportsquadai.ai",
      assistantName: "Assistant",
      assistantAvatar: null,
      assistantAgentId: null,
    };

    await loadControlUiBootstrapConfig(state);

    expect(fetchMock).toHaveBeenCalledWith(
      CONTROL_UI_BOOTSTRAP_CONFIG_PATH,
      expect.objectContaining({ method: "GET" }),
    );
    expect(state.assistantName).toBe("Assistant");

    vi.unstubAllGlobals();
  });

  it("normalizes trailing slash basePath for bootstrap fetch path", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false });
    vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);

    const state = {
      basePath: "/supportsquadai/",
      brandName: "SupportSquadAI",
      brandSubtitle: "Gateway Dashboard",
      docsUrl: "https://docs.supportsquadai.ai",
      assistantName: "Assistant",
      assistantAvatar: null,
      assistantAgentId: null,
    };

    await loadControlUiBootstrapConfig(state);

    expect(fetchMock).toHaveBeenCalledWith(
      `/supportsquadai${CONTROL_UI_BOOTSTRAP_CONFIG_PATH}`,
      expect.objectContaining({ method: "GET" }),
    );

    vi.unstubAllGlobals();
  });
});
