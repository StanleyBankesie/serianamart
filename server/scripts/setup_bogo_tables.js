import { pool } from "../db/pool.js";

async function run() {
  const conn = await pool.getConnection();
  try {
    console.log("Creating BOGO campaign tables...");

    await conn.query(`
      CREATE TABLE IF NOT EXISTS sal_bogo_campaigns (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        company_id BIGINT UNSIGNED NOT NULL,
        campaign_name VARCHAR(255) NOT NULL,
        campaign_qty DECIMAL(18,3) NOT NULL DEFAULT '0.000',
        used_qty DECIMAL(18,3) NOT NULL DEFAULT '0.000',
        effective_from DATE NOT NULL,
        effective_to DATE DEFAULT NULL,
        is_active TINYINT(1) NOT NULL DEFAULT '1',
        created_by BIGINT UNSIGNED DEFAULT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        KEY idx_bogo_company (company_id),
        KEY idx_bogo_created_by (created_by),
        KEY idx_bogo_active (company_id, is_active, effective_from, effective_to),
        CONSTRAINT fk_bogo_company FOREIGN KEY (company_id) REFERENCES adm_companies (id),
        CONSTRAINT fk_bogo_created_by FOREIGN KEY (created_by) REFERENCES adm_users (id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await conn.query(`
      CREATE TABLE IF NOT EXISTS sal_bogo_campaign_items (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        campaign_id BIGINT UNSIGNED NOT NULL,
        item_id BIGINT UNSIGNED NOT NULL,
        item_qty DECIMAL(18,3) NOT NULL DEFAULT '0.000',
        free_item_id BIGINT UNSIGNED NOT NULL,
        free_qty DECIMAL(18,3) NOT NULL DEFAULT '0.000',
        PRIMARY KEY (id),
        KEY idx_bc_items_campaign (campaign_id),
        KEY idx_bc_items_item (item_id),
        KEY idx_bc_items_free (free_item_id),
        CONSTRAINT fk_bc_items_campaign FOREIGN KEY (campaign_id) REFERENCES sal_bogo_campaigns (id) ON DELETE CASCADE,
        CONSTRAINT fk_bc_items_item FOREIGN KEY (item_id) REFERENCES inv_items (id) ON DELETE CASCADE,
        CONSTRAINT fk_bc_items_free FOREIGN KEY (free_item_id) REFERENCES inv_items (id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // Add used_qty column if it doesn't exist (for existing tables)
    try {
      await conn.query(`
        ALTER TABLE sal_bogo_campaigns
        ADD COLUMN used_qty DECIMAL(18,3) NOT NULL DEFAULT '0.000'
        AFTER campaign_qty
      `);
      console.log("Added used_qty column to existing sal_bogo_campaigns table");
    } catch (e) {
      if (e.code === 'ER_DUP_FIELDNAME') {
        console.log("used_qty column already exists");
      } else {
        throw e;
      }
    }

    console.log("BOGO campaign tables ready");
  } finally {
    conn.release();
  }
  process.exit(0);
}

run().catch((err) => {
  console.error("Setup failed:", err);
  process.exit(1);
});
