// Example: Robust reverse-by-document handler ensuring valid statuses
// Integrate into your existing Express server
const express = require("express");
const router = express.Router();

function normalizeStatus(s) {
  const allowed = new Set([
    "DRAFT",
    "PENDING",
    "PENDING_APPROVAL",
    "APPROVED",
    "REJECTED",
    "RETURNED",
    "CANCELLED",
    "CLOSED",
  ]);
  const up = String(s || "").trim().toUpperCase().replace(/\s+/g, "_");
  return allowed.has(up) ? up : "RETURNED";
}

router.post("/workflows/reverse-by-document", async (req, res) => {
  try {
    const { document_type, document_id, desired_status } = req.body || {};
    if (!document_type || !document_id) {
      return res.status(400).json({ message: "Missing document identifiers" });
    }
    // Map table by type
    const t = String(document_type).toUpperCase();
    const table =
      t === "PURCHASE_ORDER" || t === "PO" || t === "PURCHASE ORDER"
        ? "purchase_orders"
        : null; // add other mappings as needed
    if (!table) {
      return res.status(400).json({ message: "Unsupported document type" });
    }
    const next = normalizeStatus(desired_status || "RETURNED");
    // Example using knex
    // await knex(table)
    //   .update({ status: next, forwarded_to_user_id: null, updated_at: knex.fn.now() })
    //   .where({ id: Number(document_id) });
    return res.json({ status: next });
  } catch (e) {
    return res.status(500).json({ message: "Reverse approval failed" });
  }
});

module.exports = router;
