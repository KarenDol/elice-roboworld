import type { GradeResult } from "../engine/types";
import type { SqlCell, SqlTable } from "../sql/types";

type Result = {
  columns: string[];
  rows: SqlCell[][];
};

type Props = {
  tables: SqlTable[];
  result: Result | null;
  ran: boolean;
  grade: GradeResult | null;
  loading: boolean;
};

function CellValue({ value }: { value: SqlCell }) {
  if (value === null) return <span className="data-null">NULL</span>;
  return <>{String(value)}</>;
}

function DataGrid({ columns, rows }: { columns: string[]; rows: SqlCell[][] }) {
  if (columns.length === 0) return <p className="sql-empty">Empty table.</p>;
  return (
    <table className="data-table">
      <thead>
        <tr>
          {columns.map((column) => (
            <th key={column} scope="col">
              {column}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.length === 0 ? (
          <tr>
            <td colSpan={columns.length} className="data-null">
              No rows
            </td>
          </tr>
        ) : (
          rows.map((row, index) => (
            <tr key={`${index}-${row.map((cell) => String(cell)).join("|")}`}>
              {row.map((cell, cellIndex) => (
                <td key={`${columns[cellIndex]}-${index}`}>
                  <CellValue value={cell} />
                </td>
              ))}
            </tr>
          ))
        )}
      </tbody>
    </table>
  );
}

export function SchemaPane({ tables, result, ran, grade, loading }: Props) {
  return (
    <div className="sim-body is-sql">
      {grade ? (
        <div className={`grade is-inline${grade.passed ? " is-pass" : " is-fail"}`}>
          <b>{grade.passed ? "Passed" : "Failed"}</b>
          <span>{grade.message}</span>
        </div>
      ) : null}
      {ran && result ? (
        <article className="sql-card is-result">
          <header>
            <span>Query result</span>
            <span>{result.columns.length ? `${result.rows.length} rows` : "No table"}</span>
          </header>
          {result.columns.length ? (
            <DataGrid columns={result.columns} rows={result.rows} />
          ) : (
            <p className="sql-empty">This statement did not return rows. The tables below show the database after it ran.</p>
          )}
        </article>
      ) : (
        <p className="sql-note">
          {loading
            ? "Loading the database…"
            : "Run a query to see its result. The tables below are the starting data."}
        </p>
      )}
      {tables.map((table) => (
        <article key={table.name} className="sql-card">
          <header>
            <span>{table.name}</span>
            <span>
              {table.rows.length} {table.rows.length === 1 ? "row" : "rows"}
            </span>
          </header>
          <DataGrid columns={table.columns} rows={table.rows} />
        </article>
      ))}
    </div>
  );
}
