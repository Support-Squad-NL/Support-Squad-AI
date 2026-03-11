import type { SupportSquadAIConfig } from "../config/config.js";

export function setPluginEnabledInConfig(
  config: SupportSquadAIConfig,
  pluginId: string,
  enabled: boolean,
): SupportSquadAIConfig {
  return {
    ...config,
    plugins: {
      ...config.plugins,
      entries: {
        ...config.plugins?.entries,
        [pluginId]: {
          ...(config.plugins?.entries?.[pluginId] as object | undefined),
          enabled,
        },
      },
    },
  };
}
