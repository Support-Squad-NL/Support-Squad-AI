import type { SupportSquadAIPluginApi } from "supportsquadai/plugin-sdk";
import { emptyPluginConfigSchema } from "supportsquadai/plugin-sdk";
import { createDiagnosticsOtelService } from "./src/service.js";

const plugin = {
  id: "diagnostics-otel",
  name: "Diagnostics OpenTelemetry",
  description: "Export diagnostics events to OpenTelemetry",
  configSchema: emptyPluginConfigSchema(),
  register(api: SupportSquadAIPluginApi) {
    api.registerService(createDiagnosticsOtelService());
  },
};

export default plugin;
