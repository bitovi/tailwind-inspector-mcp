# 061 — Electron Desktop App for Designers

## Problem

VyBit today requires developers to install npm packages, run terminal commands, and configure servers. Designers — the primary audience for visual editing — can't use VyBit without developer assistance. There's no standalone experience where a designer can open a project, point at a running app, and start editing visually with an AI agent handling the implementation.

## Goals

1. **Standalone desktop app.** Designers download VyBit, open it, and start working. No terminal, no npm, no server configuration.
2. **AI agent handles setup.** The agent analyzes the project, starts the dev server, and reports back the port — the designer never touches a CLI.
3. **Embedded browser with VyBit.** The running app is displayed in a webview with browser controls (address bar, back/forward/reload). The VyBit overlay is injected automatically, and the inspector panel lives in a sidebar.
4. **Agent chat.** A chat drawer shows what the agent is doing (reading files, running commands, editing code) and accepts follow-up messages from the designer.
5. **Project intelligence.** The agent automatically loads project skills (`.claude/skills/`), memory files (`CLAUDE.md`), and connects to project-configured MCP servers.

## Non-Goals (v1)

- Multi-provider support (OpenAI, Google, etc.) — v1 is Claude-only via the Claude Agent SDK
- Storybook integration within the Electron app
- Git UI (the agent can use git via its Bash tool)
- Auto-updates, code signing, notarization (needed for distribution, not for v1)
- Custom tool approval UI (v1 uses `acceptEdits` permission mode)

---

## Key Design Decisions

### 1. Claude Agent SDK (`@anthropic-ai/claude-agent-sdk`)

The embedded AI agent uses Anthropic's Claude Agent SDK — the same TypeScript bindings that power Claude Code programmatically. This gives us:

- **Built-in tools**: Read, Write, Edit, Bash, Glob, Grep, WebSearch, WebFetch — no need to implement file system tools ourselves
- **MCP server support**: Native `mcpServers` option connects to VyBit's MCP server and any project-configured servers
- **Skills/memory auto-loading**: When `cwd` is set, the SDK automatically discovers `.claude/skills/`, `CLAUDE.md`, slash commands, etc.
- **Sessions**: Multi-turn conversations with context maintained across messages
- **Permissions**: `acceptEdits` mode auto-approves file changes; agent works autonomously while the chat UI shows what's happening
- **Bundled binary**: The SDK includes the Claude Code binary as an optional dependency — no separate CLI install required

The designer enters an Anthropic API key. The SDK authenticates directly with the API.

**Future path (v2):** Add Vercel AI SDK (`ai` + `@ai-sdk/mcp`) as an alternative agent backend for multi-provider support (OpenAI, Google, Bedrock, etc.). The Vercel AI SDK's `ToolLoopAgent` + `createMCPClient` provides a provider-agnostic agent loop, though you'd need to implement file system tools yourself or use the Claude Code / Codex CLI community providers.

### 2. Electron + Electron Forge

Standard Electron app with Electron Forge for build/packaging. Chosen over Tauri for:
- Mature ecosystem with `WebContentsView` for embedding multiple webviews
- Full control over navigation events (`did-navigate`, `did-finish-load`) needed for overlay injection
- `safeStorage` API for encrypted credential storage
- Large community / well-understood packaging pipeline

### 3. Port detection — ask the agent

When the agent starts the dev server via its Bash tool, it sees the stdout output (e.g. `"Local: http://localhost:5173/"`). Rather than parsing stdout ourselves or pre-assigning ports, we simply ask the agent to report back the URL. The agent can trace what it started and reliably extract the port regardless of framework (Vite, Next.js, Angular CLI, etc.).

### 4. Overlay injection via `executeJavaScript()`

The designer's app doesn't need to include any VyBit script tags. Electron's `webContents.executeJavaScript()` injects the overlay after each page load (`did-finish-load` event). This sets `window.__VYBIT_ENV__` with the server URL, then loads `overlay.js`.

### 5. Server spawned as child process from project cwd

The VyBit server (`server/index.ts`) must run from the user's project directory so that `tailwindcss` resolves from the project's `node_modules`. Same pattern as `test-app/mock-mcp-client.ts` — spawn as a child process with `cwd` set to the project folder.

