import { useRef, useState } from "react";
import "./BeautyAssistant.css";

export type AssistantState =
  | "idle"
  | "thinking"
  | "found"
  | "success";

type BeautyAssistantProps = {
  state: AssistantState;
  message: string;
  visible: boolean;
};

const assistantImages: Record<AssistantState, string> = {
  idle: "/assistant/assistant-idle.png",
  thinking: "/assistant/assistant-thinking.png",
  found: "/assistant/assistant-found.png",
  success: "/assistant/assistant-success.png",
};

export default function BeautyAssistant({
  state,
  message,
  visible,
}: BeautyAssistantProps) {
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const dragRef = useRef<{
    startX: number;
    startY: number;
    originX: number;
    originY: number;
  } | null>(null);

  if (!visible) return null;

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;

    dragRef.current = {
      startX: event.clientX,
      startY: event.clientY,
      originX: position.x,
      originY: position.y,
    };

    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!dragRef.current) return;

    const nextX =
      dragRef.current.originX + event.clientX - dragRef.current.startX;
    const nextY =
      dragRef.current.originY + event.clientY - dragRef.current.startY;

    setPosition({
      x: nextX,
      y: nextY,
    });
  };

  const stopDragging = (event: React.PointerEvent<HTMLDivElement>) => {
    dragRef.current = null;

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  const displayMessage =
    message || (state === "idle" ? "Привіт! Що будемо шукати?" : "");

  return (
    <div
      className="beauty-assistant"
      style={{
        transform: `translate(${position.x}px, ${position.y}px)`,
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={stopDragging}
      onPointerCancel={stopDragging}
      title="Перетягни мене"
    >
      {displayMessage && (
        <div className="beauty-assistant-bubble">
          {displayMessage}
        </div>
      )}

      <img
        src={assistantImages[state]}
        alt="Beauty AI assistant"
        className={`beauty-assistant-character state-${state}`}
        draggable={false}
      />
    </div>
  );
}
