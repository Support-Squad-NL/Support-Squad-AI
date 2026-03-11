---
summary: "CLI reference for `supportsquadai daemon` (legacy alias for gateway service management)"
read_when:
  - You still use `supportsquadai daemon ...` in scripts
  - You need service lifecycle commands (install/start/stop/restart/status)
title: "daemon"
---

# `supportsquadai daemon`

Legacy alias for Gateway service management commands.

`supportsquadai daemon ...` maps to the same service control surface as `supportsquadai gateway ...` service commands.

## Usage

```bash
supportsquadai daemon status
supportsquadai daemon install
supportsquadai daemon start
supportsquadai daemon stop
supportsquadai daemon restart
supportsquadai daemon uninstall
```

## Subcommands

- `status`: show service install state and probe Gateway health
- `install`: install service (`launchd`/`systemd`/`schtasks`)
- `uninstall`: remove service
- `start`: start service
- `stop`: stop service
- `restart`: restart service

## Common options

- `status`: `--url`, `--token`, `--password`, `--timeout`, `--no-probe`, `--deep`, `--json`
- `install`: `--port`, `--runtime <node|bun>`, `--token`, `--force`, `--json`
- lifecycle (`uninstall|start|stop|restart`): `--json`

## Prefer

Use [`supportsquadai gateway`](/cli/gateway) for current docs and examples.
