import { query } from "../db/pool.js";

async function hasColumn(tableName, columnName) {
  const rows = await query(
    `
    SELECT COUNT(*) AS c
    FROM information_schema.columns
    WHERE table_schema = DATABASE()
      AND table_name = :tableName
      AND column_name = :columnName
    `,
    { tableName, columnName },
  );
  return Number(rows?.[0]?.c || 0) > 0;
}

async function ensurePosTables() {
  await query(`
    CREATE TABLE IF NOT EXISTS pos_payment_modes (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      company_id BIGINT UNSIGNED NOT NULL,
      branch_id BIGINT UNSIGNED NOT NULL,
      name VARCHAR(100) NOT NULL,
      type ENUM('cash','card','mobile','bank','other') NOT NULL,
      account VARCHAR(100) NULL,
      require_reference TINYINT(1) NOT NULL DEFAULT 0,
      is_active TINYINT(1) NOT NULL DEFAULT 1,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY idx_pos_payment_modes_company (company_id),
      KEY idx_pos_payment_modes_branch (branch_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  if (!(await hasColumn("pos_payment_modes", "is_active"))) {
    await query(
      "ALTER TABLE pos_payment_modes ADD COLUMN is_active TINYINT(1) NOT NULL DEFAULT 1",
    );
  }
}

export const listPaymentModes = async (req, res, next) => {
  try {
    const { companyId, branchId } = req.scope;
    await ensurePosTables();
    const items = await query(
      `
      SELECT
        id,
        name,
        type,
        account,
        require_reference,
        is_active
      FROM pos_payment_modes
      WHERE company_id = :companyId
        AND branch_id = :branchId
      ORDER BY name
      `,
      { companyId, branchId },
    );
    res.json({ items });
  } catch (err) {
    next(err);
  }
};

