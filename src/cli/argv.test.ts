import { describe, expect, it } from "vitest";
import {
  buildParseArgv,
  getFlagValue,
  getCommandPath,
  getPrimaryCommand,
  getPositiveIntFlagValue,
  getVerboseFlag,
  hasHelpOrVersion,
  hasFlag,
  shouldMigrateState,
  shouldMigrateStateFromPath,
} from "./argv.js";

describe("argv helpers", () => {
  it.each([
    {
      name: "help flag",
      argv: ["node", "supportsquadai", "--help"],
      expected: true,
    },
    {
      name: "version flag",
      argv: ["node", "supportsquadai", "-V"],
      expected: true,
    },
    {
      name: "normal command",
      argv: ["node", "supportsquadai", "status"],
      expected: false,
    },
    {
      name: "root -v alias",
      argv: ["node", "supportsquadai", "-v"],
      expected: true,
    },
    {
      name: "root -v alias with profile",
      argv: ["node", "supportsquadai", "--profile", "work", "-v"],
      expected: true,
    },
    {
      name: "root -v alias with log-level",
      argv: ["node", "supportsquadai", "--log-level", "debug", "-v"],
      expected: true,
    },
    {
      name: "subcommand -v should not be treated as version",
      argv: ["node", "supportsquadai", "acp", "-v"],
      expected: false,
    },
    {
      name: "root -v alias with equals profile",
      argv: ["node", "supportsquadai", "--profile=work", "-v"],
      expected: true,
    },
    {
      name: "subcommand path after global root flags should not be treated as version",
      argv: ["node", "supportsquadai", "--dev", "skills", "list", "-v"],
      expected: false,
    },
  ])("detects help/version flags: $name", ({ argv, expected }) => {
    expect(hasHelpOrVersion(argv)).toBe(expected);
  });

  it.each([
    {
      name: "single command with trailing flag",
      argv: ["node", "supportsquadai", "status", "--json"],
      expected: ["status"],
    },
    {
      name: "two-part command",
      argv: ["node", "supportsquadai", "agents", "list"],
      expected: ["agents", "list"],
    },
    {
      name: "terminator cuts parsing",
      argv: ["node", "supportsquadai", "status", "--", "ignored"],
      expected: ["status"],
    },
  ])("extracts command path: $name", ({ argv, expected }) => {
    expect(getCommandPath(argv, 2)).toEqual(expected);
  });

  it.each([
    {
      name: "returns first command token",
      argv: ["node", "supportsquadai", "agents", "list"],
      expected: "agents",
    },
    {
      name: "returns null when no command exists",
      argv: ["node", "supportsquadai"],
      expected: null,
    },
  ])("returns primary command: $name", ({ argv, expected }) => {
    expect(getPrimaryCommand(argv)).toBe(expected);
  });

  it.each([
    {
      name: "detects flag before terminator",
      argv: ["node", "supportsquadai", "status", "--json"],
      flag: "--json",
      expected: true,
    },
    {
      name: "ignores flag after terminator",
      argv: ["node", "supportsquadai", "--", "--json"],
      flag: "--json",
      expected: false,
    },
  ])("parses boolean flags: $name", ({ argv, flag, expected }) => {
    expect(hasFlag(argv, flag)).toBe(expected);
  });

  it.each([
    {
      name: "value in next token",
      argv: ["node", "supportsquadai", "status", "--timeout", "5000"],
      expected: "5000",
    },
    {
      name: "value in equals form",
      argv: ["node", "supportsquadai", "status", "--timeout=2500"],
      expected: "2500",
    },
    {
      name: "missing value",
      argv: ["node", "supportsquadai", "status", "--timeout"],
      expected: null,
    },
    {
      name: "next token is another flag",
      argv: ["node", "supportsquadai", "status", "--timeout", "--json"],
      expected: null,
    },
    {
      name: "flag appears after terminator",
      argv: ["node", "supportsquadai", "--", "--timeout=99"],
      expected: undefined,
    },
  ])("extracts flag values: $name", ({ argv, expected }) => {
    expect(getFlagValue(argv, "--timeout")).toBe(expected);
  });

  it("parses verbose flags", () => {
    expect(getVerboseFlag(["node", "supportsquadai", "status", "--verbose"])).toBe(true);
    expect(getVerboseFlag(["node", "supportsquadai", "status", "--debug"])).toBe(false);
    expect(getVerboseFlag(["node", "supportsquadai", "status", "--debug"], { includeDebug: true })).toBe(
      true,
    );
  });

  it.each([
    {
      name: "missing flag",
      argv: ["node", "supportsquadai", "status"],
      expected: undefined,
    },
    {
      name: "missing value",
      argv: ["node", "supportsquadai", "status", "--timeout"],
      expected: null,
    },
    {
      name: "valid positive integer",
      argv: ["node", "supportsquadai", "status", "--timeout", "5000"],
      expected: 5000,
    },
    {
      name: "invalid integer",
      argv: ["node", "supportsquadai", "status", "--timeout", "nope"],
      expected: undefined,
    },
  ])("parses positive integer flag values: $name", ({ argv, expected }) => {
    expect(getPositiveIntFlagValue(argv, "--timeout")).toBe(expected);
  });

  it("builds parse argv from raw args", () => {
    const cases = [
      {
        rawArgs: ["node", "supportsquadai", "status"],
        expected: ["node", "supportsquadai", "status"],
      },
      {
        rawArgs: ["node-22", "supportsquadai", "status"],
        expected: ["node-22", "supportsquadai", "status"],
      },
      {
        rawArgs: ["node-22.2.0.exe", "supportsquadai", "status"],
        expected: ["node-22.2.0.exe", "supportsquadai", "status"],
      },
      {
        rawArgs: ["node-22.2", "supportsquadai", "status"],
        expected: ["node-22.2", "supportsquadai", "status"],
      },
      {
        rawArgs: ["node-22.2.exe", "supportsquadai", "status"],
        expected: ["node-22.2.exe", "supportsquadai", "status"],
      },
      {
        rawArgs: ["/usr/bin/node-22.2.0", "supportsquadai", "status"],
        expected: ["/usr/bin/node-22.2.0", "supportsquadai", "status"],
      },
      {
        rawArgs: ["nodejs", "supportsquadai", "status"],
        expected: ["nodejs", "supportsquadai", "status"],
      },
      {
        rawArgs: ["node-dev", "supportsquadai", "status"],
        expected: ["node", "supportsquadai", "node-dev", "supportsquadai", "status"],
      },
      {
        rawArgs: ["supportsquadai", "status"],
        expected: ["node", "supportsquadai", "status"],
      },
      {
        rawArgs: ["bun", "src/entry.ts", "status"],
        expected: ["bun", "src/entry.ts", "status"],
      },
    ] as const;

    for (const testCase of cases) {
      const parsed = buildParseArgv({
        programName: "supportsquadai",
        rawArgs: [...testCase.rawArgs],
      });
      expect(parsed).toEqual([...testCase.expected]);
    }
  });

  it("builds parse argv from fallback args", () => {
    const fallbackArgv = buildParseArgv({
      programName: "supportsquadai",
      fallbackArgv: ["status"],
    });
    expect(fallbackArgv).toEqual(["node", "supportsquadai", "status"]);
  });

  it("decides when to migrate state", () => {
    const nonMutatingArgv = [
      ["node", "supportsquadai", "status"],
      ["node", "supportsquadai", "health"],
      ["node", "supportsquadai", "sessions"],
      ["node", "supportsquadai", "config", "get", "update"],
      ["node", "supportsquadai", "config", "unset", "update"],
      ["node", "supportsquadai", "models", "list"],
      ["node", "supportsquadai", "models", "status"],
      ["node", "supportsquadai", "memory", "status"],
      ["node", "supportsquadai", "agent", "--message", "hi"],
    ] as const;
    const mutatingArgv = [
      ["node", "supportsquadai", "agents", "list"],
      ["node", "supportsquadai", "message", "send"],
    ] as const;

    for (const argv of nonMutatingArgv) {
      expect(shouldMigrateState([...argv])).toBe(false);
    }
    for (const argv of mutatingArgv) {
      expect(shouldMigrateState([...argv])).toBe(true);
    }
  });

  it.each([
    { path: ["status"], expected: false },
    { path: ["config", "get"], expected: false },
    { path: ["models", "status"], expected: false },
    { path: ["agents", "list"], expected: true },
  ])("reuses command path for migrate state decisions: $path", ({ path, expected }) => {
    expect(shouldMigrateStateFromPath(path)).toBe(expected);
  });
});
