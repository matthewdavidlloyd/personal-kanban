import type { CSSProperties } from "react";
import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import type { Card } from "../types";
import { SortableCard } from "./SortableCard";

interface LaneCellProps {
  /** Droppable id — a cell id from dnd.ts `cellId(columnId, workType)`. */
  id: string;
  cardIds: string[];
  cards: Record<string, Card>;
  /** Grid placement (column × swimlane row) supplied by the Board. */
  style?: CSSProperties;
  /** True only for the last column, to drop the trailing right border. */
  lastColumn?: boolean;
  /** True only for the last swimlane row, to drop the trailing bottom border. */
  lastRow?: boolean;
  onCardClick: (cardId: string) => void;
}

/**
 * One board cell = a (column × swimlane) drop target. The inner scroll area is
 * the droppable, so cards can land in an empty cell or the whitespace below the
 * last card; a small count badge stays pinned in the corner as content scrolls.
 */
export function LaneCell({
  id,
  cardIds,
  cards,
  style,
  lastColumn,
  lastRow,
  onCardClick,
}: LaneCellProps) {
  const { setNodeRef, isOver } = useDroppable({ id });

  const classes = ["lane-cell"];
  if (isOver) classes.push("lane-cell-over");
  if (lastColumn) classes.push("lane-cell-last-col");
  if (lastRow) classes.push("lane-cell-last-row");

  return (
    <div className={classes.join(" ")} style={style}>
      {cardIds.length > 0 && (
        <span className="lane-cell-count" aria-hidden="true">
          {cardIds.length}
        </span>
      )}
      <div ref={setNodeRef} className="lane-cell-scroll">
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
      </div>
    </div>
  );
}
