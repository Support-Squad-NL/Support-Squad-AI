---
summary: "CLI reference for `supportsquadai browser` (profiles, tabs, actions, extension relay)"
read_when:
  - You use `supportsquadai browser` and want examples for common tasks
  - You want to control a browser running on another machine via a node host
  - You want to use the Chrome extension relay (attach/detach via toolbar button)
title: "browser"
---

# `supportsquadai browser`

Manage SupportSquadAI’s browser control server and run browser actions (tabs, snapshots, screenshots, navigation, clicks, typing).

Related:

- Browser tool + API: [Browser tool](/tools/browser)
- Chrome extension relay: [Chrome extension](/tools/chrome-extension)

## Common flags

- `--url <gatewayWsUrl>`: Gateway WebSocket URL (defaults to config).
- `--token <token>`: Gateway token (if required).
- `--timeout <ms>`: request timeout (ms).
- `--browser-profile <name>`: choose a browser profile (default from config).
- `--json`: machine-readable output (where supported).

## Quick start (local)

```bash
supportsquadai browser --browser-profile chrome tabs
supportsquadai browser --browser-profile supportsquadai start
supportsquadai browser --browser-profile supportsquadai open https://example.com
supportsquadai browser --browser-profile supportsquadai snapshot
```

## Profiles

Profiles are named browser routing configs. In practice:

- `supportsquadai`: launches/attaches to a dedicated SupportSquadAI-managed Chrome instance (isolated user data dir).
- `chrome`: controls your existing Chrome tab(s) via the Chrome extension relay.

```bash
supportsquadai browser profiles
supportsquadai browser create-profile --name work --color "#FF5A36"
supportsquadai browser delete-profile --name work
```

Use a specific profile:

```bash
supportsquadai browser --browser-profile work tabs
```

## Tabs

```bash
supportsquadai browser tabs
supportsquadai browser open https://docs.supportsquadai.ai
supportsquadai browser focus <targetId>
supportsquadai browser close <targetId>
```

## Snapshot / screenshot / actions

Snapshot:

```bash
supportsquadai browser snapshot
```

Screenshot:

```bash
supportsquadai browser screenshot
```

Navigate/click/type (ref-based UI automation):

```bash
supportsquadai browser navigate https://example.com
supportsquadai browser click <ref>
supportsquadai browser type <ref> "hello"
```

## Chrome extension relay (attach via toolbar button)

This mode lets the agent control an existing Chrome tab that you attach manually (it does not auto-attach).

Install the unpacked extension to a stable path:

```bash
supportsquadai browser extension install
supportsquadai browser extension path
```

Then Chrome → `chrome://extensions` → enable “Developer mode” → “Load unpacked” → select the printed folder.

Full guide: [Chrome extension](/tools/chrome-extension)

## Remote browser control (node host proxy)

If the Gateway runs on a different machine than the browser, run a **node host** on the machine that has Chrome/Brave/Edge/Chromium. The Gateway will proxy browser actions to that node (no separate browser control server required).

Use `gateway.nodes.browser.mode` to control auto-routing and `gateway.nodes.browser.node` to pin a specific node if multiple are connected.

Security + remote setup: [Browser tool](/tools/browser), [Remote access](/gateway/remote), [Tailscale](/gateway/tailscale), [Security](/gateway/security)
