import { createSign } from "node:crypto";

const OAUTH_TOKEN_URL = "https://oauth2.googleapis.com/token";
const API_BASE_URL = "https://apikeys.googleapis.com/v2";
const CLOUD_PLATFORM_SCOPE = "https://www.googleapis.com/auth/cloud-platform";

const OPERATION_TIMEOUT_MS = 120000;
const OPERATION_POLL_MS = 2000;

export class GoogleApiKeysClient {
  constructor(config) {
    this.projectId = config.projectId;
    this.serviceAccountEmail = config.serviceAccountEmail;
    this.privateKey = config.privateKey;
    this.cachedAccessToken = null;
    this.tokenExpiryEpochMs = 0;
  }

  static fromEnv() {
    const fromJson = process.env.GCP_API_KEYS_SERVICE_ACCOUNT_JSON?.trim();
    const projectId = process.env.GCP_API_KEYS_PROJECT_ID?.trim();
    if (!projectId) {
      throw new Error("Missing required environment variable: GCP_API_KEYS_PROJECT_ID");
    }

    let serviceAccountEmail = process.env.GCP_API_KEYS_SERVICE_ACCOUNT_EMAIL?.trim() ?? "";
    let privateKey = process.env.GCP_API_KEYS_SERVICE_ACCOUNT_PRIVATE_KEY?.trim() ?? "";

    if (fromJson) {
      let parsed;
      try {
        parsed = JSON.parse(fromJson);
      } catch (error) {
        throw new Error(
          `Invalid GCP_API_KEYS_SERVICE_ACCOUNT_JSON (must be valid JSON): ${String(error)}`,
          { cause: error },
        );
      }
      serviceAccountEmail = String(parsed.client_email ?? serviceAccountEmail).trim();
      privateKey = String(parsed.private_key ?? privateKey).trim();
    }

    if (!serviceAccountEmail) {
      throw new Error(
        "Missing service account email. Set GCP_API_KEYS_SERVICE_ACCOUNT_EMAIL or GCP_API_KEYS_SERVICE_ACCOUNT_JSON.",
      );
    }
    if (!privateKey) {
      throw new Error(
        "Missing service account private key. Set GCP_API_KEYS_SERVICE_ACCOUNT_PRIVATE_KEY or GCP_API_KEYS_SERVICE_ACCOUNT_JSON.",
      );
    }

    return new GoogleApiKeysClient({
      projectId,
      serviceAccountEmail,
      privateKey: privateKey.replace(/\\n/g, "\n"),
    });
  }

  async createGeminiApiKey({ displayName }) {
    const operation = await this.#request(
      `/projects/${encodeURIComponent(this.projectId)}/locations/global/keys`,
      {
        method: "POST",
        body: {
          displayName,
          restrictions: {
            apiTargets: [
              { service: "generativelanguage.googleapis.com" },
              { service: "aiplatform.googleapis.com" },
            ],
          },
        },
      },
    );

    const operationName = operation?.name;
    if (!operationName) {
      throw new Error(
        `Google API Keys create response missing operation name: ${JSON.stringify(operation)}`,
      );
    }

    const done = await this.#waitForOperation(operationName);
    const keyName = done?.response?.name;
    if (!keyName) {
      throw new Error(
        `Google API Keys operation completed without key resource: ${JSON.stringify(done)}`,
      );
    }

    const keyStringResponse = await this.#request(`/${keyName}/keyString`, { method: "GET" });
    const keyString = String(keyStringResponse?.keyString ?? "").trim();
    if (!keyString) {
      throw new Error(`Google API Keys keyString response missing keyString for ${keyName}`);
    }

    return {
      name: keyName,
      keyString,
    };
  }

  async deleteApiKey(keyName) {
    if (!keyName) {
      return;
    }
    const operation = await this.#request(`/${keyName}`, { method: "DELETE" });
    const operationName = operation?.name;
    if (!operationName) {
      return;
    }
    await this.#waitForOperation(operationName);
  }

  async #waitForOperation(operationName) {
    const started = Date.now();
    while (Date.now() - started < OPERATION_TIMEOUT_MS) {
      const data = await this.#request(`/${operationName}`, { method: "GET" });
      if (data?.done === true) {
        if (data.error) {
          throw new Error(`Google API Keys operation failed: ${JSON.stringify(data.error)}`);
        }
        return data;
      }
      await sleep(OPERATION_POLL_MS);
    }
    throw new Error(
      `Google API Keys operation timed out after ${OPERATION_TIMEOUT_MS}ms: ${operationName}`,
    );
  }

  async #request(path, options) {
    const accessToken = await this.#getAccessToken();
    const headers = {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    };
    const response = await fetch(`${API_BASE_URL}${path}`, {
      method: options.method,
      headers,
      body: options.body ? JSON.stringify(options.body) : undefined,
    });
    const data = await readJson(response);
    if (!response.ok) {
      throw new Error(
        `Google API Keys ${options.method} ${path} failed (${response.status}): ${JSON.stringify(data)}`,
      );
    }
    return data;
  }

  async #getAccessToken() {
    const now = Date.now();
    if (this.cachedAccessToken && now < this.tokenExpiryEpochMs) {
      return this.cachedAccessToken;
    }
    const jwt = createServiceAccountJwt({
      serviceAccountEmail: this.serviceAccountEmail,
      privateKey: this.privateKey,
      scope: CLOUD_PLATFORM_SCOPE,
    });
    const response = await fetch(OAUTH_TOKEN_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
        assertion: jwt,
      }),
    });
    const data = await readJson(response);
    if (!response.ok || !data?.access_token) {
      throw new Error(
        `Google OAuth token request failed (${response.status}): ${JSON.stringify(data)}`,
      );
    }
    const expiresInSec = Number(data.expires_in ?? 3600);
    this.cachedAccessToken = data.access_token;
    this.tokenExpiryEpochMs = now + Math.max(60, expiresInSec - 60) * 1000;
    return this.cachedAccessToken;
  }
}

function createServiceAccountJwt({ serviceAccountEmail, privateKey, scope }) {
  const nowSec = Math.floor(Date.now() / 1000);
  const header = {
    alg: "RS256",
    typ: "JWT",
  };
  const payload = {
    iss: serviceAccountEmail,
    scope,
    aud: OAUTH_TOKEN_URL,
    iat: nowSec,
    exp: nowSec + 3600,
  };
  const encodedHeader = base64UrlJson(header);
  const encodedPayload = base64UrlJson(payload);
  const signingInput = `${encodedHeader}.${encodedPayload}`;
  const signer = createSign("RSA-SHA256");
  signer.update(signingInput);
  signer.end();
  const signature = signer.sign(privateKey).toString("base64url");
  return `${signingInput}.${signature}`;
}

function base64UrlJson(value) {
  return Buffer.from(JSON.stringify(value), "utf8").toString("base64url");
}

async function readJson(response) {
  const text = await response.text();
  if (!text) {
    return {};
  }
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
