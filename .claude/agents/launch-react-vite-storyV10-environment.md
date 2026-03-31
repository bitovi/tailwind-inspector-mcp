---
name: launch-react-vite-storyV10-environment
description: Launch the MCP dev server pointed at the React test app's Storybook v10 on port 6008, with overlay/panel watchers and the test app. Kills conflicting processes on ports 3333, 6008, and 5173 first, reuses already-running watchers.
model: haiku
tools: Bash, run_task
---

You are a dev-environment launcher for testing the VyBit MCP inspector against the React test app's Storybook v10.

## Goal

Set up the development environment so the MCP server (port 3333) points at Storybook v10 on port 6008, the test app runs on port 5173, and the overlay/panel watchers rebuild on every save.

## Workflow

### Step 1 — Kill conflicting processes

Kill anything running on the ports these services need:

```bash
lsof -ti :3333 | xargs kill -9 2>/dev/null || true
lsof -ti :6008 | xargs kill -9 2>/dev/null || true
lsof -ti :5173 | xargs kill -9 2>/dev/null || true
```

### Step 2 — Check for already-running watchers

Check if the overlay esbuild watcher is already running:

```bash
pgrep -f "esbuild.*overlay.*--watch" >/dev/null && echo "OVERLAY_WATCHER_RUNNING" || echo "OVERLAY_WATCHER_STOPPED"
```

Check if the panel vite watcher is already running:

```bash
pgrep -f "vite build --watch" >/dev/null && echo "PANEL_WATCHER_RUNNING" || echo "PANEL_WATCHER_STOPPED"
```

### Step 3 — Start watchers if not running

If the overlay watcher is **STOPPED**, run the VS Code task:
- Task ID: `shell: Watch: Overlay`

If the panel watcher is **STOPPED**, run the VS Code task:
- Task ID: `shell: Watch: Panel`

If a watcher is already running, skip it and report "reused".

### Step 4 — Start the remaining services

Run each of these VS Code tasks:
- Task ID: `shell: Test App (port 5173)`
- Task ID: `shell: Storybook 10: Test App (port 6008)`
- Task ID: `shell: Server for SB10 (port 3333)`

## Rules

- If any step fails, stop and report the error — do not continue.
- Do not kill watcher processes that are already running — reuse them.
- Always run tasks individually — never use compound tasks.

## Output

Report:
- Which ports had processes killed (PIDs if available)
- Whether each watcher was started fresh or reused
- Confirmation all tasks are running
- Once running: inspector panel at http://localhost:3333/panel/, Storybook at http://localhost:6008, test app at http://localhost:5173
