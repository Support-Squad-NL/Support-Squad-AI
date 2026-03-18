import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export async function checkRemoteBootstrap(params) {
  const host = String(params.host ?? "").trim();
  const rootPassword = String(params.rootPassword ?? "");
  const gatewayPort = Number(params.gatewayPort ?? 18789);
  if (!host || !rootPassword) {
    return { ready: false, checks: { error: "missing_host_or_password" } };
  }

  const script = `
import json
import sys
import pexpect

host = sys.argv[1]
password = sys.argv[2]
gateway_port = sys.argv[3]
prompt = r'root@[^\\\\n]*# '

result = {
  "ready": False,
  "checks": {},
}

def run_command(child, cmd):
  child.sendline(cmd)
  child.expect(prompt)
  lines = child.before.splitlines()
  body = "\\n".join(lines[1:]).strip()
  return body

try:
  child = pexpect.spawn(
    f"ssh -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null root@{host}",
    encoding="utf-8",
    timeout=60,
  )
  child.expect('password:')
  child.sendline(password)
  child.expect(prompt)

  cloud_init = run_command(child, "cloud-init status --long || true")
  docker_state = run_command(child, "systemctl is-active docker || true")
  nginx_state = run_command(child, "systemctl is-active nginx || true")
  gateway_http = run_command(child, f"curl -s -o /dev/null -w '%{{http_code}}' http://127.0.0.1:{gateway_port}/ ; echo")
  dashboard_http = run_command(child, "curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1/ ; echo")

  child.sendline("exit")
  child.expect(pexpect.EOF)

  result["checks"] = {
    "cloudInit": cloud_init,
    "docker": docker_state,
    "nginx": nginx_state,
    "gatewayHttp": gateway_http,
    "dashboardHttp": dashboard_http,
  }
  gateway_ok = gateway_http.strip().startswith("200")
  dashboard_ok = dashboard_http.strip().startswith("200")
  docker_ok = "active" in docker_state
  nginx_ok = "active" in nginx_state
  result["ready"] = gateway_ok and dashboard_ok and docker_ok and nginx_ok
except Exception as exc:
  result["checks"] = {"error": str(exc)}

print(json.dumps(result))
`;

  try {
    const { stdout } = await execFileAsync(
      "python3",
      ["-c", script, host, rootPassword, String(gatewayPort)],
      {
        timeout: 90000,
        maxBuffer: 1024 * 1024,
      },
    );
    const parsed = parseJsonObject(stdout);
    if (!parsed || typeof parsed !== "object") {
      return { ready: false, checks: { error: "invalid_python_output" } };
    }
    const checks = parsed.checks && typeof parsed.checks === "object" ? parsed.checks : {};
    const gatewayCode = extractHttpCode(checks.gatewayHttp);
    const dashboardCode = extractHttpCode(checks.dashboardHttp);
    const dockerActive = /\bactive\b/i.test(String(checks.docker ?? ""));
    const nginxActive = /\bactive\b/i.test(String(checks.nginx ?? ""));
    const ready = gatewayCode === 200 && dashboardCode === 200 && dockerActive && nginxActive;
    return {
      ready,
      checks,
    };
  } catch (error) {
    return {
      ready: false,
      checks: {
        error: error instanceof Error ? error.message : String(error),
      },
    };
  }
}

function parseJsonObject(raw) {
  const trimmed = String(raw ?? "").trim();
  if (!trimmed) {
    return null;
  }
  const first = trimmed.indexOf("{");
  const last = trimmed.lastIndexOf("}");
  if (first < 0 || last < first) {
    return null;
  }
  const candidate = trimmed.slice(first, last + 1);
  try {
    return JSON.parse(candidate);
  } catch {
    return null;
  }
}

function extractHttpCode(value) {
  const text = String(value ?? "");
  const matches = text.match(/\b(\d{3})\b/g);
  if (!matches || matches.length === 0) {
    return null;
  }
  const last = matches[matches.length - 1];
  const num = Number(last);
  return Number.isFinite(num) ? num : null;
}
