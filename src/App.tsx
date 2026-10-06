import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent } from "react";
import { ConsolePane } from "./components/ConsolePane";
import { EditorPane } from "./components/EditorPane";
import { ProblemPanel } from "./components/ProblemPanel";
import { Simulator } from "./components/Simulator";
import { TopBar } from "./components/TopBar";
import { TutorModal } from "./components/TutorModal";
import type { GradeResult, LogLine, Snapshot, WorldState } from "./engine/types";
import { loadPython, runStudentCode } from "./engine/runPython";
import { cloneWorld } from "./engine/world";
import { requestHint } from "./engine/explain";
import { LESSONS, lessonWorld, type Lesson } from "./lessons";
import type { Track } from "./track";

const CODE_KEY = "elice-roboworld-code-en";
const LEGACY_CODE_KEY = "elice-roboworld-code";
const HANGUL = /[\uAC00-\uD7A3]/;

function parseCodeMap(raw: string | null): Record<string, string> {
  if (!raw) return {};
  try {
    return JSON.parse(raw) as Record<string, string>;
  } catch {
    return {};
  }
}

function withoutHangul(code: string, skeleton: string) {
  if (!HANGUL.test(code)) return code;
  const kept = code
    .split("\n")
    .filter((line) => !HANGUL.test(line))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return kept || skeleton;
}

function sanitizeCodeMap(map: Record<string, string>) {
  const next: Record<string, string> = {};
  for (const [id, code] of Object.entries(map)) {
    const lesson = LESSONS.find((item) => item.id === id);
    next[id] = withoutHangul(code, lesson?.skeleton ?? code);
  }
  return next;
}

function loadSavedCode() {
  try {
    const current = sanitizeCodeMap(parseCodeMap(localStorage.getItem(CODE_KEY)));
    if (Object.keys(current).length > 0) {
      localStorage.setItem(CODE_KEY, JSON.stringify(current));
      return current;
    }
    const migrated = sanitizeCodeMap(parseCodeMap(localStorage.getItem(LEGACY_CODE_KEY)));
    if (Object.keys(migrated).length > 0) {
      localStorage.setItem(CODE_KEY, JSON.stringify(migrated));
    }
    return migrated;
  } catch {
    return {};
  }
}

function readEditorValue(fallback: string) {
  const monaco = (
    window as unknown as {
      monaco?: { editor?: { getEditors?: () => { getValue: () => string }[] } };
    }
  ).monaco;
  return monaco?.editor?.getEditors?.()[0]?.getValue() ?? fallback;
}

type Props = {
  track?: Track;
  onTrack?: (track: Track) => void;
};

