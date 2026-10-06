import type { SqlCell, SqlRunResult, SqlTable } from "./types";

type WorkerResponse = {
  id: number;
  ready?: boolean;
  error?: string;
  columns?: unknown[];
  rows?: unknown[][];
  tables?: { name: string; columns: string[]; rows: unknown[][] }[];
  resultCount?: number;
};

let worker: Worker | null = null;
let seq = 0;
const pending = new Map<number, {
  resolve: (value: WorkerResponse) => void;
  reject: (reason: Error) => void;
  timer: number;
}>();

function normalizeCell(value: unknown): SqlCell {
  if (value == null) return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : String(value);
  if (typeof value === "string") return value;
  if (typeof value === "bigint") return Number(value);
  if (value instanceof Uint8Array) return new TextDecoder().decode(value);
  return String(value);
}

function normalizeTable(table: { name: string; columns: string[]; rows: unknown[][] }): SqlTable {
  return {
    name: table.name,
    columns: table.columns,
    rows: table.rows.map((row) => row.map(normalizeCell)),
  };
}

function failPending(error: Error) {
  for (const [id, item] of pending) {
    window.clearTimeout(item.timer);
    pending.delete(id);
    item.reject(error);
  }
}

function getWorker() {
  if (worker) return worker;
  worker = new Worker("/sql-worker.js");
  worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
    const item = pending.get(event.data.id);
    if (!item) return;
    window.clearTimeout(item.timer);
    pending.delete(event.data.id);
    item.resolve(event.data);
  };
  worker.onerror = (event) => {
    event.preventDefault();
    const message = event.message && event.message !== "Script error."
      ? event.message
      : "The SQL engine stopped.";
    const failed = worker;
    worker = null;
    failed?.terminate();
    failPending(new Error(message));
  };
  return worker;
}

function callWorker(payload: { type: "init" | "exec"; schema?: string; sql?: string }, timeoutMs: number) {
  const id = ++seq;
  const engine = getWorker();
  return new Promise<WorkerResponse>((resolve, reject) => {
    const timer = window.setTimeout(() => {
      pending.delete(id);
      engine.terminate();
      worker = null;
      reject(
        new Error(
          payload.type === "init"
            ? "The SQL engine took too long to load."
            : "That query took too long. Simplify it and try again.",
        ),
      );
    }, timeoutMs);
    pending.set(id, { resolve, reject, timer });
    engine.postMessage({ id, ...payload });
  });
}

let readyPromise: Promise<void> | null = null;

export function loadSql() {
  if (!readyPromise) {
    const attempt = callWorker({ type: "init" }, 20000).then((response) => {
      if (response.error) throw new Error(response.error);
    });
    readyPromise = attempt;
    attempt.catch(() => {
      if (readyPromise === attempt) readyPromise = null;
    });
  }
  return readyPromise;
}

export async function executeSql(schema: string, sql: string): Promise<SqlRunResult> {
  if (sql.length > 4000) {
    return {
      error: "That query is too long.",
      columns: [],
      rows: [],
      tables: [],
      resultCount: 0,
    };
  }
  await loadSql();
  const response = await callWorker({ type: "exec", schema, sql }, 15000);
  return {
    error: response.error,
    columns: (response.columns ?? []).map((column) => String(column)),
    rows: (response.rows ?? []).map((row) => row.map(normalizeCell)),
    tables: (response.tables ?? []).map(normalizeTable),
    resultCount: response.resultCount ?? 0,
  };
}
