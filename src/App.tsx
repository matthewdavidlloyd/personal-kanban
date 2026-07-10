import { useCallback, useEffect, useState } from "react";
import { Board } from "./components/Board";
import { IssueModal, type DispatchFields } from "./components/IssueModal";
import { SettingsModal } from "./components/SettingsModal";
import { Toast } from "./components/Toast";
import { BoardProvider, useBoard } from "./BoardContext";
import {
  DispatchError,
  buildDispatchPrompt,
  dispatchToClaude,
  projectDirExists,
  type DispatchMode,
} from "./claude";
import { cardWorkType, findCardLocation } from "./board";
import { DEFAULT_WORK_TYPE } from "./workType";

const IN_PROGRESS_ID = "in-progress";

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
  const editingWorkType = editingCard
    ? cardWorkType(state, editingCard.id) ?? DEFAULT_WORK_TYPE
    : undefined;

  const sendHint = projectDir.trim()
    ? "Project directory not found — check Settings"
    : "Set a project directory in Settings first";

  // Persist the non-lane edits, then (if the Type changed) move the card to the
  // end of the target swimlane in the same column.
  const saveEdits = useCallback(
    (cardId: string, fields: DispatchFields) => {
      actions.updateCard(
        cardId,
        fields.title,
        fields.description,
        fields.note,
        fields.priority,
        fields.pullRequests,
      );
      const loc = findCardLocation(state, cardId);
      if (loc && fields.workType !== loc.workType) {
        actions.moveCard(
          cardId,
          loc.columnId,
          fields.workType,
          Number.MAX_SAFE_INTEGER,
        );
      }
    },
    [actions, state],
  );

  const handleDispatch = useCallback(
    async (cardId: string, mode: DispatchMode, prUrls: string[], fields: DispatchFields) => {
      // Persist edits (including any Type/lane change) before dispatching.
      const loc = findCardLocation(state, cardId);
      saveEdits(cardId, fields);

      const prompt = buildDispatchPrompt({
        mode,
        title: fields.title,
        description: fields.description,
        prUrls,
      });
      try {
        const { id } = await dispatchToClaude({
          title: fields.title,
          prompt,
          projectDir,
        });
        actions.setCardAgent(cardId, {
          id,
          dispatchedAt: new Date().toISOString(),
        });
        // Auto-move to the top of In Progress, staying in the card's swimlane.
        // Skipped if it's already there or that column doesn't exist.
        const hasInProgress = state.columns.some((c) => c.id === IN_PROGRESS_ID);
        if (hasInProgress && loc?.columnId !== IN_PROGRESS_ID) {
          actions.moveCard(cardId, IN_PROGRESS_ID, fields.workType, 0);
        }
      } catch (e) {
        const message =
          e instanceof DispatchError ? e.message : `Dispatch failed: ${String(e)}`;
        setToast(message);
      }
    },
    [actions, projectDir, saveEdits, state],
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
          onSubmit={(title, description, note, priority, workType, _prs, github) =>
            actions.addCard(
              modal.columnId,
              title,
              description,
              note,
              priority,
              workType,
              github,
            )
          }
          onClose={() => setModal(null)}
        />
      )}

      {modal?.type === "edit" && editingCard && (
        <IssueModal
          card={editingCard}
          workType={editingWorkType}
          onSubmit={(title, description, note, priority, workType, pullRequests) =>
            saveEdits(editingCard.id, {
              title,
              description,
              note,
              priority,
              workType,
              pullRequests,
            })
          }
          onDelete={() => actions.deleteCard(editingCard.id)}
          onClose={() => setModal(null)}
          agent={editingCard.agent}
          canSend={projectDirValid}
          sendHint={sendHint}
          onDispatch={(mode, prUrls, fields) =>
            handleDispatch(editingCard.id, mode, prUrls, fields)
          }
          onDismissAgent={() => actions.clearCardAgent(editingCard.id)}
          github={editingCard.github}
          onDismissGithub={() => actions.clearCardGithub(editingCard.id)}
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
