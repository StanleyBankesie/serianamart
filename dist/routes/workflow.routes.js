import express from "express";
import {
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
} from "../middleware/auth.js";
import * as workflowController from "../controllers/workflow.controller.js";
import { query } from "../db/pool.js";

const router = express.Router();

// ==========================================
// WORKFLOW EXECUTION & NOTIFICATIONS
// (Specific routes MUST be defined before generic /:id routes)
// ==========================================

// Start Workflow for a Document
router.post(
  "/start",
  requireAuth,
  requireCompanyScope,
  workflowController.startWorkflow,
);

// Get Pending Approvals for Current User
router.get(
  "/approvals/pending",
  requireAuth,
  requireCompanyScope,
  workflowController.getPendingApprovals,
);

// Get Workflow Instance Detail
router.get(
  "/approvals/instance/:instanceId",
  requireAuth,
  requireCompanyScope,
  workflowController.getApprovalInstanceDetail,
);

// Get Notifications
router.get(
  "/notifications",
  requireAuth,
  requireCompanyScope,
  workflowController.getNotifications,
);

// Search Users for Approver selection
router.get(
  "/users",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  async (req, res, next) => {
    try {
      const { companyId, branchId } = req.scope;
      const { q, active, limit } = req.query || {};
      const clauses = ["u.company_id = :companyId", "u.branch_id = :branchId"];
      const params = { companyId, branchId };
      if (typeof active !== "undefined" && active !== "") {
        clauses.push("u.is_active = :is_active");
        params.is_active = Number(Boolean(active));
      }
      if (q && String(q).trim().length > 0) {
        params.q = `%${String(q).trim()}%`;
        clauses.push(
          "(u.username LIKE :q OR u.full_name LIKE :q OR u.email LIKE :q)",
        );
      }
      const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
      const lim = Math.min(50, Math.max(1, parseInt(limit || "20", 10)));
      const items = await query(
        `
        SELECT u.id, u.username, u.full_name, u.email, u.is_active
        FROM adm_users u
        ${where}
        ORDER BY u.username ASC
        LIMIT ${lim}
        `,
        params,
      );
      res.json({ items });
    } catch (err) {
      next(err);
    }
  },
);

// Mark Notification Read
router.put(
  "/notifications/:id/read",
  requireAuth,
  workflowController.markNotificationRead,
);

// Perform Action (Approve/Reject/Return)
router.post(
  "/:instanceId/action",
  requireAuth,
  requireCompanyScope,
  workflowController.performAction,
);

// ==========================================
// WORKFLOW DEFINITIONS (CRUD)
// ==========================================

// List Workflows
router.get(
  "/",
  requireAuth,
  requireCompanyScope,
  workflowController.listWorkflows,
);

// Create Workflow
router.post(
  "/",
  requireAuth,
  requireCompanyScope,
  workflowController.createWorkflow,
);

// Update Workflow
router.put(
  "/:id",
  requireAuth,
  requireCompanyScope,
  workflowController.updateWorkflow,
);

// Delete Workflow
router.delete(
  "/:id",
  requireAuth,
  requireCompanyScope,
  workflowController.deleteWorkflow,
);

// Get Workflow Detail (Wildcard - MUST BE LAST GET)
router.get(
  "/:id",
  requireAuth,
  requireCompanyScope,
  workflowController.getWorkflow,
);

export default router;