export default function App({ track = "python", onTrack }: Props) {
  const [lessonId, setLessonId] = useState(LESSONS[0].id);
  const lesson = LESSONS.find((item) => item.id === lessonId) ?? LESSONS[0];
  const initialWorld = useMemo(() => lessonWorld(lesson), [lesson]);

  const [editorSource, setEditorSource] = useState(
    () => loadSavedCode()[LESSONS[0].id] ?? LESSONS[0].skeleton,
  );
  const [world, setWorld] = useState<WorldState>(initialWorld);
  const [pythonReady, setPythonReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [logs, setLogs] = useState<LogLine[]>([]);
  const [grade, setGrade] = useState<GradeResult | null>(null);
  const [hintOpen, setHintOpen] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [crashed, setCrashed] = useState(false);
  const [problemOpen, setProblemOpen] = useState(true);
  const [consoleH, setConsoleH] = useState(168);
  const [resizing, setResizing] = useState(false);
  const [explaining, setExplaining] = useState(false);
  const [tutorOpen, setTutorOpen] = useState(false);
  const [tutorHint, setTutorHint] = useState<string | null>(null);
  const [tutorError, setTutorError] = useState<string | null>(null);
  const tutorOpenRef = useRef(false);
  const dragRef = useRef<{ startY: number; startH: number } | null>(null);

  useEffect(() => {
    document.body.classList.remove("is-resizing");
    const onMove = (e: globalThis.PointerEvent) => {
      const drag = dragRef.current;
      if (!drag) return;
      e.preventDefault();
      setConsoleH(Math.min(420, Math.max(72, drag.startH + (drag.startY - e.clientY))));
    };
    const onUp = () => {
      dragRef.current = null;
      setResizing(false);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    window.addEventListener("mouseup", onUp);
    window.addEventListener("blur", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
      window.removeEventListener("mouseup", onUp);
      window.removeEventListener("blur", onUp);
    };
  }, []);

  function onSplitDown(e: PointerEvent<HTMLDivElement>) {
    e.preventDefault();
    dragRef.current = { startY: e.clientY, startH: consoleH };
    setResizing(true);
  }

  const playRef = useRef<number | null>(null);
  const busyRef = useRef(false);
  const speedRef = useRef(speed);
  const codeRef = useRef(editorSource);
  const lessonRef = useRef(lesson);
  const saveTimer = useRef<number | null>(null);
  speedRef.current = speed;
  lessonRef.current = lesson;

  const persist = useCallback((next: string, id = lessonRef.current.id, immediate = false) => {
    codeRef.current = next;
    const write = () => {
      const stored = loadSavedCode();
      stored[id] = next;
      localStorage.setItem(CODE_KEY, JSON.stringify(stored));
    };
    if (immediate) {
      if (saveTimer.current) window.clearTimeout(saveTimer.current);
      write();
      return;
    }
    if (saveTimer.current) window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(write, 400);
  }, []);

  function stopPlay() {
    if (playRef.current) {
      window.clearTimeout(playRef.current);
      playRef.current = null;
    }
  }

  useEffect(() => {
    loadPython()
      .then(() => setPythonReady(true))
      .catch((err: unknown) => {
        setLogs([
          {
            level: "error",
            text: `Could not load the Python engine: ${err instanceof Error ? err.message : String(err)}`,
          },
        ]);
      });
  }, []);

  useEffect(() => {
    if (!HANGUL.test(editorSource)) return;
    const cleaned = withoutHangul(editorSource, lesson.skeleton);
    persist(cleaned, lesson.id, true);
    setEditorSource(cleaned);
    const editor = (
      window as unknown as {
        monaco?: { editor?: { getEditors?: () => { setValue: (v: string) => void }[] } };
      }
    ).monaco?.editor?.getEditors?.()[0];
    editor?.setValue(cleaned);
  }, [editorSource, lesson.id, lesson.skeleton, persist]);

  useEffect(() => {
    const stored = loadSavedCode();
    const source = stored[lesson.id] ?? lesson.skeleton;
    codeRef.current = source;
    setEditorSource(source);
    setWorld(lessonWorld(lesson));
    setLogs([]);
    setGrade(null);
    setHintOpen(false);
    setCrashed(false);
    tutorOpenRef.current = false;
    setTutorOpen(false);
    setTutorHint(null);
    setTutorError(null);
    stopPlay();
  }, [lesson.id]);

  function playSnapshots(snapshots: Snapshot[], hadError: boolean) {
    stopPlay();
    if (snapshots.length === 0) return;
    const last = snapshots[snapshots.length - 1];
    const stepMs = Math.max(90, 420 / speedRef.current);
    let i = 0;

    const tick = () => {
      const snap = snapshots[i];
      setWorld(snap.world);
      setCrashed(snap.action === "crash" || (hadError && i === snapshots.length - 1));
      i += 1;
      if (i < snapshots.length) {
        playRef.current = window.setTimeout(tick, stepMs);
      } else {
        setWorld(last.world);
      }
    };
    playRef.current = window.setTimeout(tick, 40);
  }

  const execute = useCallback(async (mode: "run" | "submit") => {
    if (busyRef.current || !pythonReady) return;
    const currentLesson: Lesson = lessonRef.current;
    const currentWorld = lessonWorld(currentLesson);
    const source = readEditorValue(codeRef.current);
    persist(source, currentLesson.id, true);

    busyRef.current = true;
    stopPlay();
    setBusy(true);
    setGrade(null);
    setCrashed(false);
    setWorld(cloneWorld(currentWorld));
    setLogs([{ level: "info", text: mode === "run" ? "Running…" : "Grading…" }]);
    try {
      const result = await runStudentCode(currentWorld, source);
      const last = result.snapshots[result.snapshots.length - 1]?.world ?? currentWorld;
      setLogs(
        result.logs.length ? result.logs : [{ level: "info", text: "Program finished." }],
      );
      if (mode === "submit") {
        setGrade(result.error ? { passed: false, message: result.error } : currentLesson.grade(last));
      } else if (!result.error && currentLesson.grade(last).passed) {
        setLogs((prev) => [...prev, { level: "success", text: "Goal reached. Try Submit!" }]);
      }
      playSnapshots(result.snapshots, Boolean(result.error));
    } catch (err) {
      setLogs([{ level: "error", text: err instanceof Error ? err.message : String(err) }]);
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }, [pythonReady, persist]);

  const closeTutor = useCallback(() => {
    tutorOpenRef.current = false;
    setTutorOpen(false);
    setTutorHint(null);
    setTutorError(null);
  }, []);

  const explain = useCallback(async () => {
    if (explaining) return;
    tutorOpenRef.current = true;
    setTutorOpen(true);
    setExplaining(true);
    setTutorHint(null);
    setTutorError(null);
    const currentLesson = lessonRef.current;
    const source = readEditorValue(codeRef.current);
    persist(source, currentLesson.id, true);
    try {
      const hint = await requestHint({
        lesson: currentLesson,
        initialWorld: lessonWorld(currentLesson),
        currentWorld: world,
        studentCode: source,
        logs,
        grade,
      });
      if (!tutorOpenRef.current) return;
      setTutorHint(hint);
    } catch (err) {
      if (!tutorOpenRef.current) return;
      setTutorHint(null);
      setTutorError(err instanceof Error ? err.message : String(err));
    } finally {
      setExplaining(false);
    }
  }, [explaining, persist, world, logs, grade]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault();
        void execute("run");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [execute]);

  useEffect(() => () => stopPlay(), []);

  const inventory = `${world.robot.leafs} leaves · stone ${world.robot.stone ? "1" : "0"} · ${world.robot.dir}`;

  return (
    <div className={`app${resizing ? " is-resizing" : ""}`}>
      {resizing ? <div className="resize-overlay" /> : null}
      <TopBar
        lessons={LESSONS}
        lesson={lesson}
        engineReady={pythonReady}
        engineReadyLabel="Python ready"
        engineLoadingLabel="Loading Python"
        busy={busy}
        product="RoboWorld"
        track={track}
        onTrack={onTrack}
        onSelect={setLessonId}
        onRun={() => void execute("run")}
        onSubmit={() => void execute("submit")}
        onExplain={() => void explain()}
        explaining={explaining}
        onReset={() => {
          persist(lesson.skeleton, lesson.id, true);
          const editor = (
            window as unknown as {
              monaco?: { editor?: { getEditors?: () => { setValue: (v: string) => void }[] } };
            }
          ).monaco?.editor?.getEditors?.()[0];
          editor?.setValue(lesson.skeleton);
          setWorld(cloneWorld(initialWorld));
          setLogs([]);
          setGrade(null);
          setCrashed(false);
          stopPlay();
        }}
      />
      <div className={`workspace${problemOpen ? "" : " problem-collapsed"}`}>
        {problemOpen ? (
          <aside className="pane problem-pane">
            <ProblemPanel
              lesson={lesson}
              hintOpen={hintOpen}
              onToggleHint={() => setHintOpen((v) => !v)}
            />
          </aside>
        ) : null}
        <button
          type="button"
          className="collapse"
          onClick={() => setProblemOpen((v) => !v)}
          title={problemOpen ? "Hide problem" : "Show problem"}
        >
          {problemOpen ? "‹" : "›"}
        </button>
        <section className="pane editor-wrap">
          <EditorPane
            key={`en-${lesson.id}`}
            source={withoutHangul(editorSource, lesson.skeleton)}
            onChange={persist}
          />
          <div
            className="console-split"
            role="separator"
            aria-orientation="horizontal"
            aria-label="Resize console"
            onPointerDown={onSplitDown}
          >
            <span />
          </div>
          <ConsolePane lines={logs} height={consoleH} />
        </section>
        <section className="pane sim-pane">
          <div className="sim-head">
            <div>
              <strong>RoboWorld</strong>
              <span className="sim-sub">{inventory}</span>
            </div>
            <label className="speed">
              Speed
              <input
                type="range"
                min="0.5"
                max="3"
                step="0.5"
                value={speed}
                onChange={(e) => setSpeed(Number(e.target.value))}
              />
              <span>{speed.toFixed(1)}x</span>
            </label>
          </div>
          <div className="sim-body">
            <Simulator world={world} crashed={crashed} animMs={Math.max(90, 420 / speed)} />
            {grade ? (
              <div className={`grade${grade.passed ? " is-pass" : " is-fail"}`}>
                <b>{grade.passed ? "Passed" : "Failed"}</b>
                <span>{grade.message}</span>
              </div>
            ) : null}
          </div>
          <div className="legend">
            <span>
              <i className="lg wall" /> Wall
            </span>
            <span>
              <i className="lg empty" /> Empty
            </span>
            <span>
              <i className="lg leaf" /> Leaf
            </span>
            <span>
              <i className="lg stone" /> Stone
            </span>
            <span>
              <i className="lg goal" /> Goal
            </span>
            <span>
              <i className="lg robo" /> Robo
            </span>
          </div>
        </section>
      </div>
      <TutorModal
        open={tutorOpen}
        loading={explaining}
        hint={tutorHint}
        error={tutorError}
        onClose={closeTutor}
      />
    </div>
  );
}
