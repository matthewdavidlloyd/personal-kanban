import { forwardRef } from "react";
import type { Card } from "../types";
import { PRIORITY_LABELS, DEFAULT_PRIORITY } from "../priority";

interface CardItemProps extends React.HTMLAttributes<HTMLDivElement> {
  card: Card;
  /** The source card while its drag overlay is shown (rendered faded). */
  dragging?: boolean;
  /** The floating clone rendered inside DragOverlay (rendered lifted). */
  overlay?: boolean;
}

/**
 * Presentational card. Rendered as the sortable node in a swimlane (via
 * SortableCard, which forwards ref + drag listeners) and as the floating clone
 * inside DragOverlay. Cards are visually uniform — the swimlane a card lives in
 * is its work-type signal, so there's no per-card tint.
 */
export const CardItem = forwardRef<HTMLDivElement, CardItemProps>(
  ({ card, dragging, overlay, className, ...rest }, ref) => {
    const priority = card.priority ?? DEFAULT_PRIORITY;

    const classes = ["card"];
    if (dragging) classes.push("card-dragging");
    if (overlay) classes.push("card-overlay");
    if (className) classes.push(className);

    return (
      <div ref={ref} className={classes.join(" ")} {...rest}>
        <div className="card-title">{card.title}</div>
        {card.note && <div className="card-note">{card.note}</div>}
        <div className="card-meta">
          <span className={`priority-badge priority-${priority}`}>
            {PRIORITY_LABELS[priority]}
          </span>
          {card.pullRequests && card.pullRequests.length > 0 && (
            <span
              className="card-pr-marker"
              title={`${card.pullRequests.length} linked PR${
                card.pullRequests.length === 1 ? "" : "s"
              }`}
            >
              {card.pullRequests.length} PR{card.pullRequests.length === 1 ? "" : "s"}
            </span>
          )}
          {card.agent && (
            <span
              className="card-agent-marker"
              title={`agent ${card.agent.id}`}
            >
              <span className="dot" aria-hidden="true" />
              claude
            </span>
          )}
        </div>
      </div>
    );
  },
);

CardItem.displayName = "CardItem";
