import { randomUUID } from "node:crypto";
import { WebSocket } from "ws";
import { buildDeviceAuthPayload } from "../src/gateway/device-auth.js";
import { PROTOCOL_VERSION } from "../src/gateway/protocol/index.js";
import {
  loadOrCreateDeviceIdentity,
  publicKeyRawBase64UrlFromPem,
  signDevicePayload,
} from "../src/infra/device-identity.js";

type ChatPayload = {
  runId: string;
  sessionKey: string;
  seq?: number;
  state: "delta" | "final" | "aborted" | "error";
  message?: unknown;
  errorMessage?: string;
};

function rawDataToUtf8(raw: WebSocket.RawData): string {
  if (typeof raw === "string") {
    return raw;
  }
  if (raw instanceof Buffer) {
    return raw.toString("utf8");
  }
  if (Array.isArray(raw)) {
    return Buffer.concat(raw).toString("utf8");
  }
  if (raw instanceof ArrayBuffer) {
    return Buffer.from(raw).toString("utf8");
  }
  return Buffer.from(raw.buffer, raw.byteOffset, raw.byteLength).toString("utf8");
}

function extractFirstAssistantText(message: unknown): string | null {
  if (!message || typeof message !== "object") {
    return null;
  }
  const m = message as Record<string, unknown>;
  const role = typeof m.role === "string" ? m.role : "";
  if (role.toLowerCase() !== "assistant") {
    return null;
  }
  const content = m.content;
  if (Array.isArray(content)) {
    for (const part of content) {
      const p = part as Record<string, unknown>;
      if (p?.type === "text" && typeof p?.text === "string" && p.text.trim()) {
        return p.text.trim();
      }
    }
    return null;
  }
  if (typeof m.text === "string" && m.text.trim()) {
    return m.text.trim();
  }
  return null;
}

async function connectAndSendOnce(params: {
  websocketUrl: string;
  token: string;
  sessionKey: string;
  message: string;
  idempotencyKey: string;
  scopes: string[];
  attemptTimeoutMs: number;
}) {
  const ws = new WebSocket(params.websocketUrl, { maxPayload: 25 * 1024 * 1024 });

  const connectNonce = await new Promise<string>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error("timeout waiting for connect.challenge")),
      params.attemptTimeoutMs,
    );
    ws.on("message", (raw) => {
      try {
        const str = rawDataToUtf8(raw);
        const obj = JSON.parse(str) as { type?: unknown; event?: unknown; payload?: unknown };
        if (obj?.type !== "event" || obj.event !== "connect.challenge") {
          return;
        }
        const payload = obj.payload as { nonce?: unknown } | undefined;
        const nonce = payload?.nonce;
        if (typeof nonce !== "string" || nonce.trim().length === 0) {
          return;
        }
        clearTimeout(timer);
        resolve(nonce.trim());
      } catch {
        // ignore parse errors
      }
    });
    ws.once("close", (code, reason) => {
      clearTimeout(timer);
      reject(
        new Error(`websocket closed during connect.challenge (${code}): ${reason.toString()}`),
      );
    });
  });

  const clientId = "gateway-client";
  const clientDisplayName = "widget";
  const clientVersion = "dev";
  const clientPlatform = "web";
  const clientMode = "backend";
  const role = "operator";

  const identity = loadOrCreateDeviceIdentity();
  const signedAtMs = Date.now();
  const deviceAuthPayload = buildDeviceAuthPayload({
    deviceId: identity.deviceId,
    clientId,
    clientMode,
    role,
    scopes: params.scopes,
    signedAtMs,
    token: params.token,
    nonce: connectNonce,
  });
  const signature = signDevicePayload(identity.privateKeyPem, deviceAuthPayload);
  const device = {
    id: identity.deviceId,
    publicKey: publicKeyRawBase64UrlFromPem(identity.publicKeyPem),
    signature,
    signedAt: signedAtMs,
    nonce: connectNonce,
  };

  const connectReqId = randomUUID();
  const connectReq = {
    type: "req",
    id: connectReqId,
    method: "connect",
    params: {
      minProtocol: PROTOCOL_VERSION,
      maxProtocol: PROTOCOL_VERSION,
      client: {
        id: clientId,
        displayName: clientDisplayName,
        version: clientVersion,
        platform: clientPlatform,
        mode: clientMode,
      },
      caps: [],
      role,
      scopes: params.scopes,
      auth: { token: params.token },
      device,
    },
  };

  ws.send(JSON.stringify(connectReq));

  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error("timeout waiting for connect res")),
      params.attemptTimeoutMs,
    );
    const onMessage = (raw: WebSocket.RawData) => {
      try {
        const obj = JSON.parse(rawDataToUtf8(raw)) as {
          type?: unknown;
          id?: unknown;
          ok?: unknown;
          error?: { message?: unknown };
        };
        if (obj?.type !== "res" || obj?.id !== connectReqId) {
          return;
        }
        clearTimeout(timer);
        ws.off("message", onMessage);
        if (obj.ok) {
          return resolve();
        }
        reject(
          new Error(typeof obj.error?.message === "string" ? obj.error.message : "connect failed"),
        );
      } catch {
        // ignore
      }
    };
    ws.on("message", onMessage);
    ws.once("close", (code, reason) => {
      clearTimeout(timer);
      reject(new Error(`websocket closed during connect (${code}): ${reason.toString()}`));
    });
  });

  const sendReqId = randomUUID();
  let resolvedRunId = params.idempotencyKey;
  ws.send(
    JSON.stringify({
      type: "req",
      id: sendReqId,
      method: "chat.send",
      params: {
        sessionKey: params.sessionKey,
        message: params.message,
        idempotencyKey: params.idempotencyKey,
      },
    }),
  );

  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error("timeout waiting for chat.send res")),
      params.attemptTimeoutMs,
    );
    const onMessage = (raw: WebSocket.RawData) => {
      try {
        const obj = JSON.parse(rawDataToUtf8(raw)) as {
          type?: unknown;
          id?: unknown;
          ok?: unknown;
          payload?: { runId?: unknown };
          error?: { message?: unknown };
        };
        if (obj?.type !== "res" || obj?.id !== sendReqId) {
          return;
        }
        clearTimeout(timer);
        ws.off("message", onMessage);
        if (obj.ok) {
          const runId = obj.payload?.runId;
          if (typeof runId === "string" && runId.trim().length > 0) {
            resolvedRunId = runId.trim();
          }
          return resolve();
        }
        reject(
          new Error(
            typeof obj.error?.message === "string" ? obj.error.message : "chat.send failed",
          ),
        );
      } catch {
        // ignore
      }
    };
    ws.on("message", onMessage);
    ws.once("close", (code, reason) => {
      clearTimeout(timer);
      reject(new Error(`websocket closed during chat.send (${code}): ${reason.toString()}`));
    });
  });

  const finalWait = new Promise<ChatPayload>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`timeout waiting for chat final (runId=${resolvedRunId})`));
    }, params.attemptTimeoutMs);
    const onMessage = (raw: WebSocket.RawData) => {
      try {
        const obj = JSON.parse(rawDataToUtf8(raw)) as {
          type?: unknown;
          event?: unknown;
          payload?: unknown;
        };
        if (obj?.type !== "event" || obj.event !== "chat") {
          return;
        }
        const payload = obj.payload as ChatPayload | undefined;
        if (!payload) {
          return;
        }
        if (payload.runId !== resolvedRunId) {
          return;
        }
        // sessionKey should match, but don't hard-filter to reduce mismatch risk.
        // if (payload.sessionKey !== params.sessionKey) return;
        if (payload.state !== "final" && payload.state !== "error" && payload.state !== "aborted") {
          return;
        }
        clearTimeout(timer);
        ws.off("message", onMessage);
        resolve(payload);
      } catch {
        // ignore
      }
    };
    ws.on("message", onMessage);
    ws.once("close", (code, reason) => {
      clearTimeout(timer);
      reject(new Error(`websocket closed during chat events (${code}): ${reason.toString()}`));
    });
  });

  const final = await finalWait;
  return {
    finalState: final.state,
    finalHadText:
      final.state === "final" ? Boolean(extractFirstAssistantText(final.message)) : false,
    finalText: final.state === "final" ? extractFirstAssistantText(final.message) : null,
    errorMessage: final.errorMessage,
  };
}

