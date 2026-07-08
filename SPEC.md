# Personal Kanban — Spec

A single-user kanban board for macOS. Real desktop app (dock icon, `.app` bundle), local data, one board. Core twist: every card has a **Send to Claude Code** button that dispatches a background Claude Code agent, with the session named after the card title — so it's trivially findable in `claude agents`, which is where all agent management lives.

## Decisions (locked)

| Decision | Choice | Why |
|---|---|---|
| Stack | Tauri v2 + React + TypeScript + Vite | Proper `.app` with dock icon; no server process; web DX for fast iteration |
| Claude integration | Background dispatch only: `claude --bg --name "<title>" "<prompt>"` | Session name = card title makes agents findable by eye in `claude agents`; no terminal orchestration needed in the app at all. Verified working 2026-07-08. |
| Agent lifecycle | **Not the board's job.** No polling, badges, or attach buttons. Columns mean what *you're* working on; agents are managed via `claude agents` (attach, logs, stop). | Keeps the board a board; avoids leaking agent state into task state |
| Claude working dir | One global setting | Single configurable project directory used by every dispatch |
| Permissions | Always Claude's defaults — no `--permission-mode` flag, no app setting | Managed natively via the working dir's own Claude settings (allowlists in `.claude/settings.json`); the board shouldn't duplicate that knob |

## Features (v1)

### Board
- One board, full-height swim lanes rendered left to right and centered. Lanes are flat and flush with thin dividers (a "whiteboard" look), each with a header row (name · count · `+`). Defaults: **Backlog**, **In Progress**, **Waiting**, **Done**.
- Columns come from stored state; no column-management UI in v1 (edit the JSON if needed — see v1.1).
- Cards show title and a **priority** badge; card background is tinted by **work type** (Review / Coding / Admin — "postit" colors), plus a small static marker if an agent has been dispatched (a breadcrumb, not a status). Click a card to open details.
- No in-app title bar; the OS window title is `personal-kanban`. Settings live behind a floating gear (top-right) or `Cmd+,`.

### Drag and drop
- Drag cards between columns and reorder within a column.
- Order is explicit (persisted array order), not sorted.
- Library: `@dnd-kit/core` + `@dnd-kit/sortable`.

### Create issue
- `+` button in each column header, plus keyboard shortcut `N` (creates in first column).
- Opens a modal: **Title** (required), **Priority** (Urgent / High / Medium / Low, default Medium), **Type** (Review / Coding / Admin, default Coding), **Description** (optional, plain-text textarea).
- `Cmd+Enter` submits, `Esc` cancels.

### Issue details
- Clicking a card opens the same modal in edit mode: title, priority, type, description, **Delete**, and **Send to Claude Code**.
- Edits save on submit; delete asks for confirmation.
- Priority is a visual attribute only — the board stays manually ordered (see Drag and drop), never auto-sorted by priority.

### Send to Claude Code (background dispatch)
- Runs, in the configured project directory (shell plugin `cwd` option), returning immediately:

  ```
  claude --bg --name "<title>" "<title>\n\n<description>"
  ```

- Parses the short agent id from stdout — observed format:

  ```
  backgrounded · 900a7040 · <name>
  ```

  If parsing fails: error toast showing the raw output. No silent fallback.
- Stores `{ id, dispatchedAt }` on the card — an informational breadcrumb, shown in the modal (e.g. "agent `900a7040` · sent 2h ago") for manual `claude attach <id>`. Dispatching again replaces it (the old agent keeps running; manage it via `claude agents`). A dismiss control clears it.
- Renaming a card later does **not** rename an already-dispatched session.
- No permission flags are passed — the agent runs with whatever the working dir's Claude settings allow. An unattended agent that hits a permission prompt simply waits until you attach from `claude agents`; if that happens too often, tune the repo's `.claude/settings.json` allowlists, not the board.
- All `claude` invocations go through `/bin/zsh -lc` (login shell) because a GUI-launched process doesn't inherit shell PATH. Title and prompt are passed as individual argv elements (`zsh -lc 'exec claude --bg --name "$1" "$2"' _ <title> <prompt>`) — never interpolated into a shell string, so quoting/injection is a non-issue.

