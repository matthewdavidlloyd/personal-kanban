import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import type { Card } from "../types";
import { SortableCard } from "./SortableCard";

interface ColumnProps {
  id: string;
  name: string;
  cardIds: string[];
  cards: Record<string, Card>;
  onAddCard: () => void;
  onCardClick: (cardId: string) => void;
}

export function Column({
  id,
  name,
  cardIds,
  cards,
  onAddCard,
  onCardClick,
}: ColumnProps) {
  // The whole cards area is a drop target, so cards can be dropped into an
  // empty column or the whitespace below the last card.
  const { setNodeRef, isOver } = useDroppable({ id });

  return (
    <section className="column">
      <header className="column-header">
        <h2 className="column-name">{name}</h2>
        <span className="column-count">{cardIds.length}</span>
        <button
          type="button"
          className="column-add"
          title={`Add card to ${name}`}
          aria-label={`Add card to ${name}`}
          onClick={onAddCard}
        >
          +
        </button>
      </header>
      <div
        ref={setNodeRef}
        className={`column-cards${isOver ? " column-cards-over" : ""}`}
      >
        <SortableContext items={cardIds} strategy={verticalListSortingStrategy}>
          {cardIds.map((cardId) => {
            const card = cards[cardId];
            if (!card) return null;
            return (
              <SortableCard
                key={cardId}
                card={card}
                onClick={() => onCardClick(cardId)}
              />
            );
          })}
        </SortableContext>
        {cardIds.length === 0 && <p className="column-empty">Drop cards here</p>}
      </div>
    </section>
  );
}
