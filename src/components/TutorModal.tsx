import { useEffect } from "react";

type Props = {
  open: boolean;
  loading: boolean;
  hint: string | null;
  error: string | null;
  loadingText?: string;
  onClose: () => void;
};

export function TutorModal({
  open,
  loading,
  hint,
  error,
  loadingText = "Looking at your map and code…",
  onClose,
}: Props) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const title = error ? "Could not explain" : loading ? "Thinking…" : "Hint";

  return (
    <div className="tutor-overlay" onClick={onClose} role="presentation">
      <div
        className={`tutor-modal${loading ? " is-loading" : ""}${error ? " is-error" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="tutor-title"
        onClick={(e) => e.stopPropagation()}
      >
        <button type="button" className="tutor-close" onClick={onClose} aria-label="Close">
          ×
        </button>
        <div className="tutor-mark" aria-hidden>
          AI
        </div>
        <p className="tutor-kicker">AI tutor</p>
        <h2 id="tutor-title">{title}</h2>
        {loading ? <p className="tutor-body">{loadingText}</p> : null}
        {error ? <p className="tutor-body">{error}</p> : null}
        {hint && !loading ? <p className="ai-text">{hint}</p> : null}
      </div>
    </div>
  );
}
