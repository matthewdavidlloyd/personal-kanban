import { forwardRef } from "react";
import type { Card } from "../types";

interface CardItemProps extends React.HTMLAttributes<HTMLDivElement> {
  card: Card;
  /** The source card while its drag overlay is shown (rendered faded). */
  dragging?: boolean;
  /** The floating clone rendered inside DragOverlay (rendered lifted). */
  overlay?: boolean;
}

/**
 * Presentational card. Rendered as the sortable node in a column (via
 * SortableCard, which forwards ref + drag listeners) and as the floating
 * clone inside DragOverlay.
 */
export const CardItem = forwardRef<HTMLDivElement, CardItemProps>(
  ({ card, dragging, overlay, className, ...rest }, ref) => {
    const classes = ["card"];
    if (dragging) classes.push("card-dragging");
    if (overlay) classes.push("card-overlay");
    if (className) classes.push(className);

    return (
      <div ref={ref} className={classes.join(" ")} {...rest}>
        <div className="card-title">{card.title}</div>
        {card.agent && (
          <div className="card-agent-marker" title={`agent ${card.agent.id}`}>
            <span className="dot" aria-hidden="true" />
            claude
          </div>
        )}
      </div>
    );
  },
);

CardItem.displayName = "CardItem";
