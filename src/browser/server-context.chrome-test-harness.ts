import { vi } from "vitest";
import { installChromeUserDataDirHooks } from "./chrome-user-data-dir.test-harness.js";

const chromeUserDataDir = { dir: "/tmp/supportsquadai" };
installChromeUserDataDirHooks(chromeUserDataDir);

vi.mock("./chrome.js", () => ({
  isChromeCdpReady: vi.fn(async () => true),
  isChromeReachable: vi.fn(async () => true),
  launchSupportSquadAIChrome: vi.fn(async () => {
    throw new Error("unexpected launch");
  }),
  resolveSupportSquadAIUserDataDir: vi.fn(() => chromeUserDataDir.dir),
  stopSupportSquadAIChrome: vi.fn(async () => {}),
}));
