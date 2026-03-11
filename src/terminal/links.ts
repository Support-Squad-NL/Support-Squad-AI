import { formatTerminalLink } from "../utils.js";
import { resolveBrandDocsUrl } from "../gateway/control-ui-brand.js";

export const DOCS_ROOT = resolveBrandDocsUrl();

function remapDocsLabel(label: string | undefined, docsRoot: string): string | undefined {
  if (typeof label !== "string" || !label.trim()) {
    return undefined;
  }
  const trimmed = label.trim();
  if (!trimmed.includes("docs.supportsquadai.ai")) {
    return trimmed;
  }
  try {
    const docs = new URL(docsRoot);
    return trimmed.replaceAll("docs.supportsquadai.ai", docs.host);
  } catch {
    return trimmed;
  }
}

export function formatDocsLink(
  path: string,
  label?: string,
  opts?: { fallback?: string; force?: boolean },
): string {
  const docsRoot = resolveBrandDocsUrl();
  const trimmed = path.trim();
  const url = trimmed.startsWith("http")
    ? trimmed
    : `${docsRoot}${trimmed.startsWith("/") ? trimmed : `/${trimmed}`}`;
  return formatTerminalLink(remapDocsLabel(label, docsRoot) ?? url, url, {
    fallback: opts?.fallback ?? url,
    force: opts?.force,
  });
}

export function formatDocsRootLink(label?: string): string {
  const docsRoot = resolveBrandDocsUrl();
  return formatTerminalLink(remapDocsLabel(label, docsRoot) ?? docsRoot, docsRoot, {
    fallback: docsRoot,
  });
}
