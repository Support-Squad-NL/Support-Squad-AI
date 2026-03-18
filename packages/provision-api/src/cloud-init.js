function envLine(key, value) {
  return `${key}=${String(value).replace(/\n/g, "\\n")}`;
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
    },
    hooks: {
      enabled: true,
      token: input.support_hub_api_key,
      path: "/hooks",
      allowedAgentIds: ["main", "hooks"],
    },
  };

  return `#cloud-config
runcmd:
  - |
    set -euxo pipefail
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
    systemctl enable --now docker

    mkdir -p /opt/supportsquadai/config /opt/supportsquadai/workspace
    if [ ! -d /opt/supportsquadai/.git ]; then
      git clone --branch "${input.gitRef}" --depth 1 "${input.repoUrl}" /opt/supportsquadai
    else
      cd /opt/supportsquadai
      git fetch --all
      git checkout "${input.gitRef}"
      git reset --hard "origin/${input.gitRef}"
    fi

    cat > /opt/supportsquadai/.env <<'ENV'
${envLines.join("\n")}
ENV

    cat > /opt/supportsquadai/config/supportsquadai.json <<'JSON'
${JSON.stringify(supportsquadaiConfig, null, 2)}
JSON

    cat > /opt/supportsquadai/config/assistant-config.json <<'JSON'
${JSON.stringify(assistantConfig, null, 2)}
JSON

    chown -R 1000:1000 /opt/supportsquadai/config /opt/supportsquadai/workspace

    cd /opt/supportsquadai
    docker build -t supportsquadai:local -f Dockerfile .
    docker compose up -d supportsquadai-gateway
`;
}
