import type { GradeResult } from "../engine/types";
import type { SqlCell, SqlOutput, SqlTable } from "./types";

function columnIndex(table: SqlTable, name: string) {
  return table.columns.findIndex((column) => column.toLowerCase() === name.toLowerCase());
}

function sameColumns(actual: string[], expected: string[]) {
  return (
    actual.length === expected.length &&
    actual.every((column, index) => column.toLowerCase() === expected[index].toLowerCase())
  );
}

function rowKey(row: SqlCell[]) {
  return row.map((cell) => (cell === null ? "∅" : String(cell))).join("\u0001");
}

export function expectQuery(
  output: SqlOutput,
  columns: string[],
  rows: SqlCell[][],
  orderMatters: boolean,
  success: string,
): GradeResult {
  if (output.columns.length === 0) {
    return { passed: false, message: "Your query did not return a table." };
  }
  if (!sameColumns(output.columns, columns)) {
    return {
      passed: false,
      message: `Expected columns ${columns.join(", ")}. Got ${output.columns.join(", ")}.`,
    };
  }

  const actualKeys = output.rows.map(rowKey);
  const expectedKeys = rows.map(rowKey);
  const sortedActual = [...actualKeys].sort();
  const sortedExpected = [...expectedKeys].sort();
  const sameRows =
    actualKeys.length === expectedKeys.length &&
    sortedActual.every((row, index) => row === sortedExpected[index]);

  if (sameRows && orderMatters && actualKeys.some((row, index) => row !== expectedKeys[index])) {
    return { passed: false, message: "Right rows, wrong order. Sort the result." };
  }
  if (!sameRows) {
    if (actualKeys.length !== expectedKeys.length) {
      return {
        passed: false,
        message: `Expected ${expectedKeys.length} rows, got ${actualKeys.length}.`,
      };
    }
    return { passed: false, message: "Some row values do not match." };
  }
  return { passed: true, message: success };
}

export function gradeAmina(output: SqlOutput): GradeResult {
  const students = output.tables.find((table) => table.name === "students");
  if (!students) return { passed: false, message: "The students table is missing." };
  if (students.rows.length === 0) {
    return { passed: false, message: "The students table is empty. Add Amina and keep the original rows." };
  }

  const nameCol = columnIndex(students, "name");
  const yearCol = columnIndex(students, "year");
  const cityCol = columnIndex(students, "city");
  if (nameCol < 0 || yearCol < 0 || cityCol < 0) {
    return { passed: false, message: "students needs name, year, and city columns." };
  }

  const amina = students.rows.filter((row) => row[nameCol] === "Amina");
  if (amina.length === 0) return { passed: false, message: "No student named Amina yet." };
  if (amina.length > 1) return { passed: false, message: "Add Amina only once." };
  if (Number(amina[0][yearCol]) !== 1 || amina[0][cityCol] !== "Karaganda") {
    return { passed: false, message: "Amina should be in year 1 and live in Karaganda." };
  }
  if (students.rows.length !== 6) {
    return { passed: false, message: "Keep the original 5 students and add only Amina (6 rows)." };
  }

  const names = new Set(students.rows.map((row) => String(row[nameCol])));
  for (const name of ["Aigerim", "Bekzat", "Dana", "Erlan", "Fariza"]) {
    if (!names.has(name)) return { passed: false, message: `Keep ${name} in the table.` };
  }
  return { passed: true, message: "Correct! Amina is in the students table." };
}

export function gradeLoanReturned(output: SqlOutput): GradeResult {
  const loans = output.tables.find((table) => table.name === "loans");
  if (!loans) return { passed: false, message: "The loans table is missing." };
  if (loans.rows.length === 0) return { passed: false, message: "The loans table is empty. Do not delete rows." };

  const idCol = columnIndex(loans, "id");
  const returnedCol = columnIndex(loans, "returned");
  if (idCol < 0 || returnedCol < 0) {
    return { passed: false, message: "loans needs id and returned columns." };
  }
  if (loans.rows.length !== 4) return { passed: false, message: "Leave all 4 loans in the table." };

  const byId = new Map<number, number>();
  for (const row of loans.rows) byId.set(Number(row[idCol]), Number(row[returnedCol]));

  if (byId.get(1) !== 1) return { passed: false, message: "Mark loan 1 as returned." };
  if (byId.get(2) !== 1 || byId.get(3) !== 0 || byId.get(4) !== 0) {
    return { passed: false, message: "Only change loan 1. Leave the other loans as they are." };
  }
  return { passed: true, message: "Correct! Loan 1 is returned." };
}
