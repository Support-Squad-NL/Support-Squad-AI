import type { SupportSquadAIConfig } from "../config/config.js";

export type ControlUiBrand = {
  name: string;
  subtitle: string;
  docsUrl: string;
  siteUrl: string;
};

export const DEFAULT_CONTROL_UI_BRAND: ControlUiBrand = {
  name: "SupportSquadAI",
  subtitle: "Gateway Dashboard",
  docsUrl: "https://docs.supportsquadai.ai",
  siteUrl: "https://supportsquadai.ai",
};

function normalizeNonEmptyString(value: string | undefined, maxLength: number): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }
  return trimmed.length <= maxLength ? trimmed : trimmed.slice(0, maxLength);
}

function normalizeDocsUrl(value: string | undefined): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }
  try {
    const parsed = new URL(trimmed);
    return parsed.toString().replace(/\/+$/, "");
  } catch {
    return undefined;
  }
}

function readEnvValue(key: string): string | undefined {
  if (typeof process === "undefined" || !process.env) {
    return undefined;
  }
  return process.env[key];
}

export function resolveBrandName(config?: SupportSquadAIConfig): string {
  return (
    normalizeNonEmptyString(config?.ui?.brand?.name, 60) ??
    normalizeNonEmptyString(readEnvValue("SUPPORTSQUADAI_BRAND_NAME"), 60) ??
    DEFAULT_CONTROL_UI_BRAND.name
  );
}

export function resolveBrandSubtitle(config?: SupportSquadAIConfig): string {
  return (
    normalizeNonEmptyString(config?.ui?.brand?.subtitle, 80) ??
    normalizeNonEmptyString(readEnvValue("SUPPORTSQUADAI_BRAND_SUBTITLE"), 80) ??
    DEFAULT_CONTROL_UI_BRAND.subtitle
  );
}

export function resolveBrandDocsUrl(config?: SupportSquadAIConfig): string {
  return (
    normalizeDocsUrl(config?.ui?.brand?.docsUrl) ??
    normalizeDocsUrl(readEnvValue("SUPPORTSQUADAI_DOCS_URL")) ??
    DEFAULT_CONTROL_UI_BRAND.docsUrl
  );
}

export function resolveBrandSiteUrl(config?: SupportSquadAIConfig): string {
  return (
    normalizeDocsUrl(config?.ui?.brand?.siteUrl) ??
    normalizeDocsUrl(readEnvValue("SUPPORTSQUADAI_SITE_URL")) ??
    DEFAULT_CONTROL_UI_BRAND.siteUrl
  );
}

export function resolveBrandDocsLink(path: string, config?: SupportSquadAIConfig): string {
  const docsUrl = resolveBrandDocsUrl(config);
  const trimmed = path.trim();
  if (!trimmed) {
    return docsUrl;
  }
  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }
  return `${docsUrl}${trimmed.startsWith("/") ? trimmed : `/${trimmed}`}`;
}

export function resolveBrandSiteLink(path: string, config?: SupportSquadAIConfig): string {
  const siteUrl = resolveBrandSiteUrl(config);
  const trimmed = path.trim();
  if (!trimmed) {
    return siteUrl;
  }
  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }
  return `${siteUrl}${trimmed.startsWith("/") ? trimmed : `/${trimmed}`}`;
}

export function resolveControlUiBrand(config?: SupportSquadAIConfig): ControlUiBrand {
  return {
    name: resolveBrandName(config),
    subtitle: resolveBrandSubtitle(config),
    docsUrl: resolveBrandDocsUrl(config),
    siteUrl: resolveBrandSiteUrl(config),
  };
}

