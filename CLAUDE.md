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
- `src/boardReducer.ts` — pure reducer (`addCard`/`updateCard`/`deleteCard`/`moveCard`/`setCardAgent`/`clearCardAgent`/`updateSettings`/`hydrate`).
- `src/store.ts` — persistence via `tauri-plugin-store` (`store.json`); `normalize()` backfills newly added `Card` fields on load.
- `src/dnd.ts` — pure drag ordering helpers; `components/Board.tsx` wires `@dnd-kit` around them.
- `src/claude.ts` — background dispatch, stdout id parsing, and fs project-dir validation.
- `src/components/` — `Board`, `Column`, `SortableCard`, `CardItem`, `IssueModal`, `SettingsModal`, `Modal`, `Toast`.
- `src/styles.css` — the one stylesheet; theme via `:root` CSS variables + `prefers-color-scheme`.
- `src-tauri/` — stock Tauri v2. Plugins (`store`/`shell`/`fs`) registered in `lib.rs`; **no custom Rust commands**. Capabilities in `src-tauri/capabilities/`.

## Conventions & gotchas

- **Board order is manual** — the persisted `Column.cardIds` array order *is* the order. Never auto-sort (priority is display-only).
- **Adding a `Card` field** touches four places: `types.ts`, the reducer's create/update cases, `seed.ts`, and `store.ts` `normalize()` (backfill a default — there are no formal migrations).
- **Dispatch scope is exact-match**: `DISPATCH_SCRIPT` in `claude.ts` must stay byte-identical to `args[1]` in `capabilities/claude-dispatch.json`, or the runtime shell-scope check rejects the call. Title and prompt are always passed as individual argv elements — never interpolated into a shell string.
- **Permissions** (shell/fs) live in `src-tauri/capabilities/*.json`; Tauri validates them at build time. `fs:allow-exists` is scoped to `$HOME`.
- **`.npmrc` sets `min-release-age=7`** — npm won't install dependency versions younger than 7 days. If a needed package is too fresh, the install errors; wait it out or add it to `min-release-age-exclude`.
- IDs use `crypto.randomUUID()`. Keep light + dark working (use the existing CSS vars, e.g. `--surface`, `--prio-*`).

## Verifying

- `npx tsc --noEmit` for every change.
- Pure logic (reducer, `dnd.ts`) has no test framework — verify by transpiling with `esbuild` to `.mjs` and running `node` assertions.
- Drag interaction and live Send → agent dispatch can't be driven headless; they need a human at the running app.
