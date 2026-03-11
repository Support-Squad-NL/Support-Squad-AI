import type {
  AnyAgentTool,
  SupportSquadAIPluginApi,
  SupportSquadAIPluginToolFactory,
} from "../../src/plugins/types.js";
import { createLobsterTool } from "./src/lobster-tool.js";

export default function register(api: SupportSquadAIPluginApi) {
  api.registerTool(
    ((ctx) => {
      if (ctx.sandboxed) {
        return null;
      }
      return createLobsterTool(api) as AnyAgentTool;
    }) as SupportSquadAIPluginToolFactory,
    { optional: true },
  );
}
