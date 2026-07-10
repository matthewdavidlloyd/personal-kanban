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
| GitHub import | Read-only via the `gh` CLI (one pinned command, JSON out); user runs `gh auth login` themselves | Sidesteps OAuth/token storage; reuses the same pinned-shell capability pattern as `claude-dispatch`; one-shot import, no sync |

## Features (v1)

### Board
- One board, full-height **columns** rendered left to right and centered. Columns are flat and flush with thin dividers (a "whiteboard" look), each with a header row (name · total count · `+`). Defaults: **Backlog**, **In Progress**, **Waiting**, **Done**.
- Each column is split horizontally into three **swimlanes** by work type, top to bottom — **Coding**, **Review**, **Admin** — with a label rail on the left of the board. A card lives in exactly one cell (column × swimlane). Order is per cell. The **Coding** lane is given a height bias (≈½ the board height; Review and Admin ≈¼ each) since it's where most cards live. Each cell shows its own issue count in the corner, on top of the per-column total in the header.
- Columns come from stored state; no column-management UI in v1 (edit the JSON if needed — see v1.1). Swimlanes are fixed (the three work types, in a fixed order) — no add/remove/rename/reorder.
- Cards show title, an optional **note** (short freeform status line), and a **priority** badge. Cards are visually uniform — the swimlane a card lives in is its work-type signal, so there's no per-card tint. Small static markers appear if an agent has been dispatched and if the card has linked PRs (breadcrumbs, not status). Click a card to open details.
- Swimlane rails on the left use the "postit" colors (Coding = teal, Review = rose, Admin = amber) as the categorization signal for the eye.
- No in-app title bar; the OS window title is `personal-kanban`. Settings live behind a floating gear (top-right) or `Cmd+,`.

### Drag and drop
- Drag cards between cells (column × swimlane) and reorder within a cell. A card's swimlane *is* its work type — there's no separate stored `workType` field, so moving a card to another swimlane changes its work type by definition.
- Order is explicit (persisted array order, per cell), not sorted.
- Library: `@dnd-kit/core` + `@dnd-kit/sortable`.

### Create issue
- `+` button in each column header, plus keyboard shortcut `N` (creates in first column).
- Opens a modal: **Title** (required), **Note** (optional short status line), **Priority** (Urgent / High / Medium / Low, default Medium), **Type** (Coding / Review / Admin, default Coding), **Description** (optional, plain-text textarea).
- `Cmd+Enter` submits, `Esc` cancels.

### Import from GitHub issue
- New Card modal has a compact **Import from GitHub** row above Title: paste a full issue URL (`https://github.com/owner/repo/issues/123`) or the shorthand `owner/repo#123`, click **Import**.
- Runs `gh issue view <number> --repo <owner/repo> --json title,body,number,url` (read-only), prefills **Title** with the issue title and **Description** with the issue body, and stashes `{ number, url }` on the card as a breadcrumb — shown in the Issue details modal (e.g. `issue #123 · github.com/owner/repo/issues/123`, click-to-open in the browser). Priority/Type/Note stay at their defaults for the user to adjust before saving.
- Only these two input shapes are accepted — no default repo setting in v1, no bare `#123`. Anything else is a parse error surfaced inline in the modal.
- Read-only by design: never writes back to GitHub, no polling, no re-sync. Editing the imported card locally does not touch the issue; closing/editing the issue does not touch the card.
- Prereq: `gh` installed and `gh auth login` already run in the user's shell. Auth failure or missing `gh` surfaces as an error toast pointing to `gh auth login`; the app doesn't manage tokens.
- Same shell hygiene as dispatch: invoked via `/bin/zsh -lc` for GUI PATH, script string pinned to a literal in a second capability file, number and repo passed as individual argv elements (never interpolated).

