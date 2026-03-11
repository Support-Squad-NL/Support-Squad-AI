---
summary: "Uninstall SupportSquadAI completely (CLI, service, state, workspace)"
read_when:
  - You want to remove SupportSquadAI from a machine
  - The gateway service is still running after uninstall
title: "Uninstall"
---

# Uninstall

Two paths:

- **Easy path** if `supportsquadai` is still installed.
- **Manual service removal** if the CLI is gone but the service is still running.

## Easy path (CLI still installed)

Recommended: use the built-in uninstaller:

```bash
supportsquadai uninstall
```

Non-interactive (automation / npx):

```bash
supportsquadai uninstall --all --yes --non-interactive
npx -y supportsquadai uninstall --all --yes --non-interactive
```

Manual steps (same result):

1. Stop the gateway service:

```bash
supportsquadai gateway stop
```

2. Uninstall the gateway service (launchd/systemd/schtasks):

```bash
supportsquadai gateway uninstall
```

3. Delete state + config:

```bash
rm -rf "${SUPPORTSQUADAI_STATE_DIR:-$HOME/.supportsquadai}"
```

If you set `SUPPORTSQUADAI_CONFIG_PATH` to a custom location outside the state dir, delete that file too.

4. Delete your workspace (optional, removes agent files):

```bash
rm -rf ~/.supportsquadai/workspace
```

5. Remove the CLI install (pick the one you used):

```bash
npm rm -g supportsquadai
pnpm remove -g supportsquadai
bun remove -g supportsquadai
```

6. If you installed the macOS app:

```bash
rm -rf /Applications/SupportSquadAI.app
```

Notes:

- If you used profiles (`--profile` / `SUPPORTSQUADAI_PROFILE`), repeat step 3 for each state dir (defaults are `~/.supportsquadai-<profile>`).
- In remote mode, the state dir lives on the **gateway host**, so run steps 1-4 there too.

## Manual service removal (CLI not installed)

Use this if the gateway service keeps running but `supportsquadai` is missing.

### macOS (launchd)

Default label is `bot.molt.gateway` (or `bot.molt.<profile>`; legacy `com.supportsquadai.*` may still exist):

```bash
launchctl bootout gui/$UID/bot.molt.gateway
rm -f ~/Library/LaunchAgents/bot.molt.gateway.plist
```

If you used a profile, replace the label and plist name with `bot.molt.<profile>`. Remove any legacy `com.supportsquadai.*` plists if present.

### Linux (systemd user unit)

Default unit name is `supportsquadai-gateway.service` (or `supportsquadai-gateway-<profile>.service`):

```bash
systemctl --user disable --now supportsquadai-gateway.service
rm -f ~/.config/systemd/user/supportsquadai-gateway.service
systemctl --user daemon-reload
```

### Windows (Scheduled Task)

Default task name is `SupportSquadAI Gateway` (or `SupportSquadAI Gateway (<profile>)`).
The task script lives under your state dir.

```powershell
schtasks /Delete /F /TN "SupportSquadAI Gateway"
Remove-Item -Force "$env:USERPROFILE\.supportsquadai\gateway.cmd"
```

If you used a profile, delete the matching task name and `~\.supportsquadai-<profile>\gateway.cmd`.

## Normal install vs source checkout

### Normal install (install.sh / npm / pnpm / bun)

If you used `https://supportsquadai.ai/install.sh` or `install.ps1`, the CLI was installed with `npm install -g supportsquadai@latest`.
Remove it with `npm rm -g supportsquadai` (or `pnpm remove -g` / `bun remove -g` if you installed that way).

### Source checkout (git clone)

If you run from a repo checkout (`git clone` + `supportsquadai ...` / `bun run supportsquadai ...`):

1. Uninstall the gateway service **before** deleting the repo (use the easy path above or manual service removal).
2. Delete the repo directory.
3. Remove state + workspace as shown above.
