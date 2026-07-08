import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { Card } from "../types";
import { CardItem } from "./CardItem";

interface SortableCardProps {
  card: Card;
  onClick: () => void;
}

export function SortableCard({ card, onClick }: SortableCardProps) {
  const {
    setNodeRef,
    attributes,
    listeners,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: card.id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <CardItem
      ref={setNodeRef}
      card={card}
      dragging={isDragging}
      style={style}
      onClick={onClick}
      {...attributes}
      {...listeners}
    />
  );
}
