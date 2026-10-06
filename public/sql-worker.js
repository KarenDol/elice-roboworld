let bootError = "";

try {
  importScripts("https://cdn.jsdelivr.net/npm/sql.js@1.12.0/dist/sql-wasm.js");
  if (typeof initSqlJs !== "function") bootError = "SQL engine did not start.";
} catch {
  bootError = "Could not load the SQL engine.";
}

let sqlPromise = null;

function ensureSql() {
  if (!sqlPromise) {
    sqlPromise = initSqlJs({
      locateFile: (file) => `https://cdn.jsdelivr.net/npm/sql.js@1.12.0/dist/${file}`,
    });
  }
  return sqlPromise;
}

function errorText(err) {
  if (!err) return "SQL error";
  if (typeof err === "string") return err;
  if (typeof err.message === "string" && err.message) return err.message;
  return String(err);
}

function dump(db) {
  const master = db.exec(
    "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name",
  );
  if (!master.length) return [];
  return master[0].values.map((row) => {
    const name = String(row[0]);
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) return { name, columns: [], rows: [] };
    const result = db.exec(`SELECT * FROM "${name}"`);
    const table = result[0];
    return {
      name,
      columns: table ? table.columns : [],
      rows: table ? table.values : [],
    };
  });
}

self.onmessage = async (event) => {
  const { id, type, schema, sql } = event.data || {};
  if (bootError) {
    self.postMessage({ id, error: bootError, columns: [], rows: [], tables: [], resultCount: 0 });
    return;
  }

  try {
    const SQL = await ensureSql();
    if (type === "init") {
      self.postMessage({ id, ready: true });
      return;
    }

    const db = new SQL.Database();
    try {
      db.run(schema || "");
    } catch (err) {
      db.close();
      self.postMessage({
        id,
        error: errorText(err),
        columns: [],
        rows: [],
        tables: [],
        resultCount: 0,
      });
      return;
    }

    let sets = [];
    const student = typeof sql === "string" ? sql.trim() : "";
    if (student) {
      try {
        sets = db.exec(student);
      } catch (err) {
        db.close();
        const fresh = new SQL.Database();
        try {
          fresh.run(schema || "");
          const tables = dump(fresh);
          fresh.close();
          self.postMessage({
            id,
            error: errorText(err),
            columns: [],
            rows: [],
            tables,
            resultCount: 0,
          });
        } catch (schemaErr) {
          fresh.close();
          self.postMessage({
            id,
            error: errorText(err),
            columns: [],
            rows: [],
            tables: [],
            resultCount: 0,
            schemaError: errorText(schemaErr),
          });
        }
        return;
      }
    }

    if (student && sets.length === 0) {
      const stripped = student.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/--[^\n]*/g, " ").trim();
      const statements = stripped.split(";").map((part) => part.trim()).filter(Boolean);
      const lastStatement = statements[statements.length - 1] || "";
      if (/^(select|with)\b/i.test(lastStatement)) {
        try {
          const stmt = db.prepare(lastStatement);
          const columns = stmt.getColumnNames();
          const rows = [];
          while (stmt.step()) rows.push(stmt.get());
          stmt.free();
          if (columns.length) sets = [{ columns, values: rows }];
        } catch {
          // Keep the exec result when the statement cannot be prepared on its own.
        }
      }
    }

    const tables = dump(db);
    db.close();
    const last = sets[sets.length - 1];
    self.postMessage({
      id,
      columns: last ? last.columns : [],
      rows: last ? last.values : [],
      tables,
      resultCount: sets.length,
    });
  } catch (err) {
    self.postMessage({
      id,
      error: errorText(err),
      columns: [],
      rows: [],
      tables: [],
      resultCount: 0,
    });
  }
};
