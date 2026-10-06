import type { GradeResult, LogLine } from "../engine/types";
import type { SqlLesson } from "./lessons";
import { SQL_REFERENCE } from "./lessons";
import type { SqlOutput } from "./types";

function formatOutput(output: SqlOutput) {
  if (output.columns.length === 0) return "(no result table)";
  const header = output.columns.join(" | ");
  const body = output.rows
    .map((row) => row.map((cell) => (cell === null ? "NULL" : String(cell))).join(" | "))
    .join("\n");
  return `${header}\n${body || "(no rows)"}`;
}

export async function requestSqlHint(input: {
  lesson: SqlLesson;
  schemaSql: string;
  output: SqlOutput | null;
  studentCode: string;
  logs: LogLine[];
  grade: GradeResult | null;
}) {
  const response = await fetch("/api/explain", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      track: "sql",
      lessonTitle: input.lesson.title,
      lessonIndex: input.lesson.index,
      goal: input.lesson.goal,
      instructions: input.lesson.instructions,
      professorGuide: input.lesson.hint,
      apiReference: SQL_REFERENCE.map((item) => `${item.code} — ${item.label}`).join("\n"),
      schemaSql: input.schemaSql.trim(),
      resultPreview: input.output ? formatOutput(input.output) : "(not run yet)",
      studentCode: input.studentCode,
      consoleLog: input.logs.map((line) => line.text).join("\n"),
      lastGrade: input.grade ? `${input.grade.passed ? "Passed" : "Failed"} — ${input.grade.message}` : null,
    }),
  });
  const data = (await response.json()) as { hint?: string; error?: string };
  if (!response.ok || !data.hint) {
    throw new Error(data.error || `Explain failed (${response.status})`);
  }
  return data.hint;
}
