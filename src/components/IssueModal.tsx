import { useState } from "react";
import type { Card, Priority } from "../types";
import { PRIORITIES, PRIORITY_LABELS, DEFAULT_PRIORITY } from "../priority";
import { timeAgo } from "../time";
import { Modal } from "./Modal";

interface IssueModalProps {
  /** Present in edit mode; absent in create mode. */
  card?: Card;
  onSubmit: (title: string, description: string, priority: Priority) => void;
  onDelete?: () => void;
  onClose: () => void;
  // Dispatch (edit mode only):
  agent?: Card["agent"];
  canSend?: boolean;
  sendHint?: string;
  onSend?: (
    title: string,
    description: string,
    priority: Priority,
  ) => Promise<void>;
  onDismissAgent?: () => void;
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
}: IssueModalProps) {
  const isEdit = card !== undefined;
  const [title, setTitle] = useState(card?.title ?? "");
  const [description, setDescription] = useState(card?.description ?? "");
  const [priority, setPriority] = useState<Priority>(
    card?.priority ?? DEFAULT_PRIORITY,
  );
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [sending, setSending] = useState(false);

  const canSave = title.trim().length > 0;

  function save() {
    if (!canSave) return;
    onSubmit(title.trim(), description, priority);
    onClose();
  }

  async function send() {
    if (!onSend || !canSave || !canSend || sending) return;
    setSending(true);
    try {
      // Parent persists edits, dispatches, and records the agent (or toasts).
      await onSend(title.trim(), description, priority);
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

        <label className="field">
          <span className="field-label">Title</span>
          <input
            className="field-input"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="What needs doing?"
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
