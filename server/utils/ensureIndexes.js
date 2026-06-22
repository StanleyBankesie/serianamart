function getQueryFn(db) {
  return db && typeof db.query === "function" ? db.query.bind(db) : null;
}

async function loadExistingIndexes(q) {
  const rows = await q(
    `SELECT s.table_name, s.index_name, s.column_name, s.seq_in_index
     FROM information_schema.STATISTICS s
     WHERE s.table_schema = DATABASE()
     ORDER BY s.table_name, s.index_name, s.seq_in_index`,
  );
  const map = {};
  for (const r of rows) {
    if (!map[r.table_name]) map[r.table_name] = {};
    if (!map[r.table_name][r.index_name]) map[r.table_name][r.index_name] = [];
    map[r.table_name][r.index_name].push(r.column_name);
  }
  return map;
}

function isColumnCovered(tableIndexes, column) {
  for (const cols of Object.values(tableIndexes)) {
    if (cols.includes(column)) return true;
  }
  return false;
}

function isPrefixCovered(tableIndexes, columns) {
  for (const cols of Object.values(tableIndexes)) {
    if (cols.length < columns.length) continue;
    let match = true;
    for (let i = 0; i < columns.length; i++) {
      if (cols[i] !== columns[i]) { match = false; break; }
    }
    if (match) return true;
  }
  return false;
}

export async function ensureIndexes(db) {
  const q = getQueryFn(db) || (await import("../db/pool.js")).query;

  const tables = await q(
    `SELECT table_name
     FROM information_schema.tables
     WHERE table_schema = DATABASE()
       AND table_type = 'BASE TABLE'
       AND table_name NOT LIKE 'v\_%'
     ORDER BY table_name`,
  );

  const columns = await q(
    `SELECT c.table_name, c.column_name
     FROM information_schema.columns c
     JOIN information_schema.tables t
       ON t.table_schema = c.table_schema AND t.table_name = c.table_name
     WHERE c.table_schema = DATABASE()
       AND t.table_type = 'BASE TABLE'
       AND c.table_name NOT LIKE 'v\_%'
     ORDER BY c.table_name, c.ordinal_position`,
  );

  const existingIndexes = await loadExistingIndexes(q);

  const tableCols = {};
  for (const row of columns) {
    if (!tableCols[row.table_name]) tableCols[row.table_name] = new Set();
    tableCols[row.table_name].add(row.column_name);
  }

  let created = 0;

  for (const { table_name } of tables) {
    const cols = tableCols[table_name];
    if (!cols) continue;

    const tblIdx = existingIndexes[table_name] || {};

    const candidates = [];

    // company_id + branch_id composite
    if (cols.has("company_id") && cols.has("branch_id")) {
      if (!isPrefixCovered(tblIdx, ["company_id", "branch_id"])) {
        candidates.push({ name: `idx_${table_name}_co_br`, columns: ["company_id", "branch_id"] });
      }
    } else if (cols.has("company_id")) {
      if (!isColumnCovered(tblIdx, "company_id")) {
        candidates.push({ name: `idx_${table_name}_company`, columns: ["company_id"] });
      }
    }

    // status column
    if (cols.has("status") && !isColumnCovered(tblIdx, "status")) {
      candidates.push({ name: `idx_${table_name}_status`, columns: ["status"] });
    }

    // created_at
    if (cols.has("created_at") && !isColumnCovered(tblIdx, "created_at")) {
      candidates.push({ name: `idx_${table_name}_created`, columns: ["created_at"] });
    }

    // is_active
    if (cols.has("is_active") && !isColumnCovered(tblIdx, "is_active")) {
      candidates.push({ name: `idx_${table_name}_active`, columns: ["is_active"] });
    }

    // is_deleted
    if (cols.has("is_deleted") && !isColumnCovered(tblIdx, "is_deleted")) {
      candidates.push({ name: `idx_${table_name}_del`, columns: ["is_deleted"] });
    }

    // deleted_at
    if (cols.has("deleted_at") && !isColumnCovered(tblIdx, "deleted_at")) {
      candidates.push({ name: `idx_${table_name}_deleted`, columns: ["deleted_at"] });
    }

    // Document number columns (*_no, *_code)
    for (const col of cols) {
      if (!col.endsWith("_no") && !col.endsWith("_code")) continue;
      if (col === "company_id" || col === "branch_id") continue;
      if (isColumnCovered(tblIdx, col)) continue;
      const safeLabel = col.replace(/[^a-z0-9_]/gi, "_");
      candidates.push({ name: `idx_${table_name}_${safeLabel}`, columns: [col] });
    }

    for (const { name, columns: colsArr } of candidates) {
      try {
        await q(
          `CREATE INDEX \`${name}\` ON \`${table_name}\` (${colsArr.join(", ")})`,
          {},
        );
        created++;
      } catch {
        // index may have been created concurrently or column may not support it
      }
    }
  }

  return created;
}
