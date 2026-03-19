import type { ChatEventPayload } from "./controllers/chat.ts";

export function shouldReloadHistoryForFinalEvent(payload?: ChatEventPayload): boolean {
  if (!payload || payload.state !== "final") {
    return false;
  }
  // If the gateway sends `final` without a message object, it's usually a
  // silent/NO_REPLY completion. In that case, forcing a history reload would
  // wipe any optimistic UI placeholder.
  if (!payload.message || typeof payload.message !== "object") {
    return false;
  }
  const message = payload.message as Record<string, unknown>;
  const role = typeof message.role === "string" ? message.role.toLowerCase() : "";
  if (role && role !== "assistant") {
    return true;
  }
  return false;
}
