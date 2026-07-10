import { useState } from "react";
import type { Card, Priority, WorkType } from "../types";
import { PRIORITIES, PRIORITY_LABELS, DEFAULT_PRIORITY } from "../priority";
import { WORK_TYPES, WORK_TYPE_LABELS, DEFAULT_WORK_TYPE } from "../workType";
import { timeAgo } from "../time";
import {
  fetchGithubIssue,
  GithubImportError,
  parseIssueRef,
} from "../github";
import { Modal } from "./Modal";

interface IssueModalProps {
  /** Present in edit mode; absent in create mode. */
  card?: Card;
  onSubmit: (
    title: string,
    description: string,
    note: string,
    priority: Priority,
    workType: WorkType,
    github?: NonNullable<Card["github"]>,
  ) => void;
  onDelete?: () => void;
  onClose: () => void;
  // Dispatch (edit mode only):
  agent?: Card["agent"];
  canSend?: boolean;
  sendHint?: string;
  onSend?: (
    title: string,
    description: string,
    note: string,
    priority: Priority,
    workType: WorkType,
  ) => Promise<void>;
  onDismissAgent?: () => void;
  // GitHub breadcrumb (edit mode only):
  github?: Card["github"];
  onDismissGithub?: () => void;
}

export function IssueModal({
  card,
  onSubmit,
  onDelete,
  onClose,
  agent,
  canSend = false,
  sendHint,
  onSend,
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
    card?.workType ?? DEFAULT_WORK_TYPE,
  );
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

  async function send() {
    if (!onSend || !canSave || !canSend || sending) return;
    setSending(true);
    try {
      // Parent persists edits, dispatches, and records the agent (or toasts).
      await onSend(title.trim(), description, note.trim(), priority, workType);
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
            <button
              type="button"
              className="btn btn-send"
              onClick={send}
              disabled={!canSend || !canSave || sending}
              title={!canSend ? sendHint : undefined}
            >
              {sending
                ? "Sending…"
                : agent
                  ? "Re-send to Claude Code"
                  : "Send to Claude Code"}
            </button>
            {!canSend && sendHint && (
              <span className="send-hint">{sendHint}</span>
            )}
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