---

## Architecture

```
┌─ Electron Main Process ─────────────────────────────────────┐
│                                                              │
│  SettingsStore      — API key (encrypted), recent projects   │
│  ServerManager      — spawns VyBit MCP server                │
│  AgentManager       — Claude Agent SDK session               │
│  ProjectDiscovery   — skills, MCP config scanning            │
│                                                              │
│  ┌─ BrowserWindow ──────────────────────────────────────┐   │
│  │  ┌─ Navigation Bar ───────────────────────────────┐  │   │
│  │  │  [← ] [→ ] [↻] [ http://localhost:5173     ▼ ] │  │   │
│  │  └────────────────────────────────────────────────┘  │   │
│  │  ┌─ Main Area (split pane) ───────────────────────┐  │   │
│  │  │  ┌─ App WebView ─────┐ ┌─ VyBit Panel ─────┐  │  │   │
│  │  │  │                   │ │  Inspector sidebar  │  │  │   │
│  │  │  │  User's app at    │ │  at :PORT/panel/    │  │  │   │
│  │  │  │  localhost:PORT   │ │                     │  │  │   │
│  │  │  │  + overlay.js     │ │                     │  │  │   │
│  │  │  └───────────────────┘ └─────────────────────┘  │  │   │
│  │  └────────────────────────────────────────────────┘  │   │
│  │  ┌─ Agent Chat Drawer (collapsible) ──────────────┐  │   │
│  │  │  Streaming output · tool calls · token usage    │  │   │
│  │  │  [Type a message...]                            │  │   │
│  │  └────────────────────────────────────────────────┘  │   │
│  └──────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────┘
```

### Data flow

```
Designer opens project
  │
  ├─→ SettingsStore: load API key + preferences
  ├─→ ServerManager: spawn VyBit server (auto-assign port)
  │     └─→ server/index.ts runs from project cwd
  │     └─→ HTTP + WebSocket + MCP endpoints ready
  │
  ├─→ ProjectDiscovery: scan for skills, MCP configs
  │     └─→ .claude/skills/, CLAUDE.md, .claude/settings.json
  │     └─→ .vscode/mcp.json, .github/skills/
  │
  └─→ AgentManager: start Claude Agent SDK session
        ├─→ cwd = project folder
        ├─→ mcpServers = { vybit: localhost:PORT/mcp, ...discovered }
        ├─→ allowedTools = [Read, Write, Edit, Bash, Glob, Grep]
        ├─→ permissionMode = "acceptEdits"
        ├─→ system prompt + project skills loaded
        │
        └─→ Agent prompt: "Analyze this project. Start the dev server.
             Report the URL and port it's running on."
              │
              ├─→ Agent reads package.json, detects framework
              ├─→ Agent runs `npm run dev` via Bash tool
              ├─→ Agent sees stdout, reports: "Running at http://localhost:5173"
              │
              └─→ Electron receives port
                    ├─→ App WebContentsView loads localhost:5173
                    ├─→ Overlay injected via executeJavaScript()
                    └─→ Panel WebContentsView loads localhost:PORT/panel/
```

### Agent ↔ VyBit MCP loop

Once the app is running, the agent enters the VyBit MCP loop — the same loop used by the mock MCP client today:

```
Agent calls implement_next_change (via MCP)
  │ (blocks, waiting for designer to commit a change)
  │
Designer clicks element → overlay sends ELEMENT_SELECTED → panel shows controls
Designer adjusts Tailwind values → panel sends PATCH_PREVIEW → overlay previews
Designer clicks "Queue Change" → patch staged
Designer clicks "Commit" → patch committed
  │
  └─→ implement_next_change returns the committed patch
        │
        Agent reads the patch instructions
        Agent edits source files (Read + Edit tools)
        Agent calls mark_change_implemented
        Agent calls implement_next_change again (loop)
```

---

## Implementation Phases

### Phase 1: Electron Shell + Setup Screen

**New files:**
```
electron/
  package.json
  forge.config.ts
  tsconfig.json
  src/
    main.ts               ← App entry, window management
    preload.ts            ← Context bridge for IPC
    managers/
      SettingsStore.ts    ← API key (safeStorage), recent projects, preferences
    renderer/
      index.html          ← Renderer entry
      SetupScreen.tsx     ← API key input + project picker + recent projects
```

