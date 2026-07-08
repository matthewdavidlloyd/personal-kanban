# Personal Kanban — Implementation Plan

Milestones are ordered so the app is runnable after every one. Each has an acceptance check — do not move on until it passes. See `SPEC.md` for the what and why.

## M0 — Scaffold ✦ ~15 min

- [ ] Prereqs: Rust toolchain (`rustup`), Node 20+. Verify `claude --bg --name` works and the name shows in `claude agents` (verified 2026-07-08 on this machine).
- [ ] `npm create tauri-app@latest` → React + TypeScript + Vite template, app name `personal-kanban`, identifier `com.mattlloyd.personal-kanban`.
- [ ] Register plugins: `tauri add store shell fs` (adds Rust crates + npm packages + default permissions).
- [ ] First `npm run tauri dev` (slow — full Rust compile, expect minutes).

**Accept:** dev window opens with template content; dock icon present while running.

## M1 — Board UI (static) ✦ small

- [ ] Types from SPEC data model in `src/types.ts`.
- [ ] Components: `Board` → `Column` → `CardItem`. Hardcoded seed state, no interactivity.
- [ ] Layout + styling: columns side by side, full-height, scroll within column; dark mode via `prefers-color-scheme`.
- [ ] Window config: sensible default size (e.g. 1100×720), min size, title "Kanban".

**Accept:** looks like a kanban board with three columns and a few fake cards, in light and dark mode.

## M2 — State, persistence, issue CRUD ✦ medium

- [ ] `useBoard` hook: `useReducer` with actions `addCard`, `updateCard`, `deleteCard`, `moveCard`, `setCardAgent`, `clearCardAgent`, `updateSettings`. Context provider.
- [ ] Persistence: load `store.json` on startup (fall back to seed defaults), write state back on every dispatch (store plugin autoSave debounce handles coalescing).
- [ ] `IssueModal` — one component, two modes:
  - Create: `+` per column, `N` shortcut → title + description, `Cmd+Enter` saves, `Esc` cancels.
  - Edit: click card → same fields prefilled + Delete (with confirm).
- [ ] Focus management: autofocus title, focus trap in modal, `Esc` always closes.

**Accept:** create a card, edit it, quit the app fully, relaunch — card is still there. Delete works.

## M3 — Drag and drop ✦ medium

- [ ] `@dnd-kit/core` + `@dnd-kit/sortable`: one `DndContext` over the board, each column a sortable container.
- [ ] Reorder within column and move across columns (including into empty columns); drop dispatches `moveCard`; order persists.
- [ ] Drag affordances: cursor, lift shadow on active card, drop placeholder.
- [ ] Keep click-to-open working (dnd-kit activation constraint: ~5px distance so clicks don't start drags).

**Accept:** drag a card Backlog → In Progress → reorder → quit → relaunch — positions all preserved. Clicking a card still opens the modal.

## M4 — Dispatch + settings ✦ medium, the risky one

- [ ] Settings modal (gear icon): project directory (fs `exists()` validation), persisted in store.
- [ ] Shell capability in `src-tauri/capabilities/`: the single `claude-dispatch` shape from SPEC §shell-permission-scoping; confirm validator syntax against the generated schema.
- [ ] `dispatchToClaude(card)`: run `claude --bg --name "<title>" "<title>\n\n<description>"` via `/bin/zsh -lc` argv form with `cwd: projectDir`; parse short id from `backgrounded · <id> · <name>` stdout (error toast with raw output if unparseable); store `{id, dispatchedAt}` on card.
- [ ] Issue modal: Send button (disabled with a hint if project dir is unset/invalid); when an agent exists, show breadcrumb (`agent <id> · sent <ago>`) + dismiss control. Static marker on `CardItem`.
- [ ] Manual test matrix: title and description with double quotes, single quotes, newlines, backticks, `$(...)` — all must arrive verbatim as session name and prompt (argv passing should make this trivially true; verify with `claude agents` + `claude logs <id>` in a terminal).

**Accept:** click Send on a card → returns instantly, card records the agent id, and `claude agents` shows a session **named after the card title** running in the right directory.

## M5 — Polish + package ✦ small

- [ ] App icon: source PNG → `npm run tauri icon` (generates all sizes).
- [ ] Keyboard pass: `N` new issue, `Esc` closes topmost layer, `Cmd+,` opens settings.
- [ ] Empty states (no cards; no project dir set) and error toast if dispatch/attach fails (non-zero exit or unparseable output).
- [ ] `npm run tauri build` → copy `.app` from `src-tauri/target/release/bundle/macos/` to `/Applications`.

**Accept:** launch from Spotlight/Dock like any other app; full loop works: create issue → drag to In Progress → Send → keep working → check in via `claude agents`, where the session is named after the card.

## Later (v1.1+ — see SPEC non-goals)

Column management → per-issue working dir → markdown descriptions → labels/search. (Agent lifecycle UI is rejected, not deferred — see SPEC.)

## Working agreement

- Commit at the end of each milestone on a feature branch (never straight to `main`).
- If a milestone's approach fights the framework (esp. M3 dnd in WKWebView or M4 permission validators), stop and reassess rather than piling on workarounds.
