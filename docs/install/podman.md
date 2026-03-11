---
summary: "Run SupportSquadAI in a rootless Podman container"
read_when:
  - You want a containerized gateway with Podman instead of Docker
title: "Podman"
---

# Podman

Run the SupportSquadAI gateway in a **rootless** Podman container. Uses the same image as Docker (build from the repo [Dockerfile](https://github.com/supportsquadai/supportsquadai/blob/main/Dockerfile)).

## Requirements

- Podman (rootless)
- Sudo for one-time setup (create user, build image)

## Quick start

**1. One-time setup** (from repo root; creates user, builds image, installs launch script):

```bash
./setup-podman.sh
```

This also creates a minimal `~supportsquadai/.supportsquadai/supportsquadai.json` (sets `gateway.mode="local"`) so the gateway can start without running the wizard.

By default the container is **not** installed as a systemd service, you start it manually (see below). For a production-style setup with auto-start and restarts, install it as a systemd Quadlet user service instead:

```bash
./setup-podman.sh --quadlet
```

(Or set `SUPPORTSQUADAI_PODMAN_QUADLET=1`; use `--container` to install only the container and launch script.)

**2. Start gateway** (manual, for quick smoke testing):

```bash
./scripts/run-supportsquadai-podman.sh launch
```

**3. Onboarding wizard** (e.g. to add channels or providers):

```bash
./scripts/run-supportsquadai-podman.sh launch setup
```

Then open `http://127.0.0.1:18789/` and use the token from `~supportsquadai/.supportsquadai/.env` (or the value printed by setup).

## Systemd (Quadlet, optional)

If you ran `./setup-podman.sh --quadlet` (or `SUPPORTSQUADAI_PODMAN_QUADLET=1`), a [Podman Quadlet](https://docs.podman.io/en/latest/markdown/podman-systemd.unit.5.html) unit is installed so the gateway runs as a systemd user service for the supportsquadai user. The service is enabled and started at the end of setup.

- **Start:** `sudo systemctl --machine supportsquadai@ --user start supportsquadai.service`
- **Stop:** `sudo systemctl --machine supportsquadai@ --user stop supportsquadai.service`
- **Status:** `sudo systemctl --machine supportsquadai@ --user status supportsquadai.service`
- **Logs:** `sudo journalctl --machine supportsquadai@ --user -u supportsquadai.service -f`

The quadlet file lives at `~supportsquadai/.config/containers/systemd/supportsquadai.container`. To change ports or env, edit that file (or the `.env` it sources), then `sudo systemctl --machine supportsquadai@ --user daemon-reload` and restart the service. On boot, the service starts automatically if lingering is enabled for supportsquadai (setup does this when loginctl is available).

To add quadlet **after** an initial setup that did not use it, re-run: `./setup-podman.sh --quadlet`.

## The supportsquadai user (non-login)

`setup-podman.sh` creates a dedicated system user `supportsquadai`:

- **Shell:** `nologin` — no interactive login; reduces attack surface.
- **Home:** e.g. `/home/supportsquadai` — holds `~/.supportsquadai` (config, workspace) and the launch script `run-supportsquadai-podman.sh`.
- **Rootless Podman:** The user must have a **subuid** and **subgid** range. Many distros assign these automatically when the user is created. If setup prints a warning, add lines to `/etc/subuid` and `/etc/subgid`:

  ```text
  supportsquadai:100000:65536
  ```

  Then start the gateway as that user (e.g. from cron or systemd):

  ```bash
  sudo -u supportsquadai /home/supportsquadai/run-supportsquadai-podman.sh
  sudo -u supportsquadai /home/supportsquadai/run-supportsquadai-podman.sh setup
  ```

- **Config:** Only `supportsquadai` and root can access `/home/supportsquadai/.supportsquadai`. To edit config: use the Control UI once the gateway is running, or `sudo -u supportsquadai $EDITOR /home/supportsquadai/.supportsquadai/supportsquadai.json`.

## Environment and config

- **Token:** Stored in `~supportsquadai/.supportsquadai/.env` as `SUPPORTSQUADAI_GATEWAY_TOKEN`. `setup-podman.sh` and `run-supportsquadai-podman.sh` generate it if missing (uses `openssl`, `python3`, or `od`).
- **Optional:** In that `.env` you can set provider keys (e.g. `GROQ_API_KEY`, `OLLAMA_API_KEY`) and other SupportSquadAI env vars.
- **Host ports:** By default the script maps `18789` (gateway) and `18790` (bridge). Override the **host** port mapping with `SUPPORTSQUADAI_PODMAN_GATEWAY_HOST_PORT` and `SUPPORTSQUADAI_PODMAN_BRIDGE_HOST_PORT` when launching.
- **Paths:** Host config and workspace default to `~supportsquadai/.supportsquadai` and `~supportsquadai/.supportsquadai/workspace`. Override the host paths used by the launch script with `SUPPORTSQUADAI_CONFIG_DIR` and `SUPPORTSQUADAI_WORKSPACE_DIR`.

## Useful commands

- **Logs:** With quadlet: `sudo journalctl --machine supportsquadai@ --user -u supportsquadai.service -f`. With script: `sudo -u supportsquadai podman logs -f supportsquadai`
- **Stop:** With quadlet: `sudo systemctl --machine supportsquadai@ --user stop supportsquadai.service`. With script: `sudo -u supportsquadai podman stop supportsquadai`
- **Start again:** With quadlet: `sudo systemctl --machine supportsquadai@ --user start supportsquadai.service`. With script: re-run the launch script or `podman start supportsquadai`
- **Remove container:** `sudo -u supportsquadai podman rm -f supportsquadai` — config and workspace on the host are kept

## Troubleshooting

- **Permission denied (EACCES) on config or auth-profiles:** The container defaults to `--userns=keep-id` and runs as the same uid/gid as the host user running the script. Ensure your host `SUPPORTSQUADAI_CONFIG_DIR` and `SUPPORTSQUADAI_WORKSPACE_DIR` are owned by that user.
- **Gateway start blocked (missing `gateway.mode=local`):** Ensure `~supportsquadai/.supportsquadai/supportsquadai.json` exists and sets `gateway.mode="local"`. `setup-podman.sh` creates this file if missing.
- **Rootless Podman fails for user supportsquadai:** Check `/etc/subuid` and `/etc/subgid` contain a line for `supportsquadai` (e.g. `supportsquadai:100000:65536`). Add it if missing and restart.
- **Container name in use:** The launch script uses `podman run --replace`, so the existing container is replaced when you start again. To clean up manually: `podman rm -f supportsquadai`.
- **Script not found when running as supportsquadai:** Ensure `setup-podman.sh` was run so that `run-supportsquadai-podman.sh` is copied to supportsquadai’s home (e.g. `/home/supportsquadai/run-supportsquadai-podman.sh`).
- **Quadlet service not found or fails to start:** Run `sudo systemctl --machine supportsquadai@ --user daemon-reload` after editing the `.container` file. Quadlet requires cgroups v2: `podman info --format '{{.Host.CgroupsVersion}}'` should show `2`.

## Optional: run as your own user

To run the gateway as your normal user (no dedicated supportsquadai user): build the image, create `~/.supportsquadai/.env` with `SUPPORTSQUADAI_GATEWAY_TOKEN`, and run the container with `--userns=keep-id` and mounts to your `~/.supportsquadai`. The launch script is designed for the supportsquadai-user flow; for a single-user setup you can instead run the `podman run` command from the script manually, pointing config and workspace to your home. Recommended for most users: use `setup-podman.sh` and run as the supportsquadai user so config and process are isolated.
