import { describe, expect, it } from "vitest";
import type { SupportSquadAIConfig } from "../config/config.js";
import { enablePluginInConfig } from "./enable.js";

describe("enablePluginInConfig", () => {
  it("enables a plugin entry", () => {
    const cfg: SupportSquadAIConfig = {};
    const result = enablePluginInConfig(cfg, "google-gemini-cli-auth");
    expect(result.enabled).toBe(true);
    expect(result.config.plugins?.entries?.["google-gemini-cli-auth"]?.enabled).toBe(true);
  });

  it("adds plugin to allowlist when allowlist is configured", () => {
    const cfg: SupportSquadAIConfig = {
      plugins: {
        allow: ["memory-core"],
      },
    };
    const result = enablePluginInConfig(cfg, "google-gemini-cli-auth");
    expect(result.enabled).toBe(true);
    expect(result.config.plugins?.allow).toEqual(["memory-core", "google-gemini-cli-auth"]);
  });

  it("refuses enable when plugin is denylisted", () => {
    const cfg: SupportSquadAIConfig = {
      plugins: {
        deny: ["google-gemini-cli-auth"],
      },
    };
    const result = enablePluginInConfig(cfg, "google-gemini-cli-auth");
    expect(result.enabled).toBe(false);
    expect(result.reason).toBe("blocked by denylist");
  });

  it("writes built-in channels to channels.<id>.enabled instead of plugins.entries", () => {
    const cfg: SupportSquadAIConfig = {};
    const result = enablePluginInConfig(cfg, "telegram");
    expect(result.enabled).toBe(true);
    expect(result.config.channels?.telegram?.enabled).toBe(true);
    expect(result.config.plugins?.entries?.telegram).toBeUndefined();
  });

  it("adds built-in channel id to allowlist when allowlist is configured", () => {
    const cfg: SupportSquadAIConfig = {
      plugins: {
        allow: ["memory-core"],
      },
    };
    const result = enablePluginInConfig(cfg, "telegram");
    expect(result.enabled).toBe(true);
    expect(result.config.channels?.telegram?.enabled).toBe(true);
    expect(result.config.plugins?.allow).toEqual(["memory-core", "telegram"]);
  });
});
