import express from "express";
import {
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
} from "../middleware/auth.js";
import * as workflowController from "../controllers/workflow.controller.js";

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
