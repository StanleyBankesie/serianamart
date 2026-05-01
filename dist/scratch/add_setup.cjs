const fs = require('fs');
let content = fs.readFileSync('c:/Users/stanl/OneDrive/Documents/serianamart/server/routes/purchase.routes.js', 'utf8');

const setupLogic = `
router.get(
  "/setup",
  requireAuth,
  requireCompanyScope,
  requirePermission("PURCHASE.SETUP.VIEW"),
  async (req, res, next) => {
    try {
      const { companyId } = req.scope;
      const [rows] = await pool.query(
        "SELECT freight_account_id, other_charges_account_id FROM pur_setup WHERE company_id = ? LIMIT 1",
        [companyId],
      );
      if (rows && rows.length > 0) {
        res.json(rows[0]);
      } else {
        res.json({});
      }
    } catch (err) {
      next(err);
    }
  },
);

router.put(
  "/setup",
  requireAuth,
  requireCompanyScope,
  requirePermission("PURCHASE.SETUP.EDIT"),
  async (req, res, next) => {
    try {
      const { companyId } = req.scope;
      const { freight_account_id, other_charges_account_id } = req.body;
      const [existing] = await pool.query("SELECT id FROM pur_setup WHERE company_id = ? LIMIT 1", [companyId]);
      if (existing && existing.length > 0) {
        await pool.query(
          "UPDATE pur_setup SET freight_account_id = ?, other_charges_account_id = ? WHERE company_id = ?",
          [freight_account_id || null, other_charges_account_id || null, companyId]
        );
      } else {
        await pool.query(
          "INSERT INTO pur_setup (company_id, freight_account_id, other_charges_account_id) VALUES (?, ?, ?)",
          [companyId, freight_account_id || null, other_charges_account_id || null]
        );
      }
      res.json({ message: "Setup updated" });
    } catch (err) {
      next(err);
    }
  },
);

`;

const insertIdx = content.indexOf('router.get(');
if (insertIdx > -1) {
  content = content.slice(0, insertIdx) + setupLogic + content.slice(insertIdx);
  fs.writeFileSync('c:/Users/stanl/OneDrive/Documents/serianamart/server/routes/purchase.routes.js', content);
  console.log('Added pur_setup routes');
} else {
  console.log('Could not find router.get');
}
