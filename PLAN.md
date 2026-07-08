# Personal Kanban — Implementation Plan

**Status: shipped.** All milestones complete; delivered in PR #5 on
`feat/personal-kanban`. `SPEC.md` is the authoritative design — this file is now
a record of the build and the v1.1 roadmap.

## Milestones (all complete)

- [x] **M0 — Scaffold.** Tauri v2 + React + TS; `store` / `shell` / `fs` plugins registered; dev build runs.
- [x] **M1 — Board UI.** Types, `Board → Column → CardItem`, theme-aware stylesheet, window config.
- [x] **M2 — State, persistence, CRUD.** `useReducer` + context, `tauri-plugin-store`, create/edit/delete modal with focus trap and keyboard shortcuts.
- [x] **M3 — Drag and drop.** `@dnd-kit` multi-container lanes; reorder + cross-lane moves persist; click-to-open preserved via an activation distance.
- [x] **M4 — Dispatch + settings.** Settings (project dir, fs-validated); pinned `claude-dispatch` shell capability; `dispatchToClaude` via `/bin/zsh -lc` argv; agent breadcrumb + error toast.
- [x] **M5 — Polish + package.** App icon; `N` / `Esc` / `Cmd+,`; empty states + error toast; `npm run tauri build` → `.app` installed to `/Applications`.

## Beyond the original plan

- Board restyled as centered, full-height "whiteboard" swim lanes; in-app header removed (settings via a floating gear / `Cmd+,`); OS window title set to `personal-kanban`.
- Card **priority** (Urgent / High / Medium / Low) — picker in the modal, colored badge on the card, backfilled to Medium when loading older boards.
- `.npmrc` `min-release-age=7` — npm only installs dependency versions published more than 7 days ago (supply-chain safeguard).

## Manual verification still recommended

The headless build can't drive these end to end; confirm by hand:

- Drag a card across lanes, reorder, quit, relaunch — positions persist; clicking a card still opens it.
- Set a project directory, then Send a card → returns instantly and `claude agents` shows a session **named after the card title** running in that directory.

## Later (v1.1+ — see SPEC non-goals)

Column management → per-issue working dir → markdown descriptions → labels/search. (Agent lifecycle UI is rejected, not deferred — see SPEC.)

## Working agreement

- Commit at the end of each milestone on a feature branch (never straight to `main`).
- If a milestone's approach fights the framework (esp. M3 dnd in WKWebView or M4 permission validators), stop and reassess rather than piling on workarounds.
