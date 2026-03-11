---
summary: "CLI reference for `supportsquadai config` (get/set/unset config values)"
read_when:
  - You want to read or edit config non-interactively
title: "config"
---

# `supportsquadai config`

Config helpers: get/set/unset values by path. Run without a subcommand to open
the configure wizard (same as `supportsquadai configure`).

## Examples

```bash
supportsquadai config get browser.executablePath
supportsquadai config set browser.executablePath "/usr/bin/google-chrome"
supportsquadai config set agents.defaults.heartbeat.every "2h"
supportsquadai config set agents.list[0].tools.exec.node "node-id-or-name"
supportsquadai config unset tools.web.search.apiKey
```

## Paths

Paths use dot or bracket notation:

```bash
supportsquadai config get agents.defaults.workspace
supportsquadai config get agents.list[0].id
```

Use the agent list index to target a specific agent:

```bash
supportsquadai config get agents.list
supportsquadai config set agents.list[1].tools.exec.node "node-id-or-name"
```

## Values

Values are parsed as JSON5 when possible; otherwise they are treated as strings.
Use `--strict-json` to require JSON5 parsing. `--json` remains supported as a legacy alias.

```bash
supportsquadai config set agents.defaults.heartbeat.every "0m"
supportsquadai config set gateway.port 19001 --strict-json
supportsquadai config set channels.whatsapp.groups '["*"]' --strict-json
```

Restart the gateway after edits.
