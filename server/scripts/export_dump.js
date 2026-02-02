import mysql from "mysql2/promise";
import mysqlCore from "mysql2";
import dotenv from "dotenv";
import fs from "fs/promises";
import path from "path";
dotenv.config({ path: path.join(process.cwd(), ".env") });
async function exportDump() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    rowsAsArray: false,
  });
  const dbName = process.env.DB_NAME;
  const lines = [];
  lines.push("-- OMNISUITE schema+data export");
  lines.push("SET NAMES utf8mb4;");
  lines.push("SET collation_connection = 'utf8mb4_unicode_ci';");
  lines.push("SET FOREIGN_KEY_CHECKS = 0;");
  lines.push(`-- Database: ${dbName}`);
  const [tables] = await conn.query("SHOW TABLES");
  const tableKey = `Tables_in_${dbName}`;
  const tableNames = tables
    .map((r) => r[tableKey] || Object.values(r)[0])
    .filter(Boolean);
  for (const t of tableNames) {
    const [createRows] = await conn.query(`SHOW CREATE TABLE \`${t}\``);
    const createSqlRaw = createRows[0]["Create Table"];
    const createSql = createSqlRaw.replace(
      /utf8mb4_0900_ai_ci/gi,
      "utf8mb4_unicode_ci",
    );
    lines.push(`DROP TABLE IF EXISTS \`${t}\`;`);
    lines.push(createSql + ";");
    const [rows] = await conn.query(`SELECT * FROM \`${t}\``);
    if (rows.length > 0) {
      const cols = Object.keys(rows[0]);
      const header = `INSERT INTO \`${t}\` (${cols.map((c) => `\`${c}\``).join(", ")}) VALUES`;
      const valueLines = rows.map((row) => {
        const vals = cols.map((c) => mysqlCore.escape(row[c]));
        return `(${vals.join(", ")})`;
      });
      lines.push(header + "\n" + valueLines.join(",\n") + ";");
    }
  }
  lines.push("SET FOREIGN_KEY_CHECKS = 1;");
  lines.push("SET collation_connection = 'utf8mb4_unicode_ci';");
  const outPath = path.resolve(process.cwd(), "../Dump.sql");
  await fs.writeFile(outPath, lines.join("\n"), "utf8");
  await conn.end();
  process.stdout.write(outPath);
}
exportDump().catch((e) => {
  process.stderr.write(String(e && e.message ? e.message : e));
  process.exit(1);
});
