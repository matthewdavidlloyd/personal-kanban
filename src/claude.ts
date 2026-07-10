import { Command } from "@tauri-apps/plugin-shell";
import { exists } from "@tauri-apps/plugin-fs";

// Must match the pinned script literal in
// src-tauri/capabilities/claude-dispatch.json exactly.
const DISPATCH_SCRIPT = 'exec claude --bg --name "$1" "$2"';
const DISPATCH_NAME = "claude-dispatch";

// Matches ANSI SGR colour codes (ESC[...m) for stripping.
// eslint-disable-next-line no-control-regex
const ANSI_SGR = /\x1b\[[0-9;]*m/g;

export type DispatchMode = "send" | "fix" | "review";

/** The base prompt: "<title>\n\n<description>" (title only if description empty). */
export function buildPrompt(title: string, description: string): string {
  return description.trim() ? `${title}\n\n${description}` : title;
}

/**
 * Build the dispatch prompt for a mode. Send is just the base prompt; Fix/Review
 * prepend a `Fix PR:`/`Review PR:` header (singular for one PR, plural for many)
 * followed by the PR URLs, then the base prompt. See SPEC §Dispatch.
 */
export function buildDispatchPrompt(opts: {
  mode: DispatchMode;
  title: string;
  description: string;
  prUrls: string[];
}): string {
  const base = buildPrompt(opts.title, opts.description);
  if (opts.mode === "send" || opts.prUrls.length === 0) return base;
  const verb = opts.mode === "fix" ? "Fix" : "Review";
  const header = `${verb} ${opts.prUrls.length === 1 ? "PR" : "PRs"}:`;
  return `${header}\n${opts.prUrls.join("\n")}\n\n${base}`;
}

/**
 * Parse the short agent id from `claude --bg` output. Observed format:
 *   backgrounded · 900a7040 · <name>
 * Tolerant of ANSI colour codes and surrounding lines. Returns null on failure.
 */
export function parseAgentId(output: string): string | null {
  const clean = output.replace(ANSI_SGR, "");
  const match = clean.match(/backgrounded\s*·\s*([^\s·]+)/);
  return match ? match[1] : null;
}

export class DispatchError extends Error {}

/**
 * Dispatch a background Claude Code agent named after the card. Title and prompt
 * are passed as individual argv elements (never interpolated into a shell
 * string), so quoting/injection is a non-issue. The prompt is prebuilt by the
 * caller (see buildDispatchPrompt) since it varies by mode. Returns the id.
 */
export async function dispatchToClaude(opts: {
  title: string;
  prompt: string;
  projectDir: string;
}): Promise<{ id: string }> {
  const command = Command.create(
    DISPATCH_NAME,
    ["-lc", DISPATCH_SCRIPT, "_", opts.title, opts.prompt],
    { cwd: opts.projectDir },
  );

  let output;
  try {
    output = await command.execute();
  } catch (e) {
    throw new DispatchError(`Couldn't launch claude: ${String(e)}`);
  }

  const raw = [output.stdout, output.stderr]
    .map((s) => s.trim())
    .filter(Boolean)
    .join("\n");

  if (output.code !== 0) {
    throw new DispatchError(raw || `claude exited with code ${output.code}`);
  }

  const id = parseAgentId(raw);
  if (!id) {
    throw new DispatchError(`Couldn't parse agent id from output:\n${raw}`);
  }
  return { id };
}

/** Whether a directory path exists (used to validate the project dir). */
export async function projectDirExists(path: string): Promise<boolean> {
  if (!path.trim()) return false;
  try {
    return await exists(path);
  } catch {
    // Outside the allowed fs scope, or unreadable → treat as invalid.
    return false;
  }
}
