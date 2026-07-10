import { Command } from "@tauri-apps/plugin-shell";

// Must match the pinned script literal in
// src-tauri/capabilities/gh-issue-view.json exactly.
const GH_SCRIPT =
  'exec gh issue view "$1" --repo "$2" --json title,body,number,url';
const GH_NAME = "gh-issue-view";

// Full URL: https://github.com/owner/repo/issues/123 (tolerate trailing /?#…)
const URL_RE =
  /^https?:\/\/(?:www\.)?github\.com\/([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)\/issues\/(\d+)(?:[/?#].*)?$/;

// Shorthand: owner/repo#123 (shared by issue and PR refs)
const SHORT_RE = /^([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)#(\d+)$/;

// Full PR URL: https://github.com/owner/repo/pull/123 (tolerate trailing /?#…)
const PR_URL_RE =
  /^https?:\/\/(?:www\.)?github\.com\/([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)\/pull\/(\d+)(?:[/?#].*)?$/;

export interface IssueRef {
  owner: string;
  repo: string;
  number: number;
}

export interface PrRef {
  owner: string;
  repo: string;
  number: number;
  url: string; // canonical https URL
}

export interface GithubIssue {
  title: string;
  body: string;
  number: number;
  url: string;
}

export class GithubImportError extends Error {}

/**
 * Parse a GitHub issue reference from either a full URL or `owner/repo#123`.
 * Returns null on anything else (surfaced as an inline parse error in the modal).
 */
export function parseIssueRef(input: string): IssueRef | null {
  const s = input.trim();
  const url = s.match(URL_RE);
  if (url) {
    return { owner: url[1], repo: url[2], number: Number(url[3]) };
  }
  const short = s.match(SHORT_RE);
  if (short) {
    return { owner: short[1], repo: short[2], number: Number(short[3]) };
  }
  return null;
}

/** Canonical PR URL for an owner/repo/number triple. */
function canonicalPrUrl(owner: string, repo: string, number: number): string {
  return `https://github.com/${owner}/${repo}/pull/${number}`;
}

/**
 * Parse a GitHub PR reference from either a full PR URL or `owner/repo#123`.
 * Parse only — no `gh pr view` in v1. Returns null on anything else (surfaced as
 * an inline parse error in the modal). The `url` is normalized to canonical form.
 */
export function parsePrRef(input: string): PrRef | null {
  const s = input.trim();
  const url = s.match(PR_URL_RE);
  if (url) {
    const [, owner, repo, num] = url;
    return {
      owner,
      repo,
      number: Number(num),
      url: canonicalPrUrl(owner, repo, Number(num)),
    };
  }
  const short = s.match(SHORT_RE);
  if (short) {
    const [, owner, repo, num] = short;
    return {
      owner,
      repo,
      number: Number(num),
      url: canonicalPrUrl(owner, repo, Number(num)),
    };
  }
  return null;
}

/** `owner/repo` for a PR breadcrumb, parsed from a canonical PR URL ("" if unparseable). */
export function prRepoLabel(url: string): string {
  const m = url.match(PR_URL_RE);
  return m ? `${m[1]}/${m[2]}` : "";
}

/**
 * Fetch an issue via `gh issue view … --json title,body,number,url`. Read-only:
 * the subcommand and flags are pinned by the capability; only number/repo vary.
 * Requires `gh` on PATH and `gh auth login` already done — auth/missing-binary
 * failures are surfaced as friendly errors pointing to `gh auth login`.
 */
export async function fetchGithubIssue(ref: IssueRef): Promise<GithubIssue> {
  const command = Command.create(GH_NAME, [
    "-lc",
    GH_SCRIPT,
    "_",
    String(ref.number),
    `${ref.owner}/${ref.repo}`,
  ]);

  let output;
  try {
    output = await command.execute();
  } catch (e) {
    throw new GithubImportError(`Couldn't run gh: ${String(e)}`);
  }

  if (output.code !== 0) {
    const stderr = output.stderr.trim();
    const stdout = output.stdout.trim();
    const combined = [stderr, stdout].filter(Boolean).join("\n");
    const lower = combined.toLowerCase();
    if (
      lower.includes("not authenticated") ||
      lower.includes("gh auth login") ||
      lower.includes("authentication required")
    ) {
      throw new GithubImportError(
        "`gh` isn't logged in — run `gh auth login` in a terminal.",
      );
    }
    if (
      lower.includes("command not found") ||
      lower.includes("gh: command not found") ||
      lower.includes("no such file")
    ) {
      throw new GithubImportError(
        "`gh` CLI not found — install it and run `gh auth login`.",
      );
    }
    throw new GithubImportError(
      combined || `gh exited with code ${output.code}`,
    );
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(output.stdout);
  } catch {
    throw new GithubImportError(
      `Couldn't parse gh output as JSON:\n${output.stdout}`,
    );
  }

  if (
    !parsed ||
    typeof parsed !== "object" ||
    typeof (parsed as GithubIssue).title !== "string" ||
    typeof (parsed as GithubIssue).url !== "string" ||
    typeof (parsed as GithubIssue).number !== "number"
  ) {
    throw new GithubImportError(
      `Unexpected gh output shape:\n${output.stdout}`,
    );
  }
  const p = parsed as GithubIssue;
  return {
    title: p.title,
    body: typeof p.body === "string" ? p.body : "",
    number: p.number,
    url: p.url,
  };
}
