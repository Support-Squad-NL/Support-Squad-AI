import { randomUUID } from "node:crypto";

const AUTH_URL = "https://auth.contabo.com/auth/realms/contabo/protocol/openid-connect/token";
const API_BASE_URL = "https://api.contabo.com/v1";

export class ContaboClient {
  constructor(config) {
    this.clientId = config.clientId;
    this.clientSecret = config.clientSecret;
    this.apiUser = config.apiUser;
    this.apiPassword = config.apiPassword;
    this.cachedToken = null;
    this.tokenExpiryEpochMs = 0;
  }

  static fromEnv() {
    const required = [
      "CONTABO_CLIENT_ID",
      "CONTABO_CLIENT_SECRET",
      "CONTABO_API_USER",
      "CONTABO_API_PASSWORD",
    ];
    const missing = required.filter((key) => !process.env[key]);
    if (missing.length > 0) {
      throw new Error(`Missing required environment variables: ${missing.join(", ")}`);
    }
    return new ContaboClient({
      clientId: process.env.CONTABO_CLIENT_ID,
      clientSecret: process.env.CONTABO_CLIENT_SECRET,
      apiUser: process.env.CONTABO_API_USER,
      apiPassword: process.env.CONTABO_API_PASSWORD,
    });
  }

  async createSecret({ name, value, type = "password" }) {
    const body = { name, value, type };
    const response = await this.#request("/secrets", {
      method: "POST",
      body,
    });
    return response?.data?.[0];
  }

  async createInstance(payload) {
    const response = await this.#request("/compute/instances", {
      method: "POST",
      body: payload,
    });
    return response?.data?.[0];
  }

  async getInstance(instanceId) {
    const response = await this.#request(`/compute/instances/${instanceId}`, {
      method: "GET",
    });
    return response?.data?.[0];
  }

  async cancelInstance(instanceId, cancelDate) {
    const response = await this.#request(`/compute/instances/${instanceId}/cancel`, {
      method: "POST",
      body: { cancelDate },
    });
    return response?.data?.[0] ?? null;
  }

  async #request(path, options) {
    const token = await this.#getAccessToken();
    const method = options.method ?? "GET";
    const headers = {
      Authorization: `Bearer ${token}`,
      "x-request-id": randomUUID(),
    };
    if (options.body) {
      headers["Content-Type"] = "application/json";
    }
    const response = await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers,
      body: options.body ? JSON.stringify(options.body) : undefined,
    });
    const data = await readJson(response);
    if (!response.ok) {
      throw new Error(
        `Contabo API ${method} ${path} failed (${response.status}): ${JSON.stringify(data)}`,
      );
    }
    return data;
  }

  async #getAccessToken() {
    const now = Date.now();
    if (this.cachedToken && now < this.tokenExpiryEpochMs) {
      return this.cachedToken;
    }
    const body = new URLSearchParams();
    body.set("client_id", this.clientId);
    body.set("client_secret", this.clientSecret);
    body.set("username", this.apiUser);
    body.set("password", this.apiPassword);
    body.set("grant_type", "password");

    const response = await fetch(AUTH_URL, {
      method: "POST",
      body,
    });
    const data = await readJson(response);
    if (!response.ok || !data?.access_token) {
      throw new Error(`Contabo auth failed (${response.status}): ${JSON.stringify(data)}`);
    }
    const expiresInSec = Number(data.expires_in ?? 300);
    this.cachedToken = data.access_token;
    this.tokenExpiryEpochMs = Date.now() + Math.max(60, expiresInSec - 30) * 1000;
    return this.cachedToken;
  }
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
