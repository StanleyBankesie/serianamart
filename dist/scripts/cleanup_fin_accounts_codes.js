import { pool } from "../db/pool.js";

function isSixDigitNumeric(code) {
  return /^[0-9]{6}$/.test(String(code || ""));
}

function isFourDigitNumeric(code) {
  return /^[0-9]{4}$/.test(String(code || ""));
}

function toProposedFourDigit(code) {
  const s = String(code || "");
  return s.length >= 4 ? s.slice(0, 4) : s;
}

function padFourDigit(n) {
  return String(n).padStart(4, "0");
}

function findNextAvailableFourDigit(baseFourDigit, usedCodes) {
  const base = Number.parseInt(String(baseFourDigit || ""), 10);
  if (!Number.isFinite(base)) return null;
  for (let i = 0; i < 10000; i += 1) {
    const candidate = padFourDigit((base + i) % 10000);
    if (!usedCodes.has(candidate)) return candidate;
  }
  return null;
}

async function getReferencingFks(connection, schemaName) {
  const [rows] = await connection.query(
    `
      SELECT
        kcu.TABLE_NAME AS table_name,
        kcu.COLUMN_NAME AS column_name
      FROM information_schema.KEY_COLUMN_USAGE kcu
      WHERE kcu.TABLE_SCHEMA = ?
        AND kcu.REFERENCED_TABLE_NAME = 'fin_accounts'
        AND kcu.REFERENCED_COLUMN_NAME = 'id'
    `,
    [schemaName]
  );
  return Array.isArray(rows) ? rows : [];
}

async function remapAccountId(connection, fks, fromId, toId) {
  for (const fk of fks) {
    const table = fk.table_name;
    const column = fk.column_name;
    await connection.query(
      `UPDATE \`${table}\` SET \`${column}\` = ? WHERE \`${column}\` = ?`,
      [toId, fromId]
    );
  }
}

async function deleteAccountIfUnreferenced(connection, fks, accountId) {
  for (const fk of fks) {
    const table = fk.table_name;
    const column = fk.column_name;
    const [rows] = await connection.query(
      `SELECT 1 AS hit FROM \`${table}\` WHERE \`${column}\` = ? LIMIT 1`,
      [accountId]
    );
    if (Array.isArray(rows) && rows.length) return false;
  }
  await connection.query("DELETE FROM fin_accounts WHERE id = ?", [accountId]);
  return true;
}

