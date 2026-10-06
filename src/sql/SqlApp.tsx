import { useCallback, useEffect, useRef, useState, type PointerEvent } from "react";
import { ConsolePane } from "../components/ConsolePane";
import { EditorPane } from "../components/EditorPane";
import { ProblemPanel } from "../components/ProblemPanel";
import { SchemaPane } from "../components/SchemaPane";
import { TopBar } from "../components/TopBar";
import { TutorModal } from "../components/TutorModal";
import type { GradeResult, LogLine } from "../engine/types";
import type { Track } from "../track";
import { requestSqlHint } from "./explainSql";
import { lessonTables, LIBRARY_SCHEMA, SQL_LESSONS, SQL_REFERENCE, type SqlLesson } from "./lessons";
import { executeSql, loadSql } from "./runSql";
import type { SqlCell, SqlTable } from "./types";

const CODE_KEY = "elice-sql-code";

type QueryResult = {
  columns: string[];
  rows: SqlCell[][];
};

function loadSavedCode() {
  try {
    const raw = localStorage.getItem(CODE_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as Record<string, string>;
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

export function SqlApp({ track = "sql", onTrack }: Props) {
  const [lessonId, setLessonId] = useState(SQL_LESSONS[0].id);
  const lesson = SQL_LESSONS.find((item) => item.id === lessonId) ?? SQL_LESSONS[0];
  const [editorSource, setEditorSource] = useState(
    () => loadSavedCode()[SQL_LESSONS[0].id] ?? SQL_LESSONS[0].skeleton,
  );
  const [sqlReady, setSqlReady] = useState(false);
  const [engineFailed, setEngineFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [logs, setLogs] = useState<LogLine[]>([]);
  const [grade, setGrade] = useState<GradeResult | null>(null);
  const [hintOpen, setHintOpen] = useState(false);
  const [tables, setTables] = useState<SqlTable[]>([]);
  const [result, setResult] = useState<QueryResult | null>(null);
  const [ran, setRan] = useState(false);
  const [problemOpen, setProblemOpen] = useState(true);
  const [consoleH, setConsoleH] = useState(168);
  const [resizing, setResizing] = useState(false);
  const [explaining, setExplaining] = useState(false);
  const [tutorOpen, setTutorOpen] = useState(false);
  const [tutorHint, setTutorHint] = useState<string | null>(null);
  const [tutorError, setTutorError] = useState<string | null>(null);

  const dragRef = useRef<{ startY: number; startH: number } | null>(null);
  const busyRef = useRef(false);
  const codeRef = useRef(editorSource);
  const lessonRef = useRef(lesson);
  const outputRef = useRef<QueryResult & { tables: SqlTable[] } | null>(null);
  const saveTimer = useRef<number | null>(null);
  const mounted = useRef(true);
  const tutorOpenRef = useRef(false);
  lessonRef.current = lesson;

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      const source = readEditorValue(codeRef.current);
      const stored = loadSavedCode();
      stored[lessonRef.current.id] = source;
      localStorage.setItem(CODE_KEY, JSON.stringify(stored));
    };
  }, []);

  useEffect(() => {
    document.body.classList.remove("is-resizing");
    const onMove = (event: globalThis.PointerEvent) => {
      const drag = dragRef.current;
      if (!drag) return;
      event.preventDefault();
      setConsoleH(Math.min(420, Math.max(72, drag.startH + (drag.startY - event.clientY))));
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

  function onSplitDown(event: PointerEvent<HTMLDivElement>) {
    event.preventDefault();
    dragRef.current = { startY: event.clientY, startH: consoleH };
    setResizing(true);
  }

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

  const markReady = useCallback(() => {
    setSqlReady(true);
    setEngineFailed(false);
  }, []);

  const showTables = useCallback(async () => {
    const output = await executeSql(LIBRARY_SCHEMA, "");
    if (!mounted.current) return;
    if (output.error) {
      setLogs([{ level: "error", text: output.error }]);
      return;
    }
    markReady();
    setTables(output.tables);
  }, [markReady]);

  useEffect(() => {
    let cancel = false;
    (async () => {
      try {
        await loadSql();
      } catch {
        try {
          await loadSql();
        } catch (err: unknown) {
          if (cancel || !mounted.current) return;
          setEngineFailed(true);
          setLogs([
            {
              level: "error",
              text: `Could not load the SQL engine: ${err instanceof Error ? err.message : String(err)}`,
            },
          ]);
          return;
        }
      }
      if (!cancel && mounted.current) markReady();
    })();
    return () => {
      cancel = true;
    };
  }, [markReady]);

  useEffect(() => {
    if (!sqlReady) return;
    let cancel = false;
    executeSql(LIBRARY_SCHEMA, "")
      .then((output) => {
        if (cancel || !mounted.current) return;
        if (output.error) {
          setLogs([{ level: "error", text: output.error }]);
          return;
        }
        setTables(output.tables);
      })
      .catch((err: unknown) => {
        if (cancel || !mounted.current) return;
        setLogs([
          {
            level: "error",
            text: err instanceof Error ? err.message : String(err),
          },
        ]);
      });
    return () => {
      cancel = true;
    };
  }, [lesson.id, sqlReady]);

  useEffect(() => {
    const stored = loadSavedCode();
    const source = stored[lesson.id] ?? lesson.skeleton;
    codeRef.current = source;
    setEditorSource(source);
    setLogs([]);
    setGrade(null);
    setHintOpen(false);
    setResult(null);
    setRan(false);
    outputRef.current = null;
    tutorOpenRef.current = false;
    setTutorOpen(false);
    setTutorHint(null);
    setTutorError(null);
  }, [lesson.id, lesson.skeleton]);

  const execute = useCallback(async (mode: "run" | "submit") => {
    if (busyRef.current) return;
    const currentLesson: SqlLesson = lessonRef.current;
    const source = readEditorValue(codeRef.current);
    persist(source, currentLesson.id, true);

    busyRef.current = true;
    setBusy(true);
    setGrade(null);
    setLogs([{ level: "info", text: mode === "run" ? "Running…" : "Grading…" }]);
    try {
      const output = await executeSql(LIBRARY_SCHEMA, source);
      if (!mounted.current) return;
      if (output.tables.length) {
        markReady();
        setTables(output.tables);
      }
      if (output.error) {
        setResult(null);
        setRan(false);
        outputRef.current = null;
        setLogs([{ level: "error", text: output.error }]);
        if (mode === "submit") setGrade({ passed: false, message: output.error });
        return;
      }

      const nextResult = { columns: output.columns, rows: output.rows };
      setResult(nextResult);
      setRan(true);
      outputRef.current = { ...nextResult, tables: output.tables };

      const lines: LogLine[] = [];
      if (output.resultCount > 1) {
        lines.push({ level: "info", text: "Several results came back. Submit checks the last one." });
      }
      if (output.columns.length) {
        const count = output.rows.length;
        lines.push({ level: "info", text: `${count} ${count === 1 ? "row" : "rows"} returned.` });
      } else {
        lines.push({ level: "info", text: "Statement finished." });
      }
      const verdict = currentLesson.grade(output);
      if (mode === "submit") setGrade(verdict);
      else if (verdict.passed) lines.push({ level: "success", text: "Goal reached. Try Submit!" });
      setLogs(lines);
    } catch (err) {
      if (!mounted.current) return;
      setLogs([{ level: "error", text: err instanceof Error ? err.message : String(err) }]);
    } finally {
      busyRef.current = false;
      if (mounted.current) setBusy(false);
    }
  }, [markReady, persist]);

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
      const hint = await requestSqlHint({
        lesson: currentLesson,
        schemaSql: LIBRARY_SCHEMA,
        output: outputRef.current,
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
  }, [explaining, grade, logs, persist]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
        event.preventDefault();
        void execute("run");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [execute]);

  function selectLesson(id: string) {
    persist(readEditorValue(codeRef.current), lessonRef.current.id, true);
    setLessonId(id);
  }

  const visibleTables = lesson.focus
    .map((name) => tables.find((table) => table.name === name))
    .filter((table): table is SqlTable => Boolean(table));

  return (
    <div className={`app${resizing ? " is-resizing" : ""}`}>
      {resizing ? <div className="resize-overlay" /> : null}
      <TopBar
        lessons={SQL_LESSONS}
        lesson={lesson}
        engineReady={sqlReady}
        engineReadyLabel="SQL ready"
        engineLoadingLabel={engineFailed ? "SQL failed" : "Loading SQL"}
        actionsEnabled
        busy={busy}
        product="SQL Lab"
        track={track}
        onTrack={onTrack ?? (() => {})}
        onSelect={selectLesson}
        onRun={() => void execute("run")}
        onSubmit={() => void execute("submit")}
        onExplain={() => void explain()}
        explaining={explaining}
        onReset={() => {
          persist(lesson.skeleton, lesson.id, true);
          const editor = (
            window as unknown as {
              monaco?: { editor?: { getEditors?: () => { setValue: (value: string) => void }[] } };
            }
          ).monaco?.editor?.getEditors?.()[0];
          editor?.setValue(lesson.skeleton);
          setLogs([]);
          setGrade(null);
          setResult(null);
          setRan(false);
          outputRef.current = null;
          void showTables();
        }}
      />
      <div className={`workspace${problemOpen ? "" : " problem-collapsed"}`}>
        {problemOpen ? (
          <aside className="pane problem-pane">
            <ProblemPanel
              lesson={lesson}
              hintOpen={hintOpen}
              onToggleHint={() => setHintOpen((open) => !open)}
              tables={lessonTables(lesson)}
              referenceTitle="SQL"
              reference={SQL_REFERENCE}
            />
          </aside>
        ) : null}
        <button
          type="button"
          className="collapse"
          onClick={() => setProblemOpen((open) => !open)}
          title={problemOpen ? "Hide problem" : "Show problem"}
        >
          {problemOpen ? "‹" : "›"}
        </button>
        <section className="pane editor-wrap">
          <EditorPane
            key={`sql-${lesson.id}`}
            source={editorSource}
            onChange={persist}
            language="sql"
            fileName="query.sql"
            tabSize={2}
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
              <strong>{ran ? "After your query" : "Starting data"}</strong>
              <span className="sim-sub">
                {visibleTables.length} {visibleTables.length === 1 ? "table" : "tables"}
              </span>
            </div>
          </div>
          <SchemaPane
            tables={visibleTables}
            result={result}
            ran={ran}
            grade={grade}
            loading={!sqlReady && !engineFailed}
          />
        </section>
      </div>
      <TutorModal
        open={tutorOpen}
        loading={explaining}
        hint={tutorHint}
        error={tutorError}
        loadingText="Looking at your query and tables…"
        onClose={closeTutor}
      />
    </div>
  );
}
