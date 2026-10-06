import type { Track } from "../track";

type LessonOption = {
  id: string;
  index: number;
  title: string;
};

type Props = {
  lessons: LessonOption[];
  lesson: { id: string };
  engineReady: boolean;
  engineReadyLabel?: string;
  engineLoadingLabel?: string;
  actionsEnabled?: boolean;
  busy: boolean;
  product?: string;
  track?: Track;
  onTrack?: (track: Track) => void;
  onSelect: (id: string) => void;
  onRun: () => void;
  onSubmit: () => void;
  onReset: () => void;
  onExplain: () => void;
  explaining: boolean;
};

export function TopBar({
  lessons,
  lesson,
  engineReady,
  engineReadyLabel = "Python ready",
  engineLoadingLabel = "Loading Python",
  actionsEnabled,
  busy,
  product = "RoboWorld",
  track = "python",
  onTrack,
  onSelect,
  onRun,
  onSubmit,
  onReset,
  onExplain,
  explaining,
}: Props) {
  const canRun = actionsEnabled ?? engineReady;
  return (
    <header className="topbar">
      <div className="brand">
        <div className="logo" aria-hidden>
          e
        </div>
        <div className="brand-text">
          <strong>Elice</strong>
          <span>{product}</span>
        </div>
      </div>
      <div className="track-switch" role="group" aria-label="Practice block">
        <button
          type="button"
          className={track === "python" ? "is-active" : ""}
          aria-pressed={track === "python"}
          disabled={busy}
          onClick={() => {
            if (track !== "python") onTrack?.("python");
          }}
        >
          Python
        </button>
        <button
          type="button"
          className={track === "sql" ? "is-active" : ""}
          aria-pressed={track === "sql"}
          disabled={busy}
          onClick={() => {
            if (track !== "sql") onTrack?.("sql");
          }}
        >
          SQL
        </button>
      </div>
      <label className="lesson-select">
        <span className="sr-only">Select lesson</span>
        <select value={lesson.id} onChange={(e) => onSelect(e.target.value)} disabled={busy}>
          {lessons.map((item) => (
            <option key={item.id} value={item.id}>
              {item.index}. {item.title}
            </option>
          ))}
        </select>
      </label>
      <div className="spacer" />
      <div className={`engine-pill${engineReady ? " is-ready" : ""}`}>
        <span className="pulse" />
        {engineReady ? engineReadyLabel : engineLoadingLabel}
      </div>
      <button type="button" className="btn explain" onClick={onExplain} disabled={busy || explaining}>
        {explaining ? "Hinting…" : "Explain"}
      </button>
      <button type="button" className="btn ghost" onClick={onReset} disabled={busy}>
        Reset
      </button>
      <button type="button" className="btn primary" onClick={onRun} disabled={busy || !canRun}>
        Run
      </button>
      <button type="button" className="btn dark" onClick={onSubmit} disabled={busy || !canRun}>
        Submit
      </button>
    </header>
  );
}
