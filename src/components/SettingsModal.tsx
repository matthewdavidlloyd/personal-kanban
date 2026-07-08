import { useEffect, useState } from "react";
import { homeDir } from "@tauri-apps/api/path";
import { Modal } from "./Modal";
import { projectDirExists } from "../claude";

interface SettingsModalProps {
  projectDir: string;
  onSave: (projectDir: string) => void;
  onClose: () => void;
}

export function SettingsModal({
  projectDir,
  onSave,
  onClose,
}: SettingsModalProps) {
  const [value, setValue] = useState(projectDir);
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);

  // Prefill with the home directory when unset (SPEC default: ~).
  useEffect(() => {
    if (projectDir.trim()) return;
    let cancelled = false;
    homeDir()
      .then((home) => {
        if (!cancelled) setValue((v) => (v.trim() ? v : home));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [projectDir]);

  async function save() {
    const path = value.trim();
    if (!path) {
      setError("Enter a directory path.");
      return;
    }
    setChecking(true);
    const ok = await projectDirExists(path);
    setChecking(false);
    if (!ok) {
      setError("That directory doesn’t exist (or isn’t accessible).");
      return;
    }
    onSave(path);
    onClose();
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      save();
    }
  }

  return (
    <Modal onClose={onClose} labelledBy="settings-title">
      <div className="modal-body" onKeyDown={onKeyDown}>
        <h2 id="settings-title" className="modal-heading">
          Settings
        </h2>

        <label className="field">
          <span className="field-label">Project directory</span>
          <input
            className="field-input"
            value={value}
            onChange={(e) => {
              setValue(e.target.value);
              setError(null);
            }}
            placeholder="/Users/you/code/project"
            spellCheck={false}
            autoCapitalize="off"
            autoCorrect="off"
          />
          <span className="field-help">
            Working directory for every “Send to Claude Code” dispatch.
          </span>
        </label>

        {error && <p className="field-error">{error}</p>}

        <div className="modal-actions">
          <span className="modal-actions-spacer" />
          <button type="button" className="btn" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={save}
            disabled={checking}
          >
            {checking ? "Checking…" : "Save"}
          </button>
        </div>

        <p className="modal-hint">⌘↵ to save · Esc to cancel</p>
      </div>
    </Modal>
  );
}
