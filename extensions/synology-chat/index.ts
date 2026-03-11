import type { SupportSquadAIPluginApi } from "supportsquadai/plugin-sdk";
import { emptyPluginConfigSchema } from "supportsquadai/plugin-sdk";
import { createSynologyChatPlugin } from "./src/channel.js";
import { setSynologyRuntime } from "./src/runtime.js";

const plugin = {
  id: "synology-chat",
  name: "Synology Chat",
  description: "Native Synology Chat channel plugin for SupportSquadAI",
  configSchema: emptyPluginConfigSchema(),
  register(api: SupportSquadAIPluginApi) {
    setSynologyRuntime(api.runtime);
    api.registerChannel({ plugin: createSynologyChatPlugin() });
  },
};

export default plugin;
