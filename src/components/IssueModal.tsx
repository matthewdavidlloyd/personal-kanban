import { useState } from "react";
import type { Card, Priority, PullRequest, WorkType } from "../types";
import type { DispatchMode } from "../claude";
import { PRIORITIES, PRIORITY_LABELS, DEFAULT_PRIORITY } from "../priority";
import { WORK_TYPES, WORK_TYPE_LABELS, DEFAULT_WORK_TYPE } from "../workType";
import { timeAgo } from "../time";
import {
  fetchGithubIssue,
  GithubImportError,
  parseIssueRef,
  parsePrRef,
  prRepoLabel,
} from "../github";
import { Modal } from "./Modal";

/** The current form values handed to the parent on dispatch. */
export interface DispatchFields {
  title: string;
  description: string;
  note: string;
  priority: Priority;
  workType: WorkType;
  pullRequests: PullRequest[];
}

interface IssueModalProps {
  /** Present in edit mode; absent in create mode. */
  card?: Card;
  /** The card's current work type (its swimlane), derived by the parent. */
  workType?: WorkType;
  onSubmit: (
    title: string,
    description: string,
    note: string,
    priority: Priority,
    workType: WorkType,
    pullRequests: PullRequest[],
    github?: NonNullable<Card["github"]>,
  ) => void;
  onDelete?: () => void;
  onClose: () => void;
  // Dispatch (edit mode only):
  agent?: Card["agent"];
  canSend?: boolean;
  sendHint?: string;
  onDispatch?: (
    mode: DispatchMode,
    prUrls: string[],
    fields: DispatchFields,
  ) => Promise<void>;
  onDismissAgent?: () => void;
  // GitHub breadcrumb (edit mode only):
  github?: Card["github"];
  onDismissGithub?: () => void;
}