**SettingsStore** uses `electron-store` with Electron's `safeStorage.encryptString()` for the API key. Persists:
- Encrypted API key
- Recent projects list (path + last opened timestamp)
- Window bounds (size/position)
- Panel sidebar width

**SetupScreen** is shown on first launch or when no project is open:
- API key input with a "Validate" button (makes a lightweight API call)
- Provider selector (Anthropic only for v1, greyed-out placeholders for OpenAI/Google)
- "Open Project" button → `dialog.showOpenDialog({ properties: ['openDirectory'] })`
- Recent projects list with "Open" and "Remove" actions

### Phase 2: Server + Agent Orchestration

**New files:**
```
electron/src/managers/
  ServerManager.ts        ← Spawn/monitor VyBit server
  AgentManager.ts         ← Claude Agent SDK session lifecycle
  ProjectDiscovery.ts     ← Scan project for skills, MCP configs
```

**ServerManager:**
- Spawns `node server/index.ts` (bundled with the Electron app) as a child process
- Sets `cwd` to the user's project folder so `tailwindcss` resolves from their `node_modules`
- Auto-finds an open port (use `portfinder` or `net.createServer()` trick)
- Monitors stdout for the "VyBit server listening on port XXXX" message
- Handles cleanup on app quit (`child.kill()`)
- Restarts on crash with exponential backoff
- Reference: `test-app/mock-mcp-client.ts` for the spawn pattern

**AgentManager:**
- Creates a Claude Agent SDK session via `query()`:
  ```ts
  import { query, ClaudeAgentOptions } from '@anthropic-ai/claude-agent-sdk';

  const options: ClaudeAgentOptions = {
    allowedTools: ['Read', 'Write', 'Edit', 'Bash', 'Glob', 'Grep'],
    permissionMode: 'acceptEdits',
    cwd: projectPath,
    mcpServers: {
      vybit: {
        command: 'node',   // or HTTP transport
        args: ['server.js'],
        // OR use HTTP transport:
        // url: `http://localhost:${serverPort}/mcp`
      },
      ...discoveredMcpServers,
    },
  };

  for await (const message of query({ prompt, options })) {
    // Stream messages to renderer via IPC
    mainWindow.webContents.send('agent:message', message);
  }
  ```
- System prompt instructs the agent to:
  1. Analyze the project (framework, package manager, scripts)
  2. Install dependencies if needed (`npm install`)
  3. Start the dev server
  4. Report the URL/port
  5. Then enter the VyBit MCP loop (`implement_next_change`)
- Exposes IPC handlers for the renderer to send follow-up messages

**ProjectDiscovery:**
- Scans the project folder for skills and MCP configuration
- The Agent SDK handles most of this automatically when `cwd` is set, but we also scan for:
  - `.vscode/mcp.json` → VS Code MCP config (not auto-loaded by Agent SDK)
  - `.github/copilot-instructions.md` → extract into system prompt context
- Merges discovered MCP servers with VyBit's server in the `mcpServers` option

**Startup flow:**
1. Designer picks a project folder (or clicks a recent project)
2. ServerManager spawns VyBit server → waits for readiness
3. ProjectDiscovery scans project → returns skills + MCP servers
4. AgentManager starts session with initial prompt
5. Agent analyzes project, runs dev server, reports port
6. AgentManager emits `agent:app-ready` event with the URL
7. Renderer transitions from SetupScreen to AppShell

### Phase 3: WebView + Navigation Chrome

**New files:**
```
electron/src/renderer/
  AppShell.tsx            ← Main layout: nav bar + split pane + chat drawer
  NavigationBar.tsx       ← Address bar + back/forward/reload
```

**Split-pane layout:**
- The main `BrowserWindow` loads a React renderer app
- The renderer communicates with the main process via IPC to control two `WebContentsView` instances:
  - **App view** (left/main): loads the user's app at the agent-reported URL
  - **Panel view** (right sidebar): loads VyBit panel at `http://localhost:PORT/panel/`
- A draggable divider between panes (CSS resize or a React splitter component)
- Panel sidebar width persisted in SettingsStore

