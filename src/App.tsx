import { useCallback, useEffect, useState } from "react";
import { Board } from "./components/Board";
import { IssueModal } from "./components/IssueModal";
import { SettingsModal } from "./components/SettingsModal";
import { Toast } from "./components/Toast";
import { BoardProvider, useBoard } from "./BoardContext";
import { DispatchError, dispatchToClaude, projectDirExists } from "./claude";
import type { Priority } from "./types";

type ModalState =
  | { type: "create"; columnId: string }
  | { type: "edit"; cardId: string }
  | null;

function AppInner() {
  const { state, actions } = useBoard();
  const [modal, setModal] = useState<ModalState>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [projectDirValid, setProjectDirValid] = useState(false);

  const projectDir = state.settings.projectDir;

  // Track project-directory validity so Send can be gated on it.
  useEffect(() => {
    let cancelled = false;
    projectDirExists(projectDir).then((ok) => {
      if (!cancelled) setProjectDirValid(ok);
    });
    return () => {
      cancelled = true;
    };
  }, [projectDir]);

  // Global shortcuts: Cmd+, opens Settings; `N` opens a new issue in the first
  // column (both ignored while typing or when a layer is already open).
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === ",") {
        if (modal || settingsOpen) return;
        e.preventDefault();
        setSettingsOpen(true);
        return;
      }
      if (modal || settingsOpen) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable)
      ) {
        return;
      }
      if (e.key === "n" || e.key === "N") {
        const first = state.columns[0];
        if (first) {
          e.preventDefault();
          setModal({ type: "create", columnId: first.id });
        }
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [modal, settingsOpen, state.columns]);

  const editingCard =
    modal?.type === "edit" ? state.cards[modal.cardId] : undefined;

  const sendHint = projectDir.trim()
    ? "Project directory not found — check Settings"
    : "Set a project directory in Settings first";

  const handleSend = useCallback(
    async (
      cardId: string,
      title: string,
      description: string,
      priority: Priority,
    ) => {
      actions.updateCard(cardId, title, description, priority);
      try {
        const { id } = await dispatchToClaude({
          title,
          description,
          projectDir,
        });
        actions.setCardAgent(cardId, {
          id,
          dispatchedAt: new Date().toISOString(),
        });
      } catch (e) {
        const message =
          e instanceof DispatchError ? e.message : `Dispatch failed: ${String(e)}`;
        setToast(message);
      }
    },
    [actions, projectDir],
  );

  return (
    <div className="app">
      {projectDir.trim() && (
        <button
          type="button"
          className="settings-fab"
          title="Settings (⌘,)"
          aria-label="Settings"
          onClick={() => setSettingsOpen(true)}
        >
          ⚙
        </button>
      )}

      {!projectDir.trim() && (
        <div className="notice">
          <span>
            No project directory set — “Send to Claude Code” is disabled.
          </span>
          <button
            type="button"
            className="notice-action"
            onClick={() => setSettingsOpen(true)}
          >
            Open Settings
          </button>
        </div>
      )}

      <main className="app-main">
        <Board
          onAddCard={(columnId) => setModal({ type: "create", columnId })}
          onCardClick={(cardId) => setModal({ type: "edit", cardId })}
        />
      </main>

      {modal?.type === "create" && (
        <IssueModal
          onSubmit={(title, description, priority) =>
            actions.addCard(modal.columnId, title, description, priority)
          }
          onClose={() => setModal(null)}
        />
      )}

      {modal?.type === "edit" && editingCard && (
        <IssueModal
          card={editingCard}
          onSubmit={(title, description, priority) =>
            actions.updateCard(editingCard.id, title, description, priority)
          }
          onDelete={() => actions.deleteCard(editingCard.id)}
          onClose={() => setModal(null)}
          agent={editingCard.agent}
          canSend={projectDirValid}
          sendHint={sendHint}
          onSend={(title, description, priority) =>
            handleSend(editingCard.id, title, description, priority)
          }
          onDismissAgent={() => actions.clearCardAgent(editingCard.id)}
        />
      )}

      {settingsOpen && (
        <SettingsModal
          projectDir={projectDir}
          onSave={(dir) => actions.updateSettings({ projectDir: dir })}
          onClose={() => setSettingsOpen(false)}
        />
      )}

      {toast && <Toast message={toast} onDismiss={() => setToast(null)} />}
    </div>
  );
}

function App() {
  return (
    <BoardProvider>
      <AppInner />
    </BoardProvider>
  );
}

export default App;
