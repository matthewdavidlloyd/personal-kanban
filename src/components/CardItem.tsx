import type { Card } from "../types";

interface CardItemProps {
  card: Card;
  onClick?: () => void;
}

export function CardItem({ card, onClick }: CardItemProps) {
  return (
    <article
      className="card"
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick?.();
        }
      }}
    >
      <div className="card-title">{card.title}</div>
      {card.agent && (
        <div className="card-agent-marker" title={`agent ${card.agent.id}`}>
          <span className="dot" aria-hidden="true" />
          claude
        </div>
      )}
    </article>
  );
}