**NavigationBar:**
- URL input: displays current URL, editable for direct navigation
- Back button: `ipcRenderer.invoke('webview:goBack')`
- Forward button: `ipcRenderer.invoke('webview:goForward')`
- Reload button: `ipcRenderer.invoke('webview:reload')`
- Main process listens to `did-navigate` / `did-navigate-in-page` on the app WebContentsView and sends updates to the renderer to keep the address bar in sync

**Overlay injection:**
- On `did-finish-load` of the app WebContentsView, the main process runs:
  ```ts
  await appView.webContents.executeJavaScript(`
    window.__VYBIT_ENV__ = {
      SERVER_ORIGIN: 'http://localhost:${serverPort}',
      WS_URL: 'ws://localhost:${serverPort}',
    };
  `);
  // Then inject the overlay bundle
  const overlayCode = fs.readFileSync(overlayPath, 'utf-8');
  await appView.webContents.executeJavaScript(overlayCode);
  ```
- Re-injects on every navigation (SPA route changes don't trigger `did-finish-load`, but full navigations do)

### Phase 4: Agent Chat UI

**New files:**
```
electron/src/renderer/
  AgentChat.tsx           ← Streaming agent output + message input
```

**AgentChat drawer:**
- Collapsible bottom panel (drag handle to resize, collapse button)
- Receives messages from main process via `ipcRenderer.on('agent:message', ...)`
- Message types displayed:
  - **AssistantMessage** (text blocks): agent's reasoning, rendered as markdown
  - **Tool use** (name + input): "Reading src/App.tsx", "Running: npm run dev"
  - **Tool result**: truncated output, expandable
  - **ResultMessage**: final "Done" status
- Status indicator: "Thinking...", "Using tool: Bash", "Waiting for change..."
- Token usage counter (input/output tokens per step, cumulative)
- Message input field at the bottom for follow-up messages
  - Sends to main process via `ipcRenderer.invoke('agent:send', message)`
  - AgentManager creates a new `query()` call with session context

### Phase 5: Project Intelligence

This is largely handled by the Agent SDK automatically, but we add:

**ProjectDiscovery enhancements:**
- Scan `.vscode/mcp.json` for VS Code-format MCP server configs and translate to Agent SDK format
- Scan `.github/copilot-instructions.md` and prepend to system prompt
- Display discovered skills/MCP servers in a "Project Info" section of the setup screen or a sidebar tooltip

---

## Package Structure

```
electron/
  package.json              ← electron, @electron-forge/cli, @anthropic-ai/claude-agent-sdk,
  │                            electron-store, react, react-dom
  forge.config.ts           ← Electron Forge build config (webpack/vite for renderer)
  tsconfig.json
  src/
    main.ts                 ← App entry point
    preload.ts              ← Context bridge (IPC API surface)
    managers/
      SettingsStore.ts      ← Encrypted settings persistence
      ServerManager.ts      ← VyBit server child process lifecycle
      AgentManager.ts       ← Claude Agent SDK session management
      ProjectDiscovery.ts   ← Skills + MCP config scanning
    renderer/
      index.html
      index.tsx             ← React root
      SetupScreen.tsx       ← API key + project picker
      AppShell.tsx          ← Split pane + nav bar + chat drawer
      NavigationBar.tsx     ← Address bar + browser controls
      AgentChat.tsx         ← Streaming agent output + input
```

### Existing files referenced

| File | Role |
|------|------|
| `server/index.ts` | VyBit server entry — spawned as child process |
| `server/mcp-tools.ts` | MCP tools the agent calls (`implement_next_change`, etc.) |
| `server/app.ts` | Express app, serves panel static files |
| `test-app/mock-mcp-client.ts` | Reference for server spawn + MCP client pattern |
| `overlay/dist/overlay.js` | Injected into app WebContentsView |
| `panel/dist/` | Served by VyBit server at `/panel/` |
| `shared/vybit-env.ts` | Shape of `window.__VYBIT_ENV__` |

---

## IPC API Surface (preload.ts)

The preload script exposes a minimal, typed API via `contextBridge`:

```ts
interface VyBitAPI {
  // Settings
  getApiKey(): Promise<string | null>;
  setApiKey(key: string): Promise<void>;
  validateApiKey(key: string): Promise<boolean>;
  getRecentProjects(): Promise<RecentProject[]>;

  // Project
  pickProjectFolder(): Promise<string | null>;
  openProject(path: string): Promise<void>;

  // Navigation
  navigate(url: string): void;
  goBack(): void;
  goForward(): void;
  reload(): void;
  onUrlChange(callback: (url: string) => void): void;

  // Agent
  sendMessage(message: string): Promise<void>;
  onAgentMessage(callback: (message: AgentMessage) => void): void;
  onAgentStatus(callback: (status: AgentStatus) => void): void;
  onAppReady(callback: (url: string) => void): void;
}
```

---

## Verification

1. **Build & launch** — `cd electron && npm start` opens the Electron app, shows the setup screen
2. **API key flow** — Enter an Anthropic API key → validated → stored encrypted → persists across restarts
3. **Project open** — Pick `test-app/` folder → VyBit server spawns on an auto-assigned port
4. **Agent starts app** — Agent detects Vite project → runs `npm run dev` → reports port in chat
5. **WebView loads** — App visible in left pane at the reported port, VyBit panel visible in right sidebar
6. **Navigation works** — Click links in the app → address bar updates → back/forward/reload buttons work
7. **Overlay active** — VyBit overlay is injected → clicking elements sends `ELEMENT_SELECTED` to panel → chips render
8. **VyBit edit loop** — Scrub a value → queue change → commit → agent implements → file updated
9. **Agent chat** — Agent output streams in the bottom drawer → user sends a follow-up message → agent responds
10. **Skills loaded** — Open a project with `.claude/skills/` → agent uses them in its responses
11. **MCP discovery** — Project with `.claude/settings.json` MCP config → additional servers connected

---

## Open Questions

### 1. Agent SDK licensing for redistribution

Anthropic's terms state: *"Unless previously approved, Anthropic does not allow third party developers to offer claude.ai login or rate limits for their products."* We use API key auth (explicitly allowed), but the SDK bundles a native Claude Code binary. Need to confirm commercial terms for redistributing that binary inside an Electron app.

### 2. Tailwind CSS resolution fallback

The VyBit server requires `tailwindcss` resolvable from the project's `node_modules`. If the project doesn't have it installed, the server will fail to start. Options:

- **(A)** The agent detects the issue and runs `npm install tailwindcss` before starting the server
- **(B)** Bundle a fallback `tailwindcss` with the Electron app, use it when the project doesn't have one
- **(C)** Start the server in "degraded mode" without Tailwind compilation (class editing still works, just no live CSS generation)

Recommend **(A)** — the agent is smart enough to handle this, and it keeps the project's `node_modules` as the source of truth.

### 3. Multi-provider strategy (v2)

The Vercel AI SDK ecosystem provides two paths for adding non-Claude providers:

- **Direct providers** (`@ai-sdk/openai`, `@ai-sdk/anthropic`, etc.) + `ToolLoopAgent` + `@ai-sdk/mcp` — you get provider-agnostic agent loops with MCP tool support, but you'd need to implement file system tools (Read, Write, Edit, Bash, Glob, Grep) yourself since the AI SDK doesn't include them
- **CLI-wrapper providers** (`ai-sdk-provider-claude-code`, `ai-sdk-provider-codex-cli`) — these wrap Claude Code or OpenAI Codex as a subprocess, getting their built-in tools for free but with less control

For v2, the most practical path is the CLI-wrapper approach: support `@anthropic-ai/claude-agent-sdk` (v1, already built), then add `ai-sdk-provider-codex-cli` for OpenAI users (wraps the Codex CLI with its own Read/Write/Bash tools). Both require the user to have the respective CLI installed or API key configured.

### 4. Dev server lifecycle

When the agent starts `npm run dev`, the process runs in a Bash shell managed by the Agent SDK. Questions:
- Does the dev server survive agent session restarts?
- If the designer closes and reopens the project, should we detect an already-running dev server?
- Should there be a "Stop Server" button, or does the agent manage the full lifecycle?

Recommend: the agent manages the lifecycle. On project close, kill all child processes. On reopen, the agent starts fresh.
