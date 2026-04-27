import express from "express";
import {
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
} from "../middleware/auth.js";
import { requireAnyPermission } from "../middleware/requirePermission.js";
import { query } from "../db/pool.js";

const router = express.Router();

function toNumber(v, fb = null) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fb;
}
function toDateOnly(v) {
  if (!v) return null;
  const d = new Date(String(v));
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

// Service Request Summary
router.get(
  "/reports/request-summary",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  requireAnyPermission(["PURCHASE.ORDER.VIEW"]),
  async (req, res, next) => {
    try {
      const { companyId, branchId } = req.scope;
      const from = toDateOnly(req.query.from);
      const to = toDateOnly(req.query.to);
      const status = String(req.query.status || "").trim();
      const priority = String(req.query.priority || "").trim();
      const customerLike = String(req.query.customer || "").trim();
      const clauses = ["r.company_id = :companyId", "r.branch_id = :branchId"];
      const params = { companyId, branchId };
      if (from && to) {
        clauses.push("r.request_date BETWEEN :from AND :to");
        params.from = from;
        params.to = to;
      }
      if (status) {
        clauses.push("r.status = :status");
        params.status = status;
      }
      if (priority) {
        clauses.push("r.priority = :priority");
        params.priority = priority;
      }
      if (customerLike) {
        clauses.push("(r.requester_full_name LIKE :cust OR r.requester_company LIKE :cust)");
        params.cust = `%${customerLike}%`;
      }
      const items = await query(`
        SELECT 
          r.request_no,
          r.request_date,
          r.requester_full_name AS customer_name,
          r.service_type,
          r.priority,
          NULL AS assigned_to,
          r.status,
          NULL AS sla_due_date,
          r.created_at,
          u.username AS created_by_name
         FROM pur_service_requests r
        LEFT JOIN adm_users u ON u.id = r.created_by
         WHERE ${clauses.join(" AND ")}
        ORDER BY r.request_date DESC, r.id DESC
        `,
        params,
      ).catch(() => []);
      res.json({ items });
    } catch (err) {
      next(err);
    }
  },
);

// Service Order Status
router.get(
  "/reports/order-status",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  requireAnyPermission(["PURCHASE.ORDER.VIEW"]),
  async (req, res, next) => {
    try {
      const { companyId, branchId } = req.scope;
      const from = toDateOnly(req.query.from);
      const to = toDateOnly(req.query.to);
      const status = String(req.query.status || "").trim();
      const tech = String(req.query.technician || "").trim();
      const svcType = String(req.query.serviceType || "").trim();
      const clauses = ["o.company_id = :companyId", "o.branch_id = :branchId"];
      const params = { companyId, branchId };
      if (from && to) {
        clauses.push("o.order_date BETWEEN :from AND :to");
        params.from = from;
        params.to = to;
      }
      if (status) {
        clauses.push("o.status = :status");
        params.status = status;
      }
      if (tech) {
        clauses.push("o.assigned_supervisor_username LIKE :tech");
        params.tech = `%${tech}%`;
      }
      if (svcType) {
        clauses.push("o.service_category LIKE :svcType");
        params.svcType = `%${svcType}%`;
      }
      const items = await query(`
        SELECT 
          o.order_no,
          NULL AS request_no,
          o.assigned_supervisor_username AS technician,
          o.order_date,
          o.start_date,
          o.end_date AS completion_date,
          o.status,
          o.estimated_cost,
          o.total_amount AS actual_cost,
          o.created_at,
          u.username AS created_by_name
         FROM pur_service_orders o
        LEFT JOIN adm_users u ON u.id = o.created_by
         WHERE ${clauses.join(" AND ")}
        ORDER BY o.order_date DESC, o.id DESC
        `,
        params,
      ).catch(() => []);
      res.json({ items });
    } catch (err) {
      next(err);
    }
  },
);

// Execution Performance (by technician)
router.get(
  "/reports/execution-performance",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  requireAnyPermission(["PURCHASE.ORDER.VIEW"]),
  async (req, res, next) => {
    try {
      const { companyId, branchId } = req.scope;
      const from = toDateOnly(req.query.from);
      const to = toDateOnly(req.query.to);
      const tech = String(req.query.technician || "").trim();
      const params = { companyId, branchId };
      const dateClause =
        from && to ? " AND o.order_date BETWEEN :from AND :to" : "";
      if (from && to) {
        params.from = from;
        params.to = to;
      }
      const base = await query(`
        SELECT 
          COALESCE(o.assigned_supervisor_username, 'Unassigned') AS technician,
          COUNT(*) AS total_execs,
          SUM(CASE WHEN o.status IN ('COMPLETED','CLOSED') THEN 1 ELSE 0 END) AS completed_jobs,
          SUM(CASE WHEN o.status NOT IN ('COMPLETED','CLOSED','CANCELLED') THEN 1 ELSE 0 END) AS pending_jobs,
          o.created_at,
          u.username AS created_by_name
         FROM pur_service_orders o
        LEFT JOIN adm_users u ON u.id = o.created_by
         WHERE o.company_id = :companyId AND o.branch_id = :branchId
        ${dateClause}
        GROUP BY COALESCE(o.assigned_supervisor_username, 'Unassigned')
        `,
        params,
      ).catch(() => []);
      const items = (Array.isArray(base) ? base : [])
        .filter((r) =>
          tech ? String(r.technician || "").includes(tech) : true,
        )
        .map((r) => ({
          technician: r.technician,
          total_executions: Number(r.total_execs || 0),
          completed_jobs: Number(r.completed_jobs || 0),
          pending_jobs: Number(r.pending_jobs || 0),
          average_completion_time: 0,
          total_labor_hours: 0,
          first_time_fix_rate:
            Number(r.total_execs || 0) > 0
              ? Math.round((Number(r.completed_jobs || 0) / r.total_execs) * 100)
              : 0,
        }));
      res.json({ items });
    } catch (err) {
      next(err);
    }
  },
);

// SLA Compliance
router.get(
  "/reports/sla-compliance",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  requireAnyPermission(["PURCHASE.ORDER.VIEW"]),
  async (req, res, next) => {
    try {
      const { companyId, branchId } = req.scope;
      const from = toDateOnly(req.query.from);
      const to = toDateOnly(req.query.to);
      const params = { companyId, branchId };
      const dateClause =
        from && to ? " AND o.order_date BETWEEN :from AND :to" : "";
      if (from && to) {
        params.from = from;
        params.to = to;
      }
      const rows = await query(`
        SELECT 
          o.order_no,
          o.customer_name AS customer,
          NULL AS sla_due_date,
          o.end_date AS completion_date,
          NULL AS delay_hours,
          o.created_at,
          u.username AS created_by_name
         FROM pur_service_orders o
        LEFT JOIN adm_users u ON u.id = o.created_by
         WHERE o.company_id = :companyId AND o.branch_id = :branchId
        ${dateClause}
        ORDER BY o.order_date DESC, o.id DESC
        `,
        params,
      ).catch(() => []);
      const totalRequests = rows.length;
      const withinSla = 0;
      const breached = 0;
      const metrics = {
        total_requests: totalRequests,
        within_sla: withinSla,
        breached_sla: breached,
        sla_compliance_percent:
          totalRequests > 0 ? Math.round((withinSla / totalRequests) * 100) : 0,
      };
      res.json({ metrics, items: rows });
    } catch (err) {
      next(err);
    }
  },
);

// Service Revenue
router.get(
  "/reports/service-revenue",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  requireAnyPermission(["PURCHASE.ORDER.VIEW"]),
  async (req, res, next) => {
    try {
      const { companyId, branchId } = req.scope;
      const from = toDateOnly(req.query.from);
      const to = toDateOnly(req.query.to);
      const svcType = String(req.query.serviceType || "").trim();
      const customerLike = String(req.query.customer || "").trim();
      const clauses = ["b.company_id = :companyId", "b.branch_id = :branchId"];
      const params = { companyId, branchId };
      if (from && to) {
        clauses.push("b.bill_date BETWEEN :from AND :to");
        params.from = from;
        params.to = to;
      }
      if (svcType) {
        clauses.push("o.service_category LIKE :svcType");
        params.svcType = `%${svcType}%`;
      }
      if (customerLike) {
        clauses.push("o.customer_name LIKE :cust");
        params.cust = `%${customerLike}%`;
      }
      const items = await query(`
        SELECT 
          b.bill_no,
          b.bill_date,
          o.customer_name,
          o.service_category AS service_type,
          b.total_amount,
          COALESCE(b.amount_paid, 0) AS amount_paid,
          GREATEST(COALESCE(b.total_amount,0) - COALESCE(b.amount_paid,0), 0) AS outstanding,
          0 AS vat_collected,
          b.created_at,
          u.username AS created_by_name
         FROM pur_service_bills b
        LEFT JOIN pur_service_orders o ON o.id = b.order_id
        LEFT JOIN adm_users u ON u.id = b.created_by
         WHERE ${clauses.join(" AND ")}
        ORDER BY b.bill_date DESC, b.id DESC
        `,
        params,
      ).catch(() => []);
      const metrics = {
        total_service_bills: items.length,
        total_revenue: items.reduce((a, r) => a + Number(r.total_amount || 0), 0),
        paid_amount: items.reduce((a, r) => a + Number(r.amount_paid || 0), 0),
        outstanding_amount: items.reduce(
          (a, r) => a + Number(r.outstanding || 0),
          0,
        ),
        vat_collected: 0,
      };
      res.json({ metrics, items });
    } catch (err) {
      next(err);
    }
  },
);

// Outstanding Service Bills
router.get(
  "/reports/outstanding-bills",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  requireAnyPermission(["PURCHASE.ORDER.VIEW"]),
  async (req, res, next) => {
    try {
      const { companyId, branchId } = req.scope;
      const items = await query(`
        SELECT 
          b.bill_no,
          o.order_no AS service_order_no,
          o.customer_name AS customer,
          b.bill_date,
          b.due_date,
          b.total_amount,
          COALESCE(b.amount_paid, 0) AS paid_amount,
          GREATEST(COALESCE(b.total_amount,0) - COALESCE(b.amount_paid,0), 0) AS balance,
          CASE 
            WHEN b.due_date IS NULL THEN 'N/A'
            WHEN DATEDIFF(CURDATE(), b.due_date) <= 30 THEN '0-30'
            WHEN DATEDIFF(CURDATE(), b.due_date) <= 60 THEN '31-60'
            WHEN DATEDIFF(CURDATE(), b.due_date) <= 90 THEN '61-90'
            ELSE '>90'
          END AS aging,
          b.created_at,
          u.username AS created_by_name
         FROM pur_service_bills b
        LEFT JOIN pur_service_orders o ON o.id = b.order_id
        LEFT JOIN adm_users u ON u.id = b.created_by
         WHERE b.company_id = :companyId AND b.branch_id = :branchId
          AND COALESCE(b.amount_paid,0) < COALESCE(b.total_amount,0)
        ORDER BY b.due_date ASC NULLS FIRST, b.bill_date DESC
        `,
        { companyId, branchId },
      ).catch(() => []);
      res.json({ items });
    } catch (err) {
      next(err);
    }
  },
);

// Service Confirmation
router.get(
  "/reports/confirmation",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  requireAnyPermission(["PURCHASE.ORDER.VIEW"]),
  async (req, res, next) => {
    try {
      const { companyId, branchId } = req.scope;
      const items = await query(`
        SELECT 
          o.order_no,
          c.confirmation_date,
          c.customer_name,
          c.status AS confirmation_status,
          c.remarks,
          NULL AS rating,
          c.created_at,
          u.username AS created_by_name
         FROM inv_service_confirmations c
        LEFT JOIN pur_service_orders o ON o.id = c.order_id
        LEFT JOIN adm_users u ON u.id = c.created_by
         WHERE c.company_id = :companyId AND c.branch_id = :branchId
        ORDER BY c.confirmation_date DESC, c.id DESC
        `,
        { companyId, branchId },
      ).catch(() => []);
      res.json({ items });
    } catch (err) {
      next(err);
    }
  },
);

// Technician Utilization
router.get(
  "/reports/technician-utilization",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  requireAnyPermission(["PURCHASE.ORDER.VIEW"]),
  async (req, res, next) => {
    try {
      const { companyId, branchId } = req.scope;
      const from = toDateOnly(req.query.from);
      const to = toDateOnly(req.query.to);
      const params = { companyId, branchId };
      const dateClause =
        from && to ? " AND o.order_date BETWEEN :from AND :to" : "";
      if (from && to) {
        params.from = from;
        params.to = to;
      }
      const items = await query(`
        SELECT 
          COALESCE(o.assigned_supervisor_username, 'Unassigned') AS technician,
          COUNT(*) AS total_jobs,
          SUM(CASE WHEN o.status IN ('COMPLETED','CLOSED') THEN 1 ELSE 0 END) AS completed_jobs,
          SUM(CASE WHEN o.status NOT IN ('COMPLETED','CLOSED','CANCELLED') THEN 1 ELSE 0 END) AS pending_jobs,
          0 AS hours,
          CASE 
            WHEN COUNT(*) = 0 THEN '0%'
            ELSE CONCAT(ROUND(SUM(CASE WHEN o.status IN ('COMPLETED','CLOSED') THEN 1 ELSE 0 END) * 100 / COUNT(*), 0), '%')
          END AS utilization,
          o.created_at,
          u.username AS created_by_name
         FROM pur_service_orders o
        LEFT JOIN adm_users u ON u.id = o.created_by
         WHERE o.company_id = :companyId AND o.branch_id = :branchId
        ${dateClause}
        GROUP BY COALESCE(o.assigned_supervisor_username, 'Unassigned')
        ORDER BY technician ASC
        `,
        params,
      ).catch(() => []);
      res.json({ items });
    } catch (err) {
      next(err);
    }
  },
);

// Service Cost Analysis
router.get(
  "/reports/cost-analysis",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  requireAnyPermission(["PURCHASE.ORDER.VIEW"]),
  async (req, res, next) => {
    try {
      const { companyId, branchId } = req.scope;
      const items = await query(`
        SELECT 
          o.order_no,
          o.estimated_cost,
          0 AS actual_labor_cost,
          COALESCE((
            SELECT SUM(COALESCE(m.qty,0) * 0),
          m.created_at,
          u.username AS created_by_name
         FROM pur_service_execution_materials m 
            JOIN pur_service_executions e ON e.id = m.execution_id
        LEFT JOIN adm_users u ON u.id = m.created_by
         WHERE e.order_id = o.id
          ), 0) AS material_cost,
          COALESCE(o.estimated_cost,0) AS total_cost,
          COALESCE(b.total_amount, 0) AS billed_amount,
          COALESCE(b.total_amount, 0) - COALESCE(o.estimated_cost,0) AS profit_loss
        FROM pur_service_orders o
        LEFT JOIN pur_service_bills b ON b.order_id = o.id
        WHERE o.company_id = :companyId AND o.branch_id = :branchId
        ORDER BY o.order_date DESC, o.id DESC
        `,
        { companyId, branchId },
      ).catch(() => []);
      res.json({ items });
    } catch (err) {
      next(err);
    }
  },
);

// Repeat Service Requests (by customer + service type)
router.get(
  "/reports/repeat-requests",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  requireAnyPermission(["PURCHASE.ORDER.VIEW"]),
  async (req, res, next) => {
    try {
      const { companyId, branchId } = req.scope;
      const items = await query(`
        SELECT 
          COALESCE(o.customer_name, 'UNSPECIFIED') AS customer,
          COALESCE(o.service_category, 'UNSPECIFIED') AS asset_equipment,
          COUNT(*) AS num_requests,
          MAX(o.end_date) AS last_service_date,
          COALESCE(o.service_category, 'UNSPECIFIED') AS issue_type,
          o.created_at,
          u.username AS created_by_name
         FROM pur_service_orders o
        LEFT JOIN adm_users u ON u.id = o.created_by
         WHERE o.company_id = :companyId AND o.branch_id = :branchId
        GROUP BY COALESCE(o.customer_name, 'UNSPECIFIED'), COALESCE(o.service_category, 'UNSPECIFIED')
        ORDER BY num_requests DESC, last_service_date DESC
        `,
        { companyId, branchId },
      ).catch(() => []);
      res.json({ items });
    } catch (err) {
      next(err);
    }
  },
);

// Service Type Performance
router.get(
  "/reports/service-type-performance",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  requireAnyPermission(["PURCHASE.ORDER.VIEW"]),
  async (req, res, next) => {
    try {
      const { companyId, branchId } = req.scope;
      const items = await query(`
        SELECT 
          COALESCE(o.service_category, 'UNSPECIFIED') AS service_type,
          COUNT(*) AS total_orders,
          COALESCE(SUM(b.total_amount),0) AS total_revenue,
          NULL AS avg_completion_time,
          COALESCE(AVG(o.estimated_cost),0) AS avg_cost,
          o.created_at,
          u.username AS created_by_name
         FROM pur_service_orders o
        LEFT JOIN pur_service_bills b ON b.order_id = o.id
        LEFT JOIN adm_users u ON u.id = o.created_by
         WHERE o.company_id = :companyId AND o.branch_id = :branchId
        GROUP BY COALESCE(o.service_category, 'UNSPECIFIED')
        ORDER BY total_revenue DESC
        `,
        { companyId, branchId },
      ).catch(() => []);
      res.json({ items });
    } catch (err) {
      next(err);
    }
  },
);

export default router;

