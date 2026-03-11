import { describe, expect, it } from "vitest";
import { resolveIrcInboundTarget } from "./monitor.js";

describe("irc monitor inbound target", () => {
  it("keeps channel target for group messages", () => {
    expect(
      resolveIrcInboundTarget({
        target: "#supportsquadai",
        senderNick: "alice",
      }),
    ).toEqual({
      isGroup: true,
      target: "#supportsquadai",
      rawTarget: "#supportsquadai",
    });
  });

  it("maps DM target to sender nick and preserves raw target", () => {
    expect(
      resolveIrcInboundTarget({
        target: "supportsquadai-bot",
        senderNick: "alice",
      }),
    ).toEqual({
      isGroup: false,
      target: "alice",
      rawTarget: "supportsquadai-bot",
    });
  });

  it("falls back to raw target when sender nick is empty", () => {
    expect(
      resolveIrcInboundTarget({
        target: "supportsquadai-bot",
        senderNick: " ",
      }),
    ).toEqual({
      isGroup: false,
      target: "supportsquadai-bot",
      rawTarget: "supportsquadai-bot",
    });
  });
});
