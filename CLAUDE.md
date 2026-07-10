# personal-kanban

Single-user macOS kanban board (Tauri v2 + React + TypeScript). Every card can
dispatch a background Claude Code agent named after the card title. **`SPEC.md`
is the authoritative design** — read it before non-trivial changes.

## Commands

```sh
npm install                      # deps (subject to the min-release-age gate below)
npm run tauri dev                # dev app + Vite HMR
npx tsc --noEmit                 # typecheck (do this after every change)
npm run tauri build -- --bundles app   # build the .app only
```

Use `--bundles app` for builds: the full `tauri build` also makes a `.dmg`, but
its `bundle_dmg.sh` (AppleScript) hangs in headless/non-interactive shells.
Output: `src-tauri/target/release/bundle/macos/personal-kanban.app`.

## Where things live

- `src/BoardContext.tsx` — the single source of truth: `useReducer` + context. All mutations go through the `actions` exposed here.
- `src/boardReducer.ts` — pure reducer (`addCard`/`updateCard`/`deleteCard`/`moveCard`/`setCardAgent`/`clearCardAgent`/`clearCardGithub`/`updateSettings`/`hydrate`). `addCard`/`moveCard` take a `workType` = target swimlane.
- `src/board.ts` — pure selectors (`findCardLocation`/`cardWorkType`): a card's work type is derived from the swimlane it's in, not stored on the card.
- `src/migrate.ts` — pure load-time `normalizeBoardState()`: backfills new `Card` fields and migrates the flat `Column.cardIds` → `Column.lanes` shape.
- `src/store.ts` — persistence via `tauri-plugin-store` (`store.json`); delegates load-time backfill to `migrate.ts`.
- `src/dnd.ts` — pure drag ordering helpers over cell ids (`cellId`/`parseCellId` = column × swimlane); `components/Board.tsx` wires `@dnd-kit` around them.
- `src/claude.ts` — background dispatch (`buildDispatchPrompt` per Send/Fix/Review mode), stdout id parsing, and fs project-dir validation.
- `src/components/` — `Board` (swimlane grid), `LaneCell` (a column × swimlane drop target), `SortableCard`, `CardItem`, `IssueModal`, `SettingsModal`, `Modal`, `Toast`.
- `src/styles.css` — the one stylesheet; theme via `:root` CSS variables + `prefers-color-scheme`.
- `src-tauri/` — stock Tauri v2. Plugins (`store`/`shell`/`fs`) registered in `lib.rs`; **no custom Rust commands**. Capabilities in `src-tauri/capabilities/`.

## Conventions & gotchas

- **Board order is manual** — the persisted `Column.lanes[workType]` array order *is* the order (per cell = column × swimlane). Never auto-sort (priority is display-only).
- **Work type is not stored on the card** — it's the swimlane (`Column.lanes` key) the card lives in. Derive it with `board.ts` `cardWorkType()`. Changing Type in the modal / dragging across swimlanes is a `moveCard` to the target lane.
- **Adding a `Card` field** touches four places: `types.ts`, the reducer's create/update cases, `seed.ts`, and `migrate.ts` `normalizeBoardState()` (backfill a default — there are no formal migrations).
- **Dispatch scope is exact-match**: `DISPATCH_SCRIPT` in `claude.ts` must stay byte-identical to `args[1]` in `capabilities/claude-dispatch.json`, or the runtime shell-scope check rejects the call. Title and prompt are always passed as individual argv elements — never interpolated into a shell string.
- **Permissions** (shell/fs) live in `src-tauri/capabilities/*.json`; Tauri validates them at build time. `fs:allow-exists` is scoped to `$HOME`.
- **`.npmrc` sets `min-release-age=7`** — npm won't install dependency versions younger than 7 days. If a needed package is too fresh, the install errors; wait it out or add it to `min-release-age-exclude`.
- IDs use `crypto.randomUUID()`. Keep light + dark working (use the existing CSS vars, e.g. `--surface`, `--prio-*`).

## Verifying

- `npx tsc --noEmit` for every change.
- Pure logic (reducer, `dnd.ts`) has no test framework — verify by transpiling with `esbuild` to `.mjs` and running `node` assertions.
- Drag interaction and live Send → agent dispatch can't be driven headless; they need a human at the running app.
