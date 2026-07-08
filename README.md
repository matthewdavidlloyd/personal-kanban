# Personal Kanban

A single-user kanban board for macOS — a real `.app` with a dock icon, local
data, one board. Every card has a **Send to Claude Code** button that dispatches
a background Claude Code agent named after the card title, so it's trivially
findable in `claude agents` (which is where all agent management lives).

See [`SPEC.md`](./SPEC.md) for the design and [`PLAN.md`](./PLAN.md) for the
build plan.

## Stack

Tauri v2 + React + TypeScript + Vite. State lives in a single `useReducer`
(`src/BoardContext.tsx`) and persists to `store.json` via `tauri-plugin-store`.
Drag and drop uses `@dnd-kit`. The Rust side is stock Tauri with three plugins
(`store`, `shell`, `fs`) and no custom commands.

## Develop

```sh
npm install
npm run tauri dev
```

## Build

```sh
npm run tauri build
# → src-tauri/target/release/bundle/macos/personal-kanban.app
```

## How dispatch works

Send runs, in the configured project directory, exactly:

```sh
claude --bg --name "<title>" "<title>\n\n<description>"
```

via `/bin/zsh -lc` with the title and prompt passed as individual argv elements
(never interpolated into a shell string). The shell capability
(`src-tauri/capabilities/claude-dispatch.json`) pins the script to a literal and
only lets the title/prompt vary — it's the only command the app can execute. The
short agent id is parsed from stdout and stored on the card as an informational
breadcrumb; manage the agent itself with `claude agents` / `claude attach <id>`.

## Settings

Set the project directory (the working dir for every dispatch) via the gear icon
or `Cmd+,`. It's validated to exist before saving.

## Shortcuts

- `N` — new issue in the first column
- `Cmd+Enter` — save the open issue / settings
- `Esc` — close the top layer
- `Cmd+,` — open settings
