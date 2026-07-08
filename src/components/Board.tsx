import type { BoardState } from "../types";
import { Column } from "./Column";

interface BoardProps {
  state: BoardState;
  onAddCard?: (columnId: string) => void;
  onCardClick?: (cardId: string) => void;
}

export function Board({ state, onAddCard, onCardClick }: BoardProps) {
  return (
    <div className="board">
      {state.columns.map((column) => (
        <Column
          key={column.id}
          column={column}
          cards={state.cards}
          onAddCard={onAddCard ? () => onAddCard(column.id) : undefined}
          onCardClick={onCardClick}
        />
      ))}
    </div>
  );
}
