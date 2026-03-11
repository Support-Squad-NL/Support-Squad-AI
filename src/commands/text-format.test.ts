import { describe, expect, it } from "vitest";
import { shortenText } from "./text-format.js";

describe("shortenText", () => {
  it("returns original text when it fits", () => {
    expect(shortenText("supportsquadai", 16)).toBe("supportsquadai");
  });

  it("truncates and appends ellipsis when over limit", () => {
    expect(shortenText("supportsquadai-status-output", 10)).toBe("supportsquadai-…");
  });

  it("counts multi-byte characters correctly", () => {
    expect(shortenText("hello🙂world", 7)).toBe("hello🙂…");
  });
});
