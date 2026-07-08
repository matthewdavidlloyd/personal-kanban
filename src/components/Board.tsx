import { useEffect, useRef, useState } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCorners,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import type { BoardState } from "../types";
import { useBoard } from "../BoardContext";
import {
  findColumn,
  moveBetweenColumns,
  reorderWithinColumn,
  type ItemMap,
} from "../dnd";
import { Column } from "./Column";
import { CardItem } from "./CardItem";

// Local mirror of the board's column ordering, used as the source of truth
// *during* a drag so cross-column moves preview live; committed to the reducer
// as a single moveCard on drop.
function deriveItems(state: BoardState): ItemMap {
  const map: ItemMap = {};
  for (const col of state.columns) map[col.id] = col.cardIds;
  return map;
}

interface BoardProps {
  onAddCard: (columnId: string) => void;
  onCardClick: (cardId: string) => void;
}

export function Board({ onAddCard, onCardClick }: BoardProps) {
  const { state, actions } = useBoard();
  const [items, setItems] = useState<ItemMap>(() => deriveItems(state));
  const [activeId, setActiveId] = useState<string | null>(null);

  const itemsRef = useRef(items);
  itemsRef.current = items;
  // A drag just ended; swallow the trailing click so it doesn't open the modal.
  const suppressClick = useRef(false);

  // Keep the local mirror in sync with the board whenever we're not dragging
  // (covers create/edit/delete and post-drop resync).
  useEffect(() => {
    if (activeId === null) setItems(deriveItems(state));
  }, [state, activeId]);

  const sensors = useSensors(
    // ~5px activation distance so a click doesn't start a drag.
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

  function handleDragStart(event: DragStartEvent) {
    suppressClick.current = false;
    setActiveId(String(event.active.id));
  }

  function handleDragOver(event: DragOverEvent) {
    const { active, over } = event;
    if (!over) return;
    setItems((prev) =>
      moveBetweenColumns(prev, String(active.id), String(over.id)),
    );
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    const id = String(active.id);
    setActiveId(null);
    suppressClick.current = true;
    if (!over) return; // dropped outside — sync effect reverts the preview

    const next = reorderWithinColumn(itemsRef.current, id, String(over.id));
    if (next !== itemsRef.current) {
      setItems(next);
      itemsRef.current = next;
    }

    const finalCol = findColumn(next, id);
    if (!finalCol) return;
    actions.moveCard(id, finalCol, next[finalCol].indexOf(id));
  }

  function handleDragCancel() {
    setActiveId(null); // sync effect reverts the preview
  }

  function handleCardClick(cardId: string) {
    if (suppressClick.current) {
      suppressClick.current = false;
      return;
    }
    onCardClick(cardId);
  }

  const activeCard = activeId ? state.cards[activeId] : null;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <div
        className="board"
        onPointerDownCapture={() => {
          // Start of a fresh interaction — allow the next click through.
          suppressClick.current = false;
        }}
      >
        {state.columns.map((column) => (
          <Column
            key={column.id}
            id={column.id}
            name={column.name}
            cardIds={items[column.id] ?? []}
            cards={state.cards}
            onAddCard={() => onAddCard(column.id)}
            onCardClick={handleCardClick}
          />
        ))}
      </div>
      <DragOverlay>
        {activeCard ? <CardItem card={activeCard} overlay /> : null}
      </DragOverlay>
    </DndContext>
  );
}
