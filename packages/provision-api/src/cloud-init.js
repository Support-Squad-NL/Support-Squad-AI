function envLine(key, value) {
  return `${key}=${String(value).replace(/\n/g, "\\n")}`;
}

function toBase64(input) {
  return Buffer.from(input, "utf8").toString("base64");
}

export function buildCloudInitScript(input) {
  const assistantConfig = {
    tenant_id: input.tenant_id,
    account_id: input.account_id,
    user_id: input.user_id,
    support_hub_api_key: input.support_hub_api_key,
  };

  const envLines = [
    envLine("SUPPORTSQUADAI_CONFIG_DIR", "/opt/supportsquadai/config"),
    envLine("SUPPORTSQUADAI_WORKSPACE_DIR", "/opt/supportsquadai/workspace"),
    envLine("SUPPORTSQUADAI_GATEWAY_PORT", input.gatewayPort),
    envLine("SUPPORTSQUADAI_BRIDGE_PORT", input.bridgePort),
    envLine("SUPPORTSQUADAI_GATEWAY_BIND", input.gatewayBind),
    envLine("SUPPORTSQUADAI_GATEWAY_TOKEN", input.gatewayToken),
    envLine("SUPPORTSQUADAI_IMAGE", "supportsquadai:local"),
    envLine("SUPPORT_HUB_TENANT_ID", input.tenant_id),
    envLine("SUPPORT_HUB_ACCOUNT_ID", input.account_id),
    envLine("SUPPORT_HUB_USER_ID", input.user_id),
    envLine("SUPPORT_HUB_API_KEY", input.support_hub_api_key),
  ];

  for (const [key, value] of Object.entries(input.modelEnv)) {
    envLines.push(envLine(key, value));
  }
  for (const [key, value] of Object.entries(input.extraEnv)) {
    envLines.push(envLine(key, value));
  }

  const supportsquadaiConfig = {
    gateway: {
      mode: input.gatewayMode,
      auth: {
        mode: "token",
        token: input.gatewayToken,
      },
      controlUi: {
        // Trial VPS dashboards run on plain HTTP by default; allow shared-token auth without
        // secure-context device identity so operators can connect immediately.
        allowInsecureAuth: true,
        dangerouslyDisableDeviceAuth: true,
      },
    },
    hooks: {
      enabled: true,
      token: input.support_hub_api_key,
      path: "/hooks",
      allowedAgentIds: ["main", "hooks"],
    },
    agents: {
      defaults: {
        model: {
          primary: "google/gemini-3-pro-preview",
        },
      },
    },
    plugins: {
      enabled: true,
      entries: {
        "webshop-owner-restrictions": {
          // Default to standard assistant behavior for owner sessions.
          // Restriction profile can be re-enabled later when needed.
          enabled: true,
          config: {
            enabled: true,
            ownerSessionKeyPrefixes: ["owner:"],
          },
        },
      },
    },
  };

  const envBase64 = toBase64(`${envLines.join("\n")}\n`);
  const supportsquadaiConfigBase64 = toBase64(`${JSON.stringify(supportsquadaiConfig, null, 2)}\n`);
  const assistantConfigBase64 = toBase64(`${JSON.stringify(assistantConfig, null, 2)}\n`);

  return `#cloud-config
runcmd:
  - |
    set -eux
    export DEBIAN_FRONTEND=noninteractive
    apt-get update
    apt-get install -y ca-certificates curl gnupg git

    install -m 0755 -d /etc/apt/keyrings
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
    chmod a+r /etc/apt/keyrings/docker.asc
    ARCH=$(dpkg --print-architecture)
    CODENAME=$(. /etc/os-release && echo "$VERSION_CODENAME")
    echo "deb [arch=$ARCH signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu $CODENAME stable" > /etc/apt/sources.list.d/docker.list

    apt-get update
    apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
    apt-get install -y nginx
    systemctl enable --now docker

    if [ ! -d /opt/supportsquadai/.git ]; then
      rm -rf /opt/supportsquadai
      git clone --branch "${input.gitRef}" --depth 1 "${input.repoUrl}" /opt/supportsquadai
    else
      cd /opt/supportsquadai
      git fetch --all
      git checkout "${input.gitRef}"
      git reset --hard "origin/${input.gitRef}"
    fi
    mkdir -p /opt/supportsquadai/config /opt/supportsquadai/workspace

    printf '%s' '${envBase64}' | base64 -d > /opt/supportsquadai/.env
    printf '%s' '${supportsquadaiConfigBase64}' | base64 -d > /opt/supportsquadai/config/supportsquadai.json
    printf '%s' '${assistantConfigBase64}' | base64 -d > /opt/supportsquadai/config/assistant-config.json

    chown -R 1000:1000 /opt/supportsquadai/config /opt/supportsquadai/workspace

    cd /opt/supportsquadai
    docker build -t supportsquadai:local -f Dockerfile .
    docker compose up -d supportsquadai-gateway

    cat > /etc/nginx/sites-available/default <<'NGINX'
    server {
      listen 80 default_server;
      listen [::]:80 default_server;
      server_name _;

      location / {
        proxy_pass http://127.0.0.1:${input.gatewayPort};
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 86400;
      }
    }
    NGINX
    nginx -t
    systemctl enable --now nginx
    systemctl restart nginx
`.trimEnd();
}
