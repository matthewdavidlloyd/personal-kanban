import { Board } from "./components/Board";
import { createSeedState } from "./seed";

function App() {
  // M1: static seed content, no interactivity yet.
  const state = createSeedState();

  return (
    <div className="app">
      <header className="app-bar">
        <h1 className="app-title">Kanban</h1>
        <button type="button" className="icon-button" title="Settings" aria-label="Settings">
          ⚙
        </button>
      </header>
      <main className="app-main">
        <Board state={state} />
      </main>
    </div>
  );
}

export default App;
