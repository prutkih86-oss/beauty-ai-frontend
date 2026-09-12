import "./BeautyAssistant.css";

export type AssistantState =
  | "idle"
  | "greeting"
  | "waiting"
  | "what-you-doing"
  | "what-you-doing-2"
  | "search"
  | "success"
  | "no-result"
  | "error"
  | "help"
  | "booking-success"
  | "detail-view";

type BeautyAssistantProps = {
  state: AssistantState;
  message?: string;
  visible?: boolean;
  className?: string;
  ariaLabel?: string;
};

const assistantImages: Record<AssistantState, string> = {
  idle: "/assistant/assistant-idle.png",
  greeting: "/assistant/assistant-greeting2.png",
  waiting: "/assistant/assistant-thinking.png",
  "what-you-doing": "/assistant/assistant-whatyoudoing.png",
  "what-you-doing-2": "/assistant/assistant-whatyoudoing2.png",
  search: "/assistant/assistant-search2.png",
  success: "/assistant/assistant-found.png",
  "no-result": "/assistant/assistant-no_result2.png",
  error: "/assistant/assistant-colaps.png",
  help: "/assistant/assistant-help.png",
  "booking-success": "/assistant/assistant-booking-success.png",
  "detail-view": "/assistant/assistant-salon_master-detail-viev.png",
};

export default function BeautyAssistant({
  state,
  message = "",
  visible = true,
  className = "",
  ariaLabel = "Beauty AI assistant",
}: BeautyAssistantProps) {
  if (!visible) {
    return null;
  }

  return (
    <div
      className={`beauty-assistant-inline state-${state} ${className}`.trim()}
      data-assistant-state={state}
    >
      {message && (
        <div className="beauty-assistant-bubble" role="status" aria-live="polite">
          {message}
        </div>
      )}

      <img
        src={assistantImages[state]}
        alt={ariaLabel}
        className="beauty-assistant-character"
        draggable={false}
      />
    </div>
  );
}