### Issue details
- Clicking a card opens the same modal in edit mode: title, note, priority, type, description, a **Pull requests** list (0..n links, add/remove — see below), **Delete**, and one or more Claude dispatch buttons (see [Dispatch](#dispatch-to-claude-code-background)).
- Edits save on submit; delete asks for confirmation.
- Priority is a visual attribute only — the board stays manually ordered (see Drag and drop), never auto-sorted by priority.
- Changing the type moves the card to the **end of the target swimlane** in the same column. Reorder afterwards by dragging.

### Link pull requests
- Below the note/type fields in edit mode, a **Pull requests** row: text input + **Link** button. Paste a full PR URL (`https://github.com/owner/repo/pull/123`) or the shorthand `owner/repo#123`.
- A card may link **multiple PRs** — persisted as an ordered list `pullRequests: PullRequest[]` on the card. Each renders as a breadcrumb (`PR #123 · owner/repo`, click-to-open in the browser, `×` to remove) and carries its own per-PR **Fix**/**Review** dispatch actions (see [Dispatch](#dispatch-to-claude-code-background)).
- Parse only — no `gh pr view` in v1. Anything that doesn't match the two accepted shapes is an inline parse error (same UX as the GitHub issue import row).
- Read-only breadcrumbs — the app never writes back to GitHub, never polls, never re-syncs. Editing a linked PR on GitHub does nothing to the card.

### Dispatch to Claude Code (background)

All dispatch is `claude --bg` with the same argv shape — only the **prompt** varies by mode. "Work type" below means the card's swimlane. The modal shows a subset of actions per card:

| Mode | Prompt | Shown when |
|---|---|---|
| **Send** | `<title>\n\n<description>` (title-only if description empty) | work type ≠ Review |
| **Fix PR** (one) | `Fix PR:\n<url>\n\n<title>\n\n<description>` | work type ≠ Review — per PR, on each PR breadcrumb |
| **Fix all PRs** | `Fix PRs:\n<url1>\n<url2>…\n\n<title>\n\n<description>` | work type ≠ Review **and** ≥2 PRs linked |
| **Review PR** (one) | `Review PR:\n<url>\n\n<title>\n\n<description>` | ≥1 PR linked (any work type) — per PR, on each PR breadcrumb |
| **Review all PRs** | `Review PRs:\n<url1>\n<url2>…\n\n<title>\n\n<description>` | ≥2 PRs linked (any work type) |

Per-PR **Fix**/**Review** actions sit on each PR breadcrumb; the **all** variants appear only when ≥2 PRs are linked (with a single PR the per-PR action already covers it). The header is singular for one PR (`Fix PR:`) and plural for many (`Fix PRs:`) — likewise for Review. For a Review card, **only** Review actions are shown — Send and Fix are hidden; a Review card with no PR linked shows a disabled Review PR button with a "Link a PR first" hint.

The shell invocation is unchanged — `zsh -lc 'exec claude --bg --name "$1" "$2"' _ <title> <prompt>` — so the pinned script literal and the `claude-dispatch` capability don't need changes.

**Auto-move on successful dispatch**: after any dispatch mode returns, the card moves to the top of the **In Progress** column, staying in its current swimlane. Skipped if the card is already in In Progress or that column doesn't exist. A failed dispatch does not move the card.

Everything else about dispatch is unchanged from v1.0:

- Runs in the configured project directory (shell plugin `cwd`), returning immediately.
- Parses the short agent id from stdout — observed format `backgrounded · 900a7040 · <name>`. Parse failure surfaces the raw output as an error toast. No silent fallback.
- Stores `{ id, dispatchedAt }` on the card as a breadcrumb (e.g. "agent `900a7040` · sent 2h ago") for manual `claude attach <id>`. Re-dispatching (any mode) replaces it — the old agent keeps running; manage via `claude agents`. A dismiss control clears it.
- Renaming a card later does **not** rename an already-dispatched session.
- No permission flags — the agent runs with whatever the working dir's Claude settings allow. An unattended agent that hits a permission prompt waits until you attach from `claude agents`; tune the repo's `.claude/settings.json` allowlists if it's frequent.
- All `claude` invocations go through `/bin/zsh -lc` (login shell) for GUI PATH. Title and prompt are individual argv elements — never interpolated into a shell string, so quoting/injection is a non-issue.

### Settings
- Floating gear (top-right) or `Cmd+,` → modal with one field: **Project directory** — working dir for all dispatches. Prefilled with the home directory when unset. Validated to exist on save (fs plugin `exists`, scoped to the home tree — directories outside `$HOME` can't be validated, so Send stays disabled for them in v1).

### Persistence
- `tauri-plugin-store`, single file `store.json` in the app data dir (`~/Library/Application Support/<bundle-id>/`).
- Auto-save with default debounce (100ms); every mutation writes through.
- No formal migrations for v1: fields added after a `store.json` was first written (e.g. `priority`, `pullRequests`) are backfilled with a default when the board is loaded. The one shape change — flat `Column.cardIds: string[]` → `Column.lanes: Record<WorkType, string[]>` — is handled the same way at load time: existing ids are grouped into lanes by each card's old `workType` (preserving order), after which the now-redundant per-card `workType` field is dropped. The store is small enough to hand-edit too.

## Data model

```ts
type Priority = "urgent" | "high" | "medium" | "low";
type WorkType = "review" | "coding" | "admin";

interface BoardState {
  columns: Column[];            // ordered, left to right
  cards: Record<string, Card>;
  settings: Settings;
}

interface Column {
  id: string;
  name: string;
  // One ordered list per swimlane. THIS is the card order (per cell).
  lanes: Record<WorkType, string[]>;
}

interface Card {
  id: string;                   // crypto.randomUUID()
  title: string;
  description: string;
  note: string;                 // short freeform status line shown on card face (default "")
  priority: Priority;           // Urgent / High / Medium / Low (default Medium)
  // No workType field — a card's work type IS the swimlane it lives in (its Column.lanes key).
  pullRequests: PullRequest[];  // ordered — display order matches link order (default [])
  createdAt: string;            // ISO
  updatedAt: string;
  agent?: {
    id: string;                 // short id from `claude --bg`, e.g. "900a7040"
    dispatchedAt: string;       // ISO
  };                            // informational breadcrumb — NOT status
  github?: {
    number: number;             // GitHub issue number
    url: string;                // https URL to the issue
  };                            // informational breadcrumb — one-shot import, never re-synced
}

interface PullRequest {
  number: number;               // GitHub PR number
  url: string;                  // canonical https URL to the PR
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

The shell plugin denies everything by default. Each shell command the app can run is granted by a separate capability file, and each pins its script string to a literal — only trailing argv items vary.

**`claude-dispatch`** — background agent dispatch:

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

**`gh-issue-view`** — read-only GitHub issue import. Same shape, different pinned script:

```json
{
  "name": "gh-issue-view",
  "cmd": "/bin/zsh",
  "args": [
    "-lc",
    "exec gh issue view \"$1\" --repo \"$2\" --json title,body,number,url",
    "_",
    { "validator": "[0-9]+" },
    { "validator": "[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+" }
  ]
}
```

Read-only is enforced two ways: the subcommand (`issue view`) and flags are pinned in the script literal, and the number/repo validators tightly restrict the arg shape (digits and a valid `owner/repo` slug — no `..`, no spaces, no shell metacharacters).

Confirmed against the generated schema: the fixed args (`-lc`, the script literal, `_`) must match exactly, and each `validator` regex is auto-wrapped in `^…$` (full-string match) unless `raw: true`. `[\s\S]*` matches any input including newlines without depending on inline-flag placement — the equivalent, more robust form of the original `(?s).*` intent (free text only in the trailing title/prompt arguments of `claude-dispatch`). Each command lives in its own capability file (`src-tauri/capabilities/claude-dispatch.json`, `src-tauri/capabilities/gh-issue-view.json`); the default capability grants `core`/`store`/`fs` only (no `shell:default`).

## Non-goals (v1)

- **Agent lifecycle UI — rejected on principle, not deferred.** No status badges, polling, transcript drawers, notifications, stop buttons, or in-app attach. The board tracks your work; `claude agents` tracks agents — sessions are named after card titles precisely so that view is enough.
- Terminal integration (the earlier Ghostty designs) — obsoleted by dispatch-by-name; nothing in the app touches a terminal anymore
- Column management UI (add/rename/delete/reorder columns) — v1.1 candidate
- Per-issue working directory — v1.1 candidate
- Markdown rendering in descriptions — v1.1 candidate
- Labels, due dates, search/filter, multiple boards
- GitHub *sync* (writing back to issues or PRs, live updates, comment mirroring, re-fetch on open) — import/link is deliberately one-shot; edit locally after
- GitHub *picker* UI (list open issues from a configured repo, assignee filters, pagination) — v1.1 candidate; paste-import covers the common case
- PR *validation/prefill* (calling `gh pr view` to confirm a linked PR exists or fetch its title) — v1.1 candidate; paste-and-link is enough for v1
- Sync, multi-user, auth — never

## Risks

| Risk | Mitigation |
|---|---|
| `claude` not on GUI PATH | Invocation via `/bin/zsh -lc` (login shell) |
| `gh` not on GUI PATH, or user not logged in | Same `/bin/zsh -lc` invocation; auth/missing-binary failures surface as an error toast pointing to `gh auth login` — the app doesn't manage tokens |
| `--bg` stdout format changes across claude versions | Defensive parse; on failure, error toast with raw output (no silent fallback) |
| Unattended agents wait at permission prompts | By design — attach from `claude agents` when ready; tune the repo's own `.claude/settings.json` allowlists if it's frequent |
| Title/prompt quoting/injection into shell | Both passed as individual argv elements end to end; script string is a fixed literal |
| Shell permission too broad | Single named capability entry with pinned script literal |
| WKWebView drag quirks with dnd-kit | dnd-kit uses pointer events (not HTML5 DnD) — known to work in WKWebView; verify in M3 |
