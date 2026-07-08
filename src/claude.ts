import { Command } from "@tauri-apps/plugin-shell";
import { exists } from "@tauri-apps/plugin-fs";

// Must match the pinned script literal in
// src-tauri/capabilities/claude-dispatch.json exactly.
const DISPATCH_SCRIPT = 'exec claude --bg --name "$1" "$2"';
const DISPATCH_NAME = "claude-dispatch";

// Matches ANSI SGR colour codes (ESC[...m) for stripping.
// eslint-disable-next-line no-control-regex
const ANSI_SGR = /\x1b\[[0-9;]*m/g;

/** The prompt sent to the agent: "<title>\n\n<description>" (title only if empty). */
export function buildPrompt(title: string, description: string): string {
  return description.trim() ? `${title}\n\n${description}` : title;
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
 * string), so quoting/injection is a non-issue. Returns instantly with the id.
 */
export async function dispatchToClaude(opts: {
  title: string;
  description: string;
  projectDir: string;
}): Promise<{ id: string }> {
  const prompt = buildPrompt(opts.title, opts.description);
  const command = Command.create(
    DISPATCH_NAME,
    ["-lc", DISPATCH_SCRIPT, "_", opts.title, prompt],
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
