import { useCallback, useEffect, useRef, useState } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCenter,
  getFirstCollision,
  pointerWithin,
  rectIntersection,
  useSensor,
  useSensors,
  type CollisionDetection,
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
  // Collision-detection helpers for the multi-container strategy below.
  const lastOverId = useRef<string | null>(null);
  const recentlyMovedToNewContainer = useRef(false);

  // Keep the local mirror in sync with the board whenever we're not dragging
  // (covers create/edit/delete and post-drop resync).
  useEffect(() => {
    if (activeId === null) setItems(deriveItems(state));
  }, [state, activeId]);

  // Reset the "just crossed containers" latch once the preview settles.
  useEffect(() => {
    requestAnimationFrame(() => {
      recentlyMovedToNewContainer.current = false;
    });
  }, [items]);

  const sensors = useSensors(
    // ~5px activation distance so a click doesn't start a drag.
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

  // Pointer-first collision detection. Corner/center distance alone is
  // unreliable on a board: a dense source column next to the target keeps
  // "winning", so moves into an adjacent column silently fail. Instead resolve
  // to the droppable the pointer is actually inside, then retarget to the
  // nearest card within a hovered column so the drop index stays stable.
  const collisionDetection: CollisionDetection = useCallback((args) => {
    const pointerCollisions = pointerWithin(args);
    const collisions =
      pointerCollisions.length > 0 ? pointerCollisions : rectIntersection(args);
    let overId = getFirstCollision(collisions, "id");

    if (overId != null) {
      const columns = itemsRef.current;
      if (String(overId) in columns) {
        const cardIds = columns[String(overId)];
        if (cardIds.length > 0) {
          const inner = closestCenter({
            ...args,
            droppableContainers: args.droppableContainers.filter(
              (c) => c.id !== overId && cardIds.includes(String(c.id)),
            ),
          });
          overId = getFirstCollision(inner, "id") ?? overId;
        }
      }
      lastOverId.current = String(overId);
      return [{ id: overId }];
    }

    // Nothing under the pointer (e.g. just emptied a column) — hold the last
    // target to avoid flicker.
    if (recentlyMovedToNewContainer.current) {
      lastOverId.current = activeId;
    }
    return lastOverId.current ? [{ id: lastOverId.current }] : [];
  }, [activeId]);

  function handleDragStart(event: DragStartEvent) {
    suppressClick.current = false;
    lastOverId.current = null;
    recentlyMovedToNewContainer.current = false;
    setActiveId(String(event.active.id));
  }

  function handleDragOver(event: DragOverEvent) {
    const { active, over } = event;
    if (!over) return;
    const current = itemsRef.current;
    const next = moveBetweenColumns(current, String(active.id), String(over.id));
    if (next !== current) {
      recentlyMovedToNewContainer.current = true;
      itemsRef.current = next;
      setItems(next);
    }
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    const id = String(active.id);
    setActiveId(null);
    suppressClick.current = true;
    lastOverId.current = null;
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
    lastOverId.current = null;
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
      collisionDetection={collisionDetection}
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
