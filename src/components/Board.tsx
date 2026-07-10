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
  WORK_TYPES,
  WORK_TYPE_LABELS,
  WORK_TYPE_ROW_WEIGHTS,
} from "../workType";
import {
  cellId,
  findColumn,
  moveBetweenColumns,
  parseCellId,
  reorderWithinColumn,
  type ItemMap,
} from "../dnd";
import { LaneCell } from "./LaneCell";
import { CardItem } from "./CardItem";

// Local mirror of the board's per-cell ordering, used as the source of truth
// *during* a drag so cross-cell moves preview live; committed to the reducer as
// a single moveCard on drop. Keyed by cell id (column × swimlane).
function deriveItems(state: BoardState): ItemMap {
  const map: ItemMap = {};
  for (const col of state.columns) {
    for (const wt of WORK_TYPES) {
      map[cellId(col.id, wt)] = col.lanes[wt] ?? [];
    }
  }
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
  // unreliable on a board: a dense source cell next to the target keeps
  // "winning", so moves into an adjacent cell silently fail. Instead resolve to
  // the droppable the pointer is actually inside, then retarget to the nearest
  // card within a hovered cell so the drop index stays stable.
  const collisionDetection: CollisionDetection = useCallback(
    (args) => {
      const pointerCollisions = pointerWithin(args);
      const collisions =
        pointerCollisions.length > 0 ? pointerCollisions : rectIntersection(args);
      let overId = getFirstCollision(collisions, "id");

      if (overId != null) {
        const cells = itemsRef.current;
        if (String(overId) in cells) {
          const cardIds = cells[String(overId)];
          if (cardIds.length > 0) {
            const inner = closestCenter({
              ...args,
              droppableContainers: args.droppableContainers.filter(
                (c) =>
                  c.id !== overId &&
                  String(c.id) !== activeId &&
                  cardIds.includes(String(c.id)),
              ),
            });
            overId = getFirstCollision(inner, "id") ?? overId;
          }
        }
        lastOverId.current = String(overId);
        return [{ id: overId }];
      }

      // Nothing under the pointer (e.g. just emptied a cell) — hold the last
      // target to avoid flicker.
      if (recentlyMovedToNewContainer.current) {
        lastOverId.current = activeId;
      }
      return lastOverId.current ? [{ id: lastOverId.current }] : [];
    },
    [activeId],
  );

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

    const finalCell = findColumn(next, id);
    if (!finalCell) return;
    const parsed = parseCellId(finalCell);
    if (!parsed) return;
    actions.moveCard(
      id,
      parsed.columnId,
      parsed.workType,
      next[finalCell].indexOf(id),
    );
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
  const columns = state.columns;
  const lastRowIndex = WORK_TYPES.length - 1;
  // Swimlane rows sized by weight (e.g. Coding ½, Review/Admin ¼). minmax(0, …)
  // lets a dense lane scroll internally instead of stretching the row.
  const rowSizes = WORK_TYPES.map(
    (wt) => `minmax(0, ${WORK_TYPE_ROW_WEIGHTS[wt]}fr)`,
  ).join(" ");

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
        style={{
          gridTemplateColumns: `auto repeat(${columns.length}, minmax(240px, 320px))`,
          gridTemplateRows: `auto ${rowSizes}`,
        }}
        onPointerDownCapture={() => {
          // Start of a fresh interaction — allow the next click through.
          suppressClick.current = false;
        }}
      >
        {/* Top-left corner spacer above the swimlane rail. */}
        <div className="rail-corner" style={{ gridColumn: 1, gridRow: 1 }} />

        {/* Column headers across the top. */}
        {columns.map((column, ci) => {
          const count = WORK_TYPES.reduce(
            (n, wt) => n + (items[cellId(column.id, wt)]?.length ?? 0),
            0,
          );
          return (
            <header
              key={`h-${column.id}`}
              className="column-header"
              style={{ gridColumn: ci + 2, gridRow: 1 }}
            >
              <h2 className="column-name">{column.name}</h2>
              <span className="column-count">{count}</span>
              <button
                type="button"
                className="column-add"
                title={`Add card to ${column.name}`}
                aria-label={`Add card to ${column.name}`}
                onClick={() => onAddCard(column.id)}
              >
                +
              </button>
            </header>
          );
        })}

        {/* Swimlane label rail down the left, colored by work type. */}
        {WORK_TYPES.map((wt, ri) => (
          <div
            key={`rail-${wt}`}
            className={`lane-rail lane-rail-${wt}${
              ri === lastRowIndex ? " lane-rail-last-row" : ""
            }`}
            style={{ gridColumn: 1, gridRow: ri + 2 }}
          >
            <span className="lane-rail-label">{WORK_TYPE_LABELS[wt]}</span>
          </div>
        ))}

        {/* The grid of cells: one per (column × swimlane). */}
        {columns.map((column, ci) =>
          WORK_TYPES.map((wt, ri) => {
            const id = cellId(column.id, wt);
            return (
              <LaneCell
                key={id}
                id={id}
                cardIds={items[id] ?? []}
                cards={state.cards}
                lastColumn={ci === columns.length - 1}
                lastRow={ri === lastRowIndex}
                onCardClick={handleCardClick}
                style={{ gridColumn: ci + 2, gridRow: ri + 2 }}
              />
            );
          }),
        )}
      </div>
      <DragOverlay>
        {activeCard ? <CardItem card={activeCard} overlay /> : null}
      </DragOverlay>
    </DndContext>
  );
}