async function main() {
  const websocketUrl =
    process.env.WEBSOCKET_URL?.trim() ?? process.argv[2] ?? "wss://provision.supportsquad.ai/ws/";
  const token = process.env.WIDGET_TOKEN?.trim() ?? process.argv[3] ?? "<widget_token_required>";
  const sessionKey = process.env.SESSION_KEY?.trim() ?? process.argv[4] ?? "owner:main";
  const message = process.env.MESSAGE?.trim() ?? process.argv[5] ?? "hi";
  const maxAttempts = Number(process.env.MAX_ATTEMPTS?.trim() ?? process.argv[6] ?? "20");
  const attemptTimeoutMs = Number(
    process.env.PER_ATTEMPT_TIMEOUT_MS?.trim() ?? process.argv[7] ?? "45000",
  );
  const forceFirstIdem1 = process.env.FORCE_FIRST_IDEM1 === "1";

  if (!token || token === "<widget_token_required>") {
    console.error("Missing token. Pass env WIDGET_TOKEN or argv[3].");
    process.exit(2);
  }

  const scopes = ["operator.admin", "operator.write"];

  console.log(
    `repro-widget-raw: url=${websocketUrl} sessionKey=${sessionKey} message="${message}" token=${token.slice(0, 8)}...${token.slice(-4)} maxAttempts=${maxAttempts}`,
  );

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const idempotencyKey =
      attempt === 0 && forceFirstIdem1 ? "idem-1" : `idem-repro-${attempt}-${Date.now()}`;
    try {
      console.log(`[attempt ${attempt}] connect+chat.send idempotencyKey=${idempotencyKey}`);
      const res = await connectAndSendOnce({
        websocketUrl,
        token,
        sessionKey,
        message,
        idempotencyKey,
        scopes,
        attemptTimeoutMs,
      });
      console.log(
        `[attempt ${attempt}] finalState=${res.finalState} finalHadText=${res.finalHadText}${
          res.finalText ? ` finalText="${res.finalText.slice(0, 120)}"` : ""
        }${res.errorMessage ? ` errorMessage="${res.errorMessage}"` : ""}`,
      );

      if (res.finalState === "final" && res.finalHadText) {
        console.log(`[attempt ${attempt}] SUCCESS: received final assistant text.`);
        return;
      }
    } catch (err) {
      console.error(`[attempt ${attempt}] failed:`, err);
    }

    await new Promise((r) => setTimeout(r, 1000));
  }

  console.error(`repro-widget-raw: failed after ${maxAttempts} attempts`);
  process.exit(1);
}

await main();
