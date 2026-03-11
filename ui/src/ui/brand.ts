import { DEFAULT_CONTROL_UI_BRAND } from "../../../src/gateway/control-ui-brand.js";

export { DEFAULT_CONTROL_UI_BRAND };

export function resolveDocsUrl(baseUrl: string, path = ""): string {
  const normalizedBase = (baseUrl || DEFAULT_CONTROL_UI_BRAND.docsUrl).replace(/\/+$/, "");
  if (!path) {
    return normalizedBase;
  }
  if (/^https?:\/\//i.test(path)) {
    return path;
  }
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${normalizedBase}${normalizedPath}`;
}

export function buildControlUiDocumentTitle(brandName: string): string {
  const normalized = brandName.trim() || DEFAULT_CONTROL_UI_BRAND.name;
  return `${normalized} Control`;
}