export function IssueModal({
  card,
  workType: initialWorkType,
  onSubmit,
  onDelete,
  onClose,
  agent,
  canSend = false,
  sendHint,
  onDispatch,
  onDismissAgent,
  github,
  onDismissGithub,
}: IssueModalProps) {
  const isEdit = card !== undefined;
  const [title, setTitle] = useState(card?.title ?? "");
  const [description, setDescription] = useState(card?.description ?? "");
  const [note, setNote] = useState(card?.note ?? "");
  const [priority, setPriority] = useState<Priority>(
    card?.priority ?? DEFAULT_PRIORITY,
  );
  const [workType, setWorkType] = useState<WorkType>(
    initialWorkType ?? DEFAULT_WORK_TYPE,
  );
  const [pullRequests, setPullRequests] = useState<PullRequest[]>(
    card?.pullRequests ?? [],
  );
  const [prInput, setPrInput] = useState("");
  const [prError, setPrError] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [sending, setSending] = useState(false);
  const [githubInput, setGithubInput] = useState("");
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [imported, setImported] = useState<NonNullable<Card["github"]> | null>(
    null,
  );

  const canSave = title.trim().length > 0;

  function save() {
    if (!canSave) return;
    onSubmit(
      title.trim(),
      description,
      note.trim(),
      priority,
      workType,
      pullRequests,
      imported ?? undefined,
    );
    onClose();
  }

  async function importFromGithub() {
    if (importing) return;
    const ref = parseIssueRef(githubInput);
    if (!ref) {
      setImportError("Paste an issue URL or owner/repo#123");
      return;
    }
    setImportError(null);
    setImporting(true);
    try {
      const issue = await fetchGithubIssue(ref);
      setTitle(issue.title);
      setDescription(issue.body);
      setImported({ number: issue.number, url: issue.url });
    } catch (e) {
      const message =
        e instanceof GithubImportError
          ? e.message
          : `Import failed: ${String(e)}`;
      setImportError(message);
    } finally {
      setImporting(false);
    }
  }

  function linkPr() {
    const ref = parsePrRef(prInput);
    if (!ref) {
      setPrError("Paste a PR URL or owner/repo#123");
      return;
    }
    // GitHub owner/repo are case-insensitive, so dedup case-insensitively —
    // otherwise `owner/Repo#1` and `owner/repo#1` would both link the same PR.
    if (pullRequests.some((p) => p.url.toLowerCase() === ref.url.toLowerCase())) {
      setPrError("That PR is already linked");
      setPrInput("");
      return;
    }
    setPullRequests([...pullRequests, { number: ref.number, url: ref.url }]);
    setPrInput("");
    setPrError(null);
  }

  function removePr(url: string) {
    setPullRequests(pullRequests.filter((p) => p.url !== url));
  }

  async function dispatch(mode: DispatchMode, prUrls: string[]) {
    if (!onDispatch || !canSave || !canSend || sending) return;
    setSending(true);
    try {
      // Parent persists edits, dispatches, records the agent (or toasts), and
      // auto-moves the card to In Progress.
      await onDispatch(mode, prUrls, {
        title: title.trim(),
        description,
        note: note.trim(),
        priority,
        workType,
        pullRequests,
      });
    } finally {
      setSending(false);
    }
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      save();
    }
  }

  const isReview = workType === "review";
  const prUrls = pullRequests.map((p) => p.url);
  const hasPr = prUrls.length > 0;
  const multiPr = prUrls.length >= 2;
  const dispatchDisabled = !canSend || !canSave || sending;
  // One blocking hint: an unset/invalid project directory disables *every*
  // dispatch, so it wins over the Review-needs-a-PR case.
  const dispatchHint = !canSend
    ? sendHint
    : isReview && !hasPr
      ? "Link a PR first"
      : null;

  return (
    <Modal onClose={onClose} labelledBy="issue-modal-title">
      <div className="modal-body" onKeyDown={onKeyDown}>
        <h2 id="issue-modal-title" className="modal-heading">
          {isEdit ? "Edit issue" : "New issue"}
        </h2>

        {!isEdit && (
          <div className="import-row">
            <input
              className="field-input import-input"
              value={githubInput}
              onChange={(e) => setGithubInput(e.target.value)}
              placeholder="Import GitHub issue — owner/repo#123 or full URL"
              disabled={importing}
            />
            <button
              type="button"
              className="btn"
              onClick={importFromGithub}
              disabled={!githubInput.trim() || importing}
            >
              {importing ? "Importing…" : "Import"}
            </button>
            {importError && <p className="import-error">{importError}</p>}
            {imported && !importError && (
              <p className="import-ok">
                Imported issue #{imported.number} — edit below before saving.
              </p>
            )}
          </div>
        )}

        <label className="field">
          <span className="field-label">Title</span>
          <input
            className="field-input"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="What needs doing?"
          />
        </label>

        <label className="field">
          <span className="field-label">Note</span>
          <input
            className="field-input"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Short status (optional)"
          />
        </label>

        <div className="field">
          <span className="field-label">Priority</span>
          <div className="priority-picker" role="radiogroup" aria-label="Priority">
            {PRIORITIES.map((p) => (
              <button
                key={p}
                type="button"
                role="radio"
                aria-checked={priority === p}
                className={`priority-option priority-${p}${
                  priority === p ? " is-selected" : ""
                }`}
                onClick={() => setPriority(p)}
              >
                {PRIORITY_LABELS[p]}
              </button>
            ))}
          </div>
        </div>

        <div className="field">
          <span className="field-label">Type</span>
          <div className="priority-picker" role="radiogroup" aria-label="Work type">
            {WORK_TYPES.map((w) => (
              <button
                key={w}
                type="button"
                role="radio"
                aria-checked={workType === w}
                className={`priority-option worktype-${w}${
                  workType === w ? " is-selected" : ""
                }`}
                onClick={() => setWorkType(w)}
              >
                {WORK_TYPE_LABELS[w]}
              </button>
            ))}
          </div>
        </div>

        <label className="field">
          <span className="field-label">Description</span>
          <textarea
            className="field-textarea"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={6}
            placeholder="Details (optional)"
          />
        </label>

        {isEdit && (
          <div className="field">
            <span className="field-label">Pull requests</span>
            <div className="pr-input-row">
              <input
                className="field-input"
                value={prInput}
                onChange={(e) => {
                  setPrInput(e.target.value);
                  setPrError(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    linkPr();
                  }
                }}
                placeholder="Link a PR — owner/repo#123 or full URL"
              />
              <button
                type="button"
                className="btn"
                onClick={linkPr}
                disabled={!prInput.trim()}
              >
                Link
              </button>
            </div>
            {prError && <p className="import-error">{prError}</p>}
            {hasPr && (
              <ul className="pr-list">
                {pullRequests.map((pr) => (
                  <li key={pr.url} className="pr-item">
                    <span className="pr-breadcrumb">
                      <span className="dot" aria-hidden="true" />
                      <a
                        href={pr.url}
                        target="_blank"
                        rel="noreferrer"
                        className="github-link"
                      >
                        PR #{pr.number}
                      </a>
                      <span className="pr-repo">· {prRepoLabel(pr.url)}</span>
                    </span>
                    <span className="pr-actions">
                      {!isReview && (
                        <button
                          type="button"
                          className="btn btn-mini"
                          onClick={() => dispatch("fix", [pr.url])}
                          disabled={dispatchDisabled}
                          title={!canSend ? sendHint : `Fix PR #${pr.number}`}
                        >
                          Fix
                        </button>
                      )}
                      <button
                        type="button"
                        className="btn btn-mini"
                        onClick={() => dispatch("review", [pr.url])}
                        disabled={dispatchDisabled}
                        title={!canSend ? sendHint : `Review PR #${pr.number}`}
                      >
                        Review
                      </button>
                      <button
                        type="button"
                        className="pr-remove"
                        aria-label={`Remove PR #${pr.number}`}
                        title="Remove PR"
                        onClick={() => removePr(pr.url)}
                      >
                        ×
                      </button>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {isEdit && (
          <div className="dispatch">
            {github && (
              <div className="agent-breadcrumb github-breadcrumb">
                <span className="dot" aria-hidden="true" />
                <span className="agent-text">
                  issue{" "}
                  <a
                    href={github.url}
                    target="_blank"
                    rel="noreferrer"
                    className="github-link"
                  >
                    #{github.number}
                  </a>
                </span>
                <button
                  type="button"
                  className="agent-dismiss"
                  title="Clear GitHub breadcrumb"
                  aria-label="Clear GitHub breadcrumb"
                  onClick={onDismissGithub}
                >
                  ×
                </button>
              </div>
            )}
            {agent && (
              <div className="agent-breadcrumb">
                <span className="dot" aria-hidden="true" />
                <span className="agent-text">
                  agent <code>{agent.id}</code> · sent{" "}
                  {timeAgo(agent.dispatchedAt)}
                </span>
                <button
                  type="button"
                  className="agent-dismiss"
                  title="Clear agent breadcrumb"
                  aria-label="Clear agent breadcrumb"
                  onClick={onDismissAgent}
                >
                  ×
                </button>
              </div>
            )}

            <div className="dispatch-actions">
              {!isReview && (
                <button
                  type="button"
                  className="btn btn-send"
                  onClick={() => dispatch("send", [])}
                  disabled={dispatchDisabled}
                  title={!canSend ? sendHint : undefined}
                >
                  {sending
                    ? "Sending…"
                    : agent
                      ? "Re-send to Claude Code"
                      : "Send to Claude Code"}
                </button>
              )}
              {!isReview && multiPr && (
                <button
                  type="button"
                  className="btn btn-send"
                  onClick={() => dispatch("fix", prUrls)}
                  disabled={dispatchDisabled}
                  title={!canSend ? sendHint : undefined}
                >
                  Fix all PRs
                </button>
              )}
              {multiPr && (
                <button
                  type="button"
                  className="btn btn-send"
                  onClick={() => dispatch("review", prUrls)}
                  disabled={dispatchDisabled}
                  title={!canSend ? sendHint : undefined}
                >
                  Review all PRs
                </button>
              )}
              {isReview && !hasPr && (
                <button
                  type="button"
                  className="btn btn-send"
                  disabled
                  title={dispatchHint ?? undefined}
                >
                  Review PR
                </button>
              )}
            </div>

            {dispatchHint && <span className="send-hint">{dispatchHint}</span>}
          </div>
        )}

        <div className="modal-actions">
          {isEdit &&
            onDelete &&
            (confirmingDelete ? (
              <span className="confirm-delete">
                <span className="confirm-delete-text">Delete this issue?</span>
                <button
                  type="button"
                  className="btn btn-danger"
                  onClick={() => {
                    onDelete();
                    onClose();
                  }}
                >
                  Delete
                </button>
                <button
                  type="button"
                  className="btn"
                  onClick={() => setConfirmingDelete(false)}
                >
                  Cancel
                </button>
              </span>
            ) : (
              <button
                type="button"
                className="btn btn-danger-text"
                onClick={() => setConfirmingDelete(true)}
              >
                Delete
              </button>
            ))}
          <span className="modal-actions-spacer" />
          <button type="button" className="btn" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={save}
            disabled={!canSave}
          >
            {isEdit ? "Save" : "Create"}
          </button>
        </div>

        <p className="modal-hint">⌘↵ to save · Esc to cancel</p>
      </div>
    </Modal>
  );
}
