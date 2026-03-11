import path from "node:path";
import { describe, expect, it } from "vitest";
import { formatCliCommand } from "./command-format.js";
import { applyCliProfileEnv, parseCliProfileArgs } from "./profile.js";

describe("parseCliProfileArgs", () => {
  it("leaves gateway --dev for subcommands", () => {
    const res = parseCliProfileArgs([
      "node",
      "supportsquadai",
      "gateway",
      "--dev",
      "--allow-unconfigured",
    ]);
    if (!res.ok) {
      throw new Error(res.error);
    }
    expect(res.profile).toBeNull();
    expect(res.argv).toEqual(["node", "supportsquadai", "gateway", "--dev", "--allow-unconfigured"]);
  });

  it("still accepts global --dev before subcommand", () => {
    const res = parseCliProfileArgs(["node", "supportsquadai", "--dev", "gateway"]);
    if (!res.ok) {
      throw new Error(res.error);
    }
    expect(res.profile).toBe("dev");
    expect(res.argv).toEqual(["node", "supportsquadai", "gateway"]);
  });

  it("parses --profile value and strips it", () => {
    const res = parseCliProfileArgs(["node", "supportsquadai", "--profile", "work", "status"]);
    if (!res.ok) {
      throw new Error(res.error);
    }
    expect(res.profile).toBe("work");
    expect(res.argv).toEqual(["node", "supportsquadai", "status"]);
  });

  it("rejects missing profile value", () => {
    const res = parseCliProfileArgs(["node", "supportsquadai", "--profile"]);
    expect(res.ok).toBe(false);
  });

  it.each([
    ["--dev first", ["node", "supportsquadai", "--dev", "--profile", "work", "status"]],
    ["--profile first", ["node", "supportsquadai", "--profile", "work", "--dev", "status"]],
  ])("rejects combining --dev with --profile (%s)", (_name, argv) => {
    const res = parseCliProfileArgs(argv);
    expect(res.ok).toBe(false);
  });
});

describe("applyCliProfileEnv", () => {
  it("fills env defaults for dev profile", () => {
    const env: Record<string, string | undefined> = {};
    applyCliProfileEnv({
      profile: "dev",
      env,
      homedir: () => "/home/peter",
    });
    const expectedStateDir = path.join(path.resolve("/home/peter"), ".supportsquadai-dev");
    expect(env.SUPPORTSQUADAI_PROFILE).toBe("dev");
    expect(env.SUPPORTSQUADAI_STATE_DIR).toBe(expectedStateDir);
    expect(env.SUPPORTSQUADAI_CONFIG_PATH).toBe(path.join(expectedStateDir, "supportsquadai.json"));
    expect(env.SUPPORTSQUADAI_GATEWAY_PORT).toBe("19001");
  });

  it("does not override explicit env values", () => {
    const env: Record<string, string | undefined> = {
      SUPPORTSQUADAI_STATE_DIR: "/custom",
      SUPPORTSQUADAI_GATEWAY_PORT: "19099",
    };
    applyCliProfileEnv({
      profile: "dev",
      env,
      homedir: () => "/home/peter",
    });
    expect(env.SUPPORTSQUADAI_STATE_DIR).toBe("/custom");
    expect(env.SUPPORTSQUADAI_GATEWAY_PORT).toBe("19099");
    expect(env.SUPPORTSQUADAI_CONFIG_PATH).toBe(path.join("/custom", "supportsquadai.json"));
  });

  it("uses SUPPORTSQUADAI_HOME when deriving profile state dir", () => {
    const env: Record<string, string | undefined> = {
      SUPPORTSQUADAI_HOME: "/srv/supportsquadai-home",
      HOME: "/home/other",
    };
    applyCliProfileEnv({
      profile: "work",
      env,
      homedir: () => "/home/fallback",
    });

    const resolvedHome = path.resolve("/srv/supportsquadai-home");
    expect(env.SUPPORTSQUADAI_STATE_DIR).toBe(path.join(resolvedHome, ".supportsquadai-work"));
    expect(env.SUPPORTSQUADAI_CONFIG_PATH).toBe(
      path.join(resolvedHome, ".supportsquadai-work", "supportsquadai.json"),
    );
  });
});

describe("formatCliCommand", () => {
  it.each([
    {
      name: "no profile is set",
      cmd: "supportsquadai doctor --fix",
      env: {},
      expected: "supportsquadai doctor --fix",
    },
    {
      name: "profile is default",
      cmd: "supportsquadai doctor --fix",
      env: { SUPPORTSQUADAI_PROFILE: "default" },
      expected: "supportsquadai doctor --fix",
    },
    {
      name: "profile is Default (case-insensitive)",
      cmd: "supportsquadai doctor --fix",
      env: { SUPPORTSQUADAI_PROFILE: "Default" },
      expected: "supportsquadai doctor --fix",
    },
    {
      name: "profile is invalid",
      cmd: "supportsquadai doctor --fix",
      env: { SUPPORTSQUADAI_PROFILE: "bad profile" },
      expected: "supportsquadai doctor --fix",
    },
    {
      name: "--profile is already present",
      cmd: "supportsquadai --profile work doctor --fix",
      env: { SUPPORTSQUADAI_PROFILE: "work" },
      expected: "supportsquadai --profile work doctor --fix",
    },
    {
      name: "--dev is already present",
      cmd: "supportsquadai --dev doctor",
      env: { SUPPORTSQUADAI_PROFILE: "dev" },
      expected: "supportsquadai --dev doctor",
    },
  ])("returns command unchanged when $name", ({ cmd, env, expected }) => {
    expect(formatCliCommand(cmd, env)).toBe(expected);
  });

  it("inserts --profile flag when profile is set", () => {
    expect(formatCliCommand("supportsquadai doctor --fix", { SUPPORTSQUADAI_PROFILE: "work" })).toBe(
      "supportsquadai --profile work doctor --fix",
    );
  });

  it("trims whitespace from profile", () => {
    expect(formatCliCommand("supportsquadai doctor --fix", { SUPPORTSQUADAI_PROFILE: "  jbsupportsquadai  " })).toBe(
      "supportsquadai --profile jbsupportsquadai doctor --fix",
    );
  });

  it("handles command with no args after supportsquadai", () => {
    expect(formatCliCommand("supportsquadai", { SUPPORTSQUADAI_PROFILE: "test" })).toBe(
      "supportsquadai --profile test",
    );
  });

  it("handles pnpm wrapper", () => {
    expect(formatCliCommand("pnpm supportsquadai doctor", { SUPPORTSQUADAI_PROFILE: "work" })).toBe(
      "pnpm supportsquadai --profile work doctor",
    );
  });
});
