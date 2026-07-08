import { useEffect, useState } from "react";
import { Board } from "./components/Board";
import { IssueModal } from "./components/IssueModal";
import { BoardProvider, useBoard } from "./BoardContext";

type ModalState =
  | { type: "create"; columnId: string }
  | { type: "edit"; cardId: string }
  | null;

function AppInner() {
  const { state, actions } = useBoard();
  const [modal, setModal] = useState<ModalState>(null);

  // `N` opens a new issue in the first column (ignored while typing / in a modal).
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (modal) return;
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
  }, [modal, state.columns]);

  const editingCard =
    modal?.type === "edit" ? state.cards[modal.cardId] : undefined;

  return (
    <div className="app">
      <header className="app-bar">
        <h1 className="app-title">Kanban</h1>
        <button
          type="button"
          className="icon-button"
          title="Settings"
          aria-label="Settings"
        >
          ⚙
        </button>
      </header>

      <main className="app-main">
        <Board
          state={state}
          onAddCard={(columnId) => setModal({ type: "create", columnId })}
          onCardClick={(cardId) => setModal({ type: "edit", cardId })}
        />
      </main>

      {modal?.type === "create" && (
        <IssueModal
          onSubmit={(title, description) =>
            actions.addCard(modal.columnId, title, description)
          }
          onClose={() => setModal(null)}
        />
      )}

      {modal?.type === "edit" && editingCard && (
        <IssueModal
          card={editingCard}
          onSubmit={(title, description) =>
            actions.updateCard(editingCard.id, title, description)
          }
          onDelete={() => actions.deleteCard(editingCard.id)}
          onClose={() => setModal(null)}
        />
      )}
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