async function main() {
  const apply = process.argv.includes("--apply");

  const connection = await pool.getConnection();
  try {
    const schemaName = connection.config?.database;
    if (!schemaName) {
      throw new Error("No database selected in pool configuration.");
    }

    const fks = await getReferencingFks(connection, schemaName);

    const [companyRows] = await connection.query(
      "SELECT DISTINCT company_id AS company_id FROM fin_accounts ORDER BY company_id ASC"
    );
    const companyIds = Array.isArray(companyRows)
      ? companyRows
          .map((r) => Number(r.company_id))
          .filter((n) => Number.isFinite(n))
      : [];

    const results = {
      deletedSixDigitDuplicates: 0,
      mergedSixDigitDuplicates: 0,
      updatedCodesToFourDigit: 0,
      reassignedCodesToAvoidConflicts: 0,
      reassignedCodeConflicts: [],
    };

    if (apply) {
      await connection.beginTransaction();
    }

    for (const companyId of companyIds) {
      const [accRows] = await connection.query(
        `
          SELECT id, company_id, code, name
          FROM fin_accounts
          WHERE company_id = ?
          ORDER BY id ASC
        `,
        [companyId]
      );
      const accounts = Array.isArray(accRows) ? accRows : [];

      const byName = new Map();
      const byCode = new Map();

      for (const a of accounts) {
        const id = Number(a.id);
        const code = String(a.code || "");
        const name = String(a.name || "");
        if (!byName.has(name)) byName.set(name, []);
        byName.get(name).push({ id, code, name });
        byCode.set(code, { id, code, name });
      }

      for (const [name, list] of byName.entries()) {
        const sixes = list.filter((a) => isSixDigitNumeric(a.code));
        const nonSixes = list.filter((a) => !isSixDigitNumeric(a.code));
        if (!sixes.length || !nonSixes.length) continue;

        const keep =
          nonSixes.find((a) => isFourDigitNumeric(a.code)) ||
          nonSixes.slice().sort((a, b) => a.id - b.id)[0];
        if (!keep) continue;

        for (const del of sixes) {
          if (apply) {
            await remapAccountId(connection, fks, del.id, keep.id);
            const deleted = await deleteAccountIfUnreferenced(
              connection,
              fks,
              del.id
            );
            if (deleted) results.deletedSixDigitDuplicates += 1;
            results.mergedSixDigitDuplicates += 1;
          } else {
            results.mergedSixDigitDuplicates += 1;
          }
        }
      }

      const [accRows2] = await connection.query(
        `
          SELECT id, company_id, code, name
          FROM fin_accounts
          WHERE company_id = ?
          ORDER BY id ASC
        `,
        [companyId]
      );
      const accounts2 = Array.isArray(accRows2) ? accRows2 : [];
      const codeToAcc = new Map();
      const usedCodes = new Set();
      const nameToAccs = new Map();

      for (const a of accounts2) {
        const id = Number(a.id);
        const code = String(a.code || "");
        const name = String(a.name || "");
        codeToAcc.set(code, { id, code, name });
        usedCodes.add(code);
        if (!nameToAccs.has(name)) nameToAccs.set(name, []);
        nameToAccs.get(name).push({ id, code, name });
      }

      for (const a of accounts2) {
        const id = Number(a.id);
        const code = String(a.code || "");
        const name = String(a.name || "");
        if (!isSixDigitNumeric(code)) continue;

        const proposed = toProposedFourDigit(code);
        if (!isFourDigitNumeric(proposed)) continue;

        const existing = codeToAcc.get(proposed);
        if (!existing) {
          if (apply) {
            await connection.query(
              "UPDATE fin_accounts SET code = ? WHERE id = ?",
              [proposed, id]
            );
          }
          results.updatedCodesToFourDigit += 1;
          usedCodes.delete(code);
          codeToAcc.delete(code);
          codeToAcc.set(proposed, { id, code: proposed, name });
          usedCodes.add(proposed);
          continue;
        }

        if (String(existing.name || "") === name) {
          if (apply) {
            await remapAccountId(connection, fks, id, existing.id);
            const deleted = await deleteAccountIfUnreferenced(
              connection,
              fks,
              id
            );
            if (deleted) results.deletedSixDigitDuplicates += 1;
            results.mergedSixDigitDuplicates += 1;
          } else {
            results.mergedSixDigitDuplicates += 1;
          }
          continue;
        }

        const reassigned = findNextAvailableFourDigit(proposed, usedCodes);
        if (!reassigned) {
          throw new Error(
            `No available 4-digit codes for company ${companyId} while processing account ${id} (${code} ${name}).`
          );
        }

        if (apply) {
          await connection.query(
            "UPDATE fin_accounts SET code = ? WHERE id = ?",
            [reassigned, id]
          );
        }

        results.updatedCodesToFourDigit += 1;
        results.reassignedCodesToAvoidConflicts += 1;
        results.reassignedCodeConflicts.push({
          companyId,
          accountId: id,
          accountCode: code,
          accountName: name,
          proposedCode: proposed,
          reassignedCode: reassigned,
          conflictingAccountId: existing.id,
          conflictingAccountCode: existing.code,
          conflictingAccountName: existing.name,
        });

        usedCodes.delete(code);
        codeToAcc.delete(code);
        codeToAcc.set(reassigned, { id, code: reassigned, name });
        usedCodes.add(reassigned);
      }
    }

    if (apply) {
      await connection.commit();
    }

    console.log(JSON.stringify({ apply, results }, null, 2));
  } catch (err) {
    try {
      if (process.argv.includes("--apply")) {
        await connection.rollback();
      }
    } catch {}
    console.error(err?.message || String(err));
    process.exitCode = 1;
  } finally {
    connection.release();
    await pool.end();
  }
}

main();