### Settings
- Floating gear (top-right) or `Cmd+,` → modal with one field: **Project directory** — working dir for all dispatches. Prefilled with the home directory when unset. Validated to exist on save (fs plugin `exists`, scoped to the home tree — directories outside `$HOME` can't be validated, so Send stays disabled for them in v1).

### Persistence
- `tauri-plugin-store`, single file `store.json` in the app data dir (`~/Library/Application Support/<bundle-id>/`).
- Auto-save with default debounce (100ms); every mutation writes through.
- No formal migrations for v1: fields added after a `store.json` was first written (e.g. `priority`) are backfilled with a default when the board is loaded; the store is small enough to hand-edit too.

## Data model

```ts
type Priority = "urgent" | "high" | "medium" | "low";
type WorkType = "review" | "coding" | "admin";

interface BoardState {
  columns: Column[];            // ordered
  cards: Record<string, Card>;
  settings: Settings;
}

interface Column {
  id: string;
  name: string;
  cardIds: string[];            // ordered — this IS the card order
}

interface Card {
  id: string;                   // crypto.randomUUID()
  title: string;
  description: string;
  priority: Priority;           // Urgent / High / Medium / Low
  workType: WorkType;           // Review / Coding / Admin (default Coding)
  createdAt: string;            // ISO
  updatedAt: string;
  agent?: {
    id: string;                 // short id from `claude --bg`, e.g. "900a7040"
    dispatchedAt: string;       // ISO
  };                            // informational breadcrumb — NOT status
}

interface Settings {
  projectDir: string;
}
```

## Architecture

```
┌──────────────────────────── .app ─────────────────────────────┐
│  React + TS (Vite, WKWebView)                                 │
│    useBoard() — useReducer, all mutations in one place        │
│    └─ persist middleware → @tauri-apps/plugin-store           │
│    shell plugin (argv arrays, /bin/zsh -lc for PATH):         │
│      dispatch → claude --bg --name "<title>" "<prompt>"       │
│                 (cwd: projectDir)                             │
│  Rust side: stock Tauri v2, plugins only, no custom commands  │
└───────────────────────────────────────────────────────────────┘
```

- **State:** single `useReducer` in a `useBoard` hook, provided via context. No state library.
- **Styling:** one plain CSS file. Dark mode via `prefers-color-scheme`.
- **Dependencies (frontend):** `react`, `react-dom`, `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities`, `@tauri-apps/api`, `@tauri-apps/plugin-store`, `@tauri-apps/plugin-shell`, `@tauri-apps/plugin-fs`.
- **Rust:** stock Tauri v2 with the three plugins registered (`store`, `shell`, `fs`) and no custom commands. The scaffold's `opener` plugin and sample `greet` command were removed.
- **Supply chain:** `.npmrc` sets `min-release-age=7`, so npm only installs dependency versions published more than 7 days ago (a rolling window). Semver ranges can't express version age, so the policy lives in `.npmrc`; it's committed so it applies to everyone building the repo.

### Shell permission scoping

The shell plugin denies everything by default. The capability grants exactly one command shape, pinning the script string to a literal — only the trailing argv items (title / prompt) vary:

```json
{
  "identifier": "shell:allow-execute",
  "allow": [
    {
      "name": "claude-dispatch",
      "cmd": "/bin/zsh",
      "args": [
        "-lc",
        "exec claude --bg --name \"$1\" \"$2\"",
        "_",
        { "validator": "[\\s\\S]*" },
        { "validator": "[\\s\\S]*" }
      ]
    }
  ]
}
```

Confirmed against the generated schema: the fixed args (`-lc`, the script literal, `_`) must match exactly, and each `validator` regex is auto-wrapped in `^…$` (full-string match) unless `raw: true`. `[\s\S]*` matches any input including newlines without depending on inline-flag placement — the equivalent, more robust form of the original `(?s).*` intent (free text only in the trailing title/prompt arguments). This lives in its own capability file (`src-tauri/capabilities/claude-dispatch.json`); the default capability grants `core`/`store`/`fs` only (no `shell:default`).

## Non-goals (v1)

- **Agent lifecycle UI — rejected on principle, not deferred.** No status badges, polling, transcript drawers, notifications, stop buttons, or in-app attach. The board tracks your work; `claude agents` tracks agents — sessions are named after card titles precisely so that view is enough.
- Terminal integration (the earlier Ghostty designs) — obsoleted by dispatch-by-name; nothing in the app touches a terminal anymore
- Column management UI (add/rename/delete/reorder columns) — v1.1 candidate
- Per-issue working directory — v1.1 candidate
- Markdown rendering in descriptions — v1.1 candidate
- Labels, due dates, search/filter, multiple boards
- Sync, multi-user, auth — never

## Risks

| Risk | Mitigation |
|---|---|
| `claude` not on GUI PATH | Invocation via `/bin/zsh -lc` (login shell) |
| `--bg` stdout format changes across claude versions | Defensive parse; on failure, error toast with raw output (no silent fallback) |
| Unattended agents wait at permission prompts | By design — attach from `claude agents` when ready; tune the repo's own `.claude/settings.json` allowlists if it's frequent |
| Title/prompt quoting/injection into shell | Both passed as individual argv elements end to end; script string is a fixed literal |
| Shell permission too broad | Single named capability entry with pinned script literal |
| WKWebView drag quirks with dnd-kit | dnd-kit uses pointer events (not HTML5 DnD) — known to work in WKWebView; verify in M3 |
