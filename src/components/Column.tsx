import type { Card, Column as ColumnType } from "../types";
import { CardItem } from "./CardItem";

interface ColumnProps {
  column: ColumnType;
  cards: Record<string, Card>;
  onAddCard?: () => void;
  onCardClick?: (cardId: string) => void;
}

export function Column({ column, cards, onAddCard, onCardClick }: ColumnProps) {
  return (
    <section className="column">
      <header className="column-header">
        <h2 className="column-name">{column.name}</h2>
        <span className="column-count">{column.cardIds.length}</span>
        <button
          type="button"
          className="column-add"
          title={`Add card to ${column.name}`}
          aria-label={`Add card to ${column.name}`}
          onClick={onAddCard}
        >
          +
        </button>
      </header>
      <div className="column-cards">
        {column.cardIds.map((id) => {
          const card = cards[id];
          if (!card) return null;
          return (
            <CardItem
              key={id}
              card={card}
              onClick={onCardClick ? () => onCardClick(id) : undefined}
            />
          );
        })}
        {column.cardIds.length === 0 && (
          <p className="column-empty">No cards</p>
        )}
      </div>
    </section>
  );
}
