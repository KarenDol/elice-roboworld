export type SqlCell = string | number | null;

export type SqlTable = {
  name: string;
  columns: string[];
  rows: SqlCell[][];
};

export type SqlOutput = {
  columns: string[];
  rows: SqlCell[][];
  tables: SqlTable[];
};

export type SqlRunResult = SqlOutput & {
  error?: string;
  resultCount: number;
};
