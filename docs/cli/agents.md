---
summary: "CLI reference for `supportsquadai agents` (list/add/delete/set identity)"
read_when:
  - You want multiple isolated agents (workspaces + routing + auth)
title: "agents"
---

# `supportsquadai agents`

Manage isolated agents (workspaces + auth + routing).

Related:

- Multi-agent routing: [Multi-Agent Routing](/concepts/multi-agent)
- Agent workspace: [Agent workspace](/concepts/agent-workspace)

## Examples

```bash
supportsquadai agents list
supportsquadai agents add work --workspace ~/.supportsquadai/workspace-work
supportsquadai agents set-identity --workspace ~/.supportsquadai/workspace --from-identity
supportsquadai agents set-identity --agent main --avatar avatars/supportsquadai.png
supportsquadai agents delete work
```

## Identity files

Each agent workspace can include an `IDENTITY.md` at the workspace root:

- Example path: `~/.supportsquadai/workspace/IDENTITY.md`
- `set-identity --from-identity` reads from the workspace root (or an explicit `--identity-file`)

Avatar paths resolve relative to the workspace root.

## Set identity

`set-identity` writes fields into `agents.list[].identity`:

- `name`
- `theme`
- `emoji`
- `avatar` (workspace-relative path, http(s) URL, or data URI)

Load from `IDENTITY.md`:

```bash
supportsquadai agents set-identity --workspace ~/.supportsquadai/workspace --from-identity
```

Override fields explicitly:

```bash
supportsquadai agents set-identity --agent main --name "SupportSquadAI" --emoji "🦞" --avatar avatars/supportsquadai.png
```

Config sample:

```json5
{
  agents: {
    list: [
      {
        id: "main",
        identity: {
          name: "SupportSquadAI",
          theme: "space lobster",
          emoji: "🦞",
          avatar: "avatars/supportsquadai.png",
        },
      },
    ],
  },
}
```
