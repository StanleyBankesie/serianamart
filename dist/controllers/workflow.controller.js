import { query } from "../db/pool.js";
import { httpError } from "../utils/httpError.js";
import { isMailerConfigured, sendMail } from "../utils/mailer.js";

const toNumber = (v, fallback = null) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};

const hasColumn = async (tableName, columnName) => {
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
};

const nextWorkflowCode = async (companyId) => {
  const rows = await query(
    `
    SELECT workflow_code
    FROM adm_workflows
    WHERE company_id = :companyId
      AND workflow_code REGEXP '^WF-[0-9]{6}$'
    ORDER BY CAST(SUBSTRING(workflow_code, 4) AS UNSIGNED) DESC
    LIMIT 1
    `,
    { companyId },
  );
  let nextNum = 1;
  if (rows.length > 0) {
    const prev = String(rows[0].workflow_code || "");
    const numPart = prev.slice(3);
    const n = parseInt(numPart, 10);
    if (Number.isFinite(n)) nextNum = n + 1;
  }
  return `WF-${String(nextNum).padStart(6, "0")}`;
};

const ensureWorkflowTables = async () => {
  await query(`
    CREATE TABLE IF NOT EXISTS adm_workflows (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      company_id BIGINT UNSIGNED NOT NULL,
      workflow_code VARCHAR(50) NOT NULL,
      workflow_name VARCHAR(150) NOT NULL,
      module_key VARCHAR(50) NOT NULL,
      document_type VARCHAR(80) NOT NULL,
      document_route VARCHAR(255) DEFAULT NULL,
      min_amount DECIMAL(18,2) DEFAULT NULL,
      max_amount DECIMAL(18,2) DEFAULT NULL,
      default_behavior VARCHAR(20) DEFAULT NULL,
      is_active TINYINT(1) NOT NULL DEFAULT 1,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uq_workflow_company_code (company_id, workflow_code)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);
  await query(`
    CREATE TABLE IF NOT EXISTS adm_workflow_step_approvers (
      workflow_id BIGINT UNSIGNED NOT NULL,
      step_order INT NOT NULL,
      approver_user_id BIGINT UNSIGNED NOT NULL,
      approval_limit DECIMAL(15,2) DEFAULT NULL,
      PRIMARY KEY (workflow_id, step_order, approver_user_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);
  if (!(await hasColumn("adm_workflows", "document_route"))) {
    await query(
      `ALTER TABLE adm_workflows ADD COLUMN document_route VARCHAR(255) DEFAULT NULL`,
    );
  }
  if (!(await hasColumn("adm_workflows", "min_amount"))) {
    await query(
      `ALTER TABLE adm_workflows ADD COLUMN min_amount DECIMAL(18,2) DEFAULT NULL`,
    );
  }
  if (!(await hasColumn("adm_workflows", "max_amount"))) {
    await query(
      `ALTER TABLE adm_workflows ADD COLUMN max_amount DECIMAL(18,2) DEFAULT NULL`,
    );
  }
  if (!(await hasColumn("adm_workflows", "default_behavior"))) {
    await query(
      `ALTER TABLE adm_workflows ADD COLUMN default_behavior VARCHAR(20) DEFAULT NULL`,
    );
  }
  await query(`
    CREATE TABLE IF NOT EXISTS adm_workflow_steps (
      workflow_id BIGINT UNSIGNED NOT NULL,
      step_order INT NOT NULL,
      step_name VARCHAR(150) NOT NULL,
      approver_user_id BIGINT UNSIGNED NOT NULL,
      approver_role_id BIGINT UNSIGNED DEFAULT NULL,
      min_amount DECIMAL(18,2) DEFAULT NULL,
      max_amount DECIMAL(18,2) DEFAULT NULL,
      approval_limit DECIMAL(15,2) DEFAULT NULL,
      is_mandatory TINYINT(1) NOT NULL DEFAULT 1,
      PRIMARY KEY (workflow_id, step_order)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);
  await query(`
    CREATE TABLE IF NOT EXISTS adm_document_workflows (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      company_id BIGINT UNSIGNED NOT NULL,
      workflow_id BIGINT UNSIGNED NOT NULL,
      document_id BIGINT UNSIGNED NOT NULL,
      document_type VARCHAR(80) NOT NULL,
      amount DECIMAL(15,2) DEFAULT 0.00,
      current_step_order INT NOT NULL DEFAULT 1,
      status ENUM('PENDING','APPROVED','REJECTED','RETURNED') NOT NULL DEFAULT 'PENDING',
      assigned_to_user_id BIGINT UNSIGNED DEFAULT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY idx_doc_workflow_lookup (document_id, document_type),
      KEY idx_doc_workflow_status (status)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);
  await query(`
    CREATE TABLE IF NOT EXISTS adm_workflow_logs (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      document_workflow_id BIGINT UNSIGNED NOT NULL,
      step_order INT NOT NULL,
      action VARCHAR(50) NOT NULL,
      actor_user_id BIGINT UNSIGNED NOT NULL,
      comments VARCHAR(255),
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY idx_wf_logs_dw (document_workflow_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);
  await query(`
    CREATE TABLE IF NOT EXISTS adm_notifications (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      company_id BIGINT UNSIGNED NOT NULL,
      user_id BIGINT UNSIGNED NOT NULL,
      title VARCHAR(255) NOT NULL,
      message TEXT,
      link VARCHAR(255),
      is_read TINYINT(1) NOT NULL DEFAULT 0,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY idx_notif_user (user_id, is_read)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);
  await query(`
    CREATE TABLE IF NOT EXISTS adm_workflow_tasks (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      company_id BIGINT UNSIGNED NOT NULL,
      workflow_id BIGINT UNSIGNED NOT NULL,
      document_workflow_id BIGINT UNSIGNED NOT NULL,
      document_id BIGINT UNSIGNED NOT NULL,
      document_type VARCHAR(80) NOT NULL,
      step_order INT NOT NULL,
      assigned_to_user_id BIGINT UNSIGNED NOT NULL,
      action ENUM('PENDING','APPROVED','REJECTED','RETURNED') NOT NULL DEFAULT 'PENDING',
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY idx_wf_task_lookup (document_workflow_id, step_order),
      KEY idx_wf_task_assignee (assigned_to_user_id, action)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);
};

export const listWorkflows = async (req, res, next) => {
  try {
    await ensureWorkflowTables();
    const { companyId } = req.scope;
    const items = await query(
      `SELECT w.*, c.name as company_name 
       FROM adm_workflows w
       JOIN adm_companies c ON w.company_id = c.id
       WHERE w.company_id = :companyId
       ORDER BY w.workflow_name`,
      { companyId },
    );
    res.json({ items });
  } catch (err) {
    next(err);
  }
};

export const getWorkflow = async (req, res, next) => {
  try {
    await ensureWorkflowTables();
    const { companyId } = req.scope;
    const id = toNumber(req.params.id);
    if (!id) throw httpError(400, "VALIDATION_ERROR", "Invalid ID");

    const workflows = await query(
      `SELECT * FROM adm_workflows WHERE id = :id AND company_id = :companyId`,
      { id, companyId },
    );
    if (!workflows.length)
      throw httpError(404, "NOT_FOUND", "Workflow not found");
    const workflow = workflows[0];

    const stepsBase = await query(
      `SELECT ws.* 
       FROM adm_workflow_steps ws
       WHERE ws.workflow_id = :id
       ORDER BY ws.step_order ASC`,
      { id },
    );
    const allApprovers = await query(
      `SELECT a.workflow_id, a.step_order, a.approver_user_id, a.approval_limit, u.username 
       FROM adm_workflow_step_approvers a
       JOIN adm_users u ON a.approver_user_id = u.id
       WHERE a.workflow_id = :id
       ORDER BY a.step_order ASC, u.username ASC`,
      { id },
    );
    const byStep = {};
    for (const a of allApprovers) {
      const k = `${a.workflow_id}-${a.step_order}`;
      if (!byStep[k]) byStep[k] = [];
      byStep[k].push({
        id: a.approver_user_id,
        username: a.username,
        approval_limit: a.approval_limit,
      });
    }
    const steps = stepsBase.map((s) => {
      const k = `${s.workflow_id}-${s.step_order}`;
      const approvers = byStep[k] || [];
      const first = approvers[0] || null;
      return {
        ...s,
        approver_user_id: s.approver_user_id || (first ? first.id : null),
        approver_name: first ? first.username : null,
        approval_limit: s.approval_limit ?? (first ? first.approval_limit : null),
        approvers,
      };
    });

    res.json({ item: { ...workflow, steps } });
  } catch (err) {
    next(err);
  }
};

export const createWorkflow = async (req, res, next) => {
  try {
    await ensureWorkflowTables();
    const { companyId } = req.scope;
    const {
      workflow_code,
      workflow_name,
      module_key,
      document_type,
      document_route,
      default_behavior,
      is_active,
      steps,
    } = req.body;

    if (!workflow_name || !module_key || !document_type) {
      throw httpError(400, "VALIDATION_ERROR", "Missing required fields");
    }

    const result = await query(
      `INSERT INTO adm_workflows 
       (company_id, workflow_code, workflow_name, module_key, document_type, document_route, default_behavior, is_active)
       VALUES (:companyId, :workflow_code, :workflow_name, :module_key, :document_type, :document_route, :default_behavior, :is_active)`,
      {
        companyId,
        workflow_code:
          typeof workflow_code === "string" && /^WF-[0-9]{6}$/.test(workflow_code)
            ? workflow_code
            : await nextWorkflowCode(companyId),
        workflow_name,
        module_key,
        document_type,
        document_route:
          typeof document_route === "string" && document_route ? document_route : null,
        default_behavior:
          typeof default_behavior === "string" &&
          ["BYPASS", "AUTO_APPROVE", "MANUAL"].includes(default_behavior.toUpperCase())
            ? default_behavior.toUpperCase()
            : null,
        is_active: is_active === undefined ? 1 : Number(Boolean(is_active)),
      },
    );
    const workflowId = result.insertId;

    if (Array.isArray(steps)) {
      for (const step of steps) {
        const ids =
          Array.isArray(step.approver_user_ids) && step.approver_user_ids.length
            ? step.approver_user_ids
            : step.approver_user_id
              ? [step.approver_user_id]
              : [];
        const firstId = ids[0] || null;
        await query(
          `INSERT INTO adm_workflow_steps 
           (workflow_id, step_order, step_name, approver_user_id, approval_limit, is_mandatory)
           VALUES (:workflowId, :step_order, :step_name, :approver_user_id, :approval_limit, :is_mandatory)`,
          {
            workflowId,
            step_order: step.step_order,
            step_name: step.step_name,
            approver_user_id: firstId,
            approval_limit: step.approval_limit ? Number(step.approval_limit) : null,
            is_mandatory: step.is_mandatory ? 1 : 0,
          },
        );
        for (const uid of ids) {
          await query(
            `INSERT INTO adm_workflow_step_approvers
             (workflow_id, step_order, approver_user_id, approval_limit)
             VALUES (:workflowId, :step_order, :uid, :limit)
             ON DUPLICATE KEY UPDATE approval_limit = VALUES(approval_limit)`,
            {
              workflowId,
              step_order: step.step_order,
              uid: uid,
              limit: step.approval_limit ? Number(step.approval_limit) : null,
            },
          );
        }
      }
    }

    res.status(201).json({ id: workflowId, message: "Workflow created" });
  } catch (err) {
    next(err);
  }
};

export const updateWorkflow = async (req, res, next) => {
  try {
    await ensureWorkflowTables();
    const { companyId } = req.scope;
    const id = toNumber(req.params.id);
    const {
      workflow_code,
      workflow_name,
      module_key,
      document_type,
      document_route,
      default_behavior,
      is_active,
      steps,
    } = req.body;

    const existing = await query(
      "SELECT id FROM adm_workflows WHERE id = :id AND company_id = :companyId",
      { id, companyId },
    );
    if (!existing.length)
      throw httpError(404, "NOT_FOUND", "Workflow not found");

    await query(
      `UPDATE adm_workflows 
       SET workflow_code = :workflow_code,
           workflow_name = :workflow_name,
           module_key = :module_key,
           document_type = :document_type,
           document_route = :document_route,
           default_behavior = :default_behavior,
           is_active = :is_active
       WHERE id = :id`,
      {
        id,
        workflow_code,
        workflow_name,
        module_key,
        document_type,
        document_route:
          typeof document_route === "string" && document_route ? document_route : null,
        default_behavior:
          typeof default_behavior === "string" &&
          ["BYPASS", "AUTO_APPROVE", "MANUAL"].includes(default_behavior.toUpperCase())
            ? default_behavior.toUpperCase()
            : null,
        is_active: is_active === undefined ? 1 : Number(Boolean(is_active)),
      },
    );

    await query("DELETE FROM adm_workflow_steps WHERE workflow_id = :id", { id });
    await query(
      "DELETE FROM adm_workflow_step_approvers WHERE workflow_id = :id",
      { id },
    );

    if (Array.isArray(steps)) {
      for (const step of steps) {
        const ids =
          Array.isArray(step.approver_user_ids) && step.approver_user_ids.length
            ? step.approver_user_ids
            : step.approver_user_id
              ? [step.approver_user_id]
              : [];
        const firstId = ids[0] || null;
        await query(
          `INSERT INTO adm_workflow_steps 
           (workflow_id, step_order, step_name, approver_user_id, approval_limit, is_mandatory)
           VALUES (:workflowId, :step_order, :step_name, :approver_user_id, :approval_limit, :is_mandatory)`,
          {
            workflowId: id,
            step_order: step.step_order,
            step_name: step.step_name,
            approver_user_id: firstId,
            approval_limit: step.approval_limit ? Number(step.approval_limit) : null,
            is_mandatory: step.is_mandatory ? 1 : 0,
          },
        );
        for (const uid of ids) {
          await query(
            `INSERT INTO adm_workflow_step_approvers
             (workflow_id, step_order, approver_user_id, approval_limit)
             VALUES (:workflowId, :step_order, :uid, :limit)
             ON DUPLICATE KEY UPDATE approval_limit = VALUES(approval_limit)`,
            {
              workflowId: id,
              step_order: step.step_order,
              uid: uid,
              limit: step.approval_limit ? Number(step.approval_limit) : null,
            },
          );
        }
      }
    }

    res.json({ message: "Workflow updated" });
  } catch (err) {
    next(err);
  }
};

export const deleteWorkflow = async (req, res, next) => {
  try {
    await ensureWorkflowTables();
    const { companyId } = req.scope;
    const id = toNumber(req.params.id);
    const existing = await query(
      "SELECT id FROM adm_workflows WHERE id = :id AND company_id = :companyId",
      { id, companyId },
    );
    if (!existing.length)
      throw httpError(404, "NOT_FOUND", "Workflow not found");
    await query("DELETE FROM adm_workflows WHERE id = :id", { id });
    res.json({ message: "Workflow deleted" });
  } catch (err) {
    next(err);
  }
};

export const startWorkflow = async (req, res, next) => {
  try {
    await ensureWorkflowTables();
    const { companyId } = req.scope;
    const { workflow_id, document_id, document_type, target_user_id } = req.body;

    const workflows = await query(
      `SELECT * FROM adm_workflows WHERE id = :workflow_id AND company_id = :companyId`,
      { workflow_id, companyId },
    );
    if (!workflows.length)
      throw httpError(404, "NOT_FOUND", "Workflow not found");
    const workflow = workflows[0];

    const steps = await query(
      `SELECT * FROM adm_workflow_steps WHERE workflow_id = :workflow_id ORDER BY step_order ASC LIMIT 1`,
      { workflow_id },
    );
    if (!steps.length)
      throw httpError(400, "BAD_REQUEST", "Workflow has no steps");
    const firstStep = steps[0];
    const firstApproverRows = await query(
      `SELECT approver_user_id 
       FROM adm_workflow_step_approvers 
       WHERE workflow_id = :workflow_id AND step_order = :step_order
       ORDER BY approver_user_id ASC LIMIT 1`,
      { workflow_id, step_order: firstStep.step_order },
    );
    const allowedUsers = await query(
      `SELECT approver_user_id 
       FROM adm_workflow_step_approvers 
       WHERE workflow_id = :workflow_id AND step_order = :step_order`,
      { workflow_id, step_order: firstStep.step_order },
    );
    const allowedSet = new Set(allowedUsers.map((r) => Number(r.approver_user_id)));
    let firstAssigned =
      firstApproverRows.length > 0
        ? firstApproverRows[0].approver_user_id
        : firstStep.approver_user_id;
    if (target_user_id && allowedSet.has(Number(target_user_id))) {
      firstAssigned = Number(target_user_id);
    }

    const result = await query(
      `INSERT INTO adm_document_workflows 
       (company_id, workflow_id, document_id, document_type, amount, current_step_order, status, assigned_to_user_id)
       VALUES (:companyId, :workflow_id, :document_id, :document_type, :amount, :step_order, 'PENDING', :user_id)`,
      {
        companyId,
        workflow_id,
        document_id,
        document_type: document_type || workflow.document_type,
        amount: toNumber(req.body.amount, 0),
        step_order: firstStep.step_order,
        user_id: firstAssigned,
      },
    );

    await query(
      `INSERT INTO adm_workflow_tasks
       (company_id, workflow_id, document_workflow_id, document_id, document_type, step_order, assigned_to_user_id, action)
       VALUES (:companyId, :workflow_id, :dw_id, :document_id, :document_type, :step_order, :assigned_to, 'PENDING')`,
      {
        companyId,
        workflow_id,
        dw_id: result.insertId,
        document_id,
        document_type: document_type || workflow.document_type,
        step_order: firstStep.step_order,
        assigned_to: firstAssigned,
      },
    );

    await query(
      `INSERT INTO adm_workflow_logs (document_workflow_id, step_order, action, actor_user_id, comments)
       VALUES (:id, :step, 'SUBMIT', :userId, 'Workflow started')`,
      {
        id: result.insertId,
        step: firstStep.step_order,
        userId: req.user.sub,
      },
    );

    res.status(201).json({
      message: "Workflow started",
      instanceId: result.insertId,
    });
  } catch (err) {
    next(err);
  }
};

export const getPendingApprovals = async (req, res, next) => {
  try {
    await ensureWorkflowTables();
    const { companyId } = req.scope;
    const userId = req.user.sub;
    const items = await query(
      `SELECT 
          dw.id as workflow_instance_id,
          dw.document_id,
          dw.document_type,
          dw.amount,
          dw.current_step_order,
          dw.created_at as submitted_at,
          w.workflow_name,
          ws.step_name,
          COALESCE(fv.voucher_no, po.po_no, mr.requisition_no, rts.rts_no, sa.adjustment_no, grn.grn_no) as doc_ref,
          po.po_type as po_type,
          u.username as initiator,
          (
            SELECT COUNT(*) = 0 
            FROM adm_workflow_steps 
            WHERE workflow_id = w.id AND step_order > dw.current_step_order
          ) as is_last_step
         FROM adm_document_workflows dw
         JOIN adm_workflows w ON dw.workflow_id = w.id
         JOIN adm_workflow_steps ws ON w.id = ws.workflow_id AND dw.current_step_order = ws.step_order
         LEFT JOIN pur_orders po
           ON (dw.document_type = 'PURCHASE_ORDER' OR dw.document_type = 'Purchase Order')
          AND po.id = dw.document_id
         LEFT JOIN inv_material_requisitions mr 
           ON (dw.document_type = 'MATERIAL_REQUISITION' OR dw.document_type = 'Material Requisition') 
          AND mr.id = dw.document_id
         LEFT JOIN inv_return_to_stores rts 
           ON (dw.document_type = 'RETURN_TO_STORES' OR dw.document_type = 'Return to Stores') 
          AND rts.id = dw.document_id
         LEFT JOIN inv_stock_adjustments sa
           ON (dw.document_type = 'STOCK_ADJUSTMENT' OR dw.document_type = 'Stock Adjustment')
          AND sa.id = dw.document_id
         LEFT JOIN inv_goods_receipt_notes grn
           ON (
             dw.document_type = 'GOODS_RECEIPT' OR 
             dw.document_type = 'Goods Receipt' OR
             dw.document_type = 'GRN' OR
             dw.document_type = 'Goods Receipt Note'
           )
          AND grn.id = dw.document_id
         LEFT JOIN fin_vouchers fv
           ON (
             dw.document_type = 'PAYMENT_VOUCHER' OR
             dw.document_type = 'Payment Voucher' OR
             dw.document_type = 'PV' OR
             dw.document_type = 'RECEIPT_VOUCHER' OR
             dw.document_type = 'Receipt Voucher' OR
             dw.document_type = 'RV'
           )
          AND fv.id = dw.document_id
         LEFT JOIN adm_users u ON u.id = (
             SELECT actor_user_id FROM adm_workflow_logs 
             WHERE document_workflow_id = dw.id AND action = 'SUBMIT' LIMIT 1
         )
         WHERE dw.company_id = :companyId
           AND dw.status = 'PENDING'
           AND dw.assigned_to_user_id = :userId
         ORDER BY dw.created_at DESC`,
      { companyId, userId },
    );
    res.json({ items });
  } catch (err) {
    next(err);
  }
};

export const getApprovalInstanceDetail = async (req, res, next) => {
  try {
    await ensureWorkflowTables();
    const { instanceId } = req.params;
    const { companyId } = req.scope;
    const instances = await query(
      `SELECT dw.*, 
               w.workflow_name, w.workflow_code,
               ws.step_name, ws.approver_user_id, ws.approval_limit,
               (SELECT COUNT(*) FROM adm_workflow_steps WHERE workflow_id = w.id AND step_order > dw.current_step_order) = 0 as is_last_step
        FROM adm_document_workflows dw
        JOIN adm_workflows w ON dw.workflow_id = w.id
        JOIN adm_workflow_steps ws ON w.id = ws.workflow_id AND dw.current_step_order = ws.step_order
        WHERE dw.id = :instanceId AND dw.company_id = :companyId`,
      { instanceId, companyId },
    );
    if (!instances.length)
      throw httpError(404, "NOT_FOUND", "Instance not found");
    const instance = instances[0];
    let next_step_order = null;
    const nextStepRow = await query(
      `SELECT step_order 
         FROM adm_workflow_steps 
         WHERE workflow_id = :wid AND step_order > :cur
         ORDER BY step_order ASC LIMIT 1`,
      { wid: instance.workflow_id, cur: instance.current_step_order },
    );
    if (nextStepRow.length) {
      next_step_order = nextStepRow[0].step_order;
    }
    let next_step_approvers = [];
    if (next_step_order != null) {
      next_step_approvers = await query(
        `SELECT a.approver_user_id as id, u.username, a.approval_limit
           FROM adm_workflow_step_approvers a
           JOIN adm_users u ON u.id = a.approver_user_id
           WHERE a.workflow_id = :wid AND a.step_order = :ord
           ORDER BY u.username ASC`,
        { wid: instance.workflow_id, ord: next_step_order },
      );
    }
    const logs = await query(
      `SELECT l.*, u.username as actor_name 
       FROM adm_workflow_logs l
       LEFT JOIN adm_users u ON l.actor_user_id = u.id
       WHERE l.document_workflow_id = :instanceId
       ORDER BY l.created_at DESC`,
      { instanceId },
    );
    res.json({
      item: { ...instance, logs, next_step_order, next_step_approvers },
    });
  } catch (err) {
    next(err);
  }
};

export const getNotifications = async (req, res, next) => {
  try {
    const userId = req.user.sub;
    const items = await query(
      `SELECT * FROM adm_notifications 
         WHERE user_id = :userId 
         ORDER BY created_at DESC 
         LIMIT 50`,
      { userId },
    );
    res.json({ items });
  } catch (err) {
    next(err);
  }
};

export const markNotificationRead = async (req, res, next) => {
  try {
    const id = toNumber(req.params.id);
    await query(
      "UPDATE adm_notifications SET is_read = 1 WHERE id = :id AND user_id = :userId",
      { id, userId: req.user.sub },
    );
    res.json({ message: "Marked as read" });
  } catch (err) {
    next(err);
  }
};

export const performAction = async (req, res, next) => {
  try {
    const { instanceId } = req.params;
    const { action, comments } = req.body;
    const userId = req.user.sub;
    if (!["APPROVE", "REJECT", "RETURN"].includes(action)) {
      throw httpError(400, "VALIDATION_ERROR", "Invalid action");
    }
    const instances = await query(
      `SELECT dw.*, w.id as workflow_id
         FROM adm_document_workflows dw
         JOIN adm_workflows w ON dw.workflow_id = w.id
         WHERE dw.id = :instanceId`,
      { instanceId },
    );
    if (!instances.length)
      throw httpError(404, "NOT_FOUND", "Workflow instance not found");
    const instance = instances[0];
    if (instance.assigned_to_user_id !== userId) {
      throw httpError(
        403,
        "FORBIDDEN",
        "You are not authorized to approve this step (Assigned to someone else)",
      );
    }
    const currentStepRes = await query(
      `SELECT * FROM adm_workflow_steps 
         WHERE workflow_id = :workflowId AND step_order = :stepOrder`,
      {
        workflowId: instance.workflow_id,
        stepOrder: instance.current_step_order,
      },
    );
    const currentStep = currentStepRes[0];
    if (
      action === "APPROVE" &&
      currentStep.approval_limit !== null &&
      instance.amount > currentStep.approval_limit
    ) {
      const isLastStep = await query(
        `SELECT COUNT(*) as count FROM adm_workflow_steps WHERE workflow_id = :wid AND step_order > :ord`,
        { wid: instance.workflow_id, ord: instance.current_step_order },
      );
      if (isLastStep[0].count === 0) {
        throw httpError(
          403,
          "FORBIDDEN",
          `Amount ${instance.amount} exceeds your approval limit of ${currentStep.approval_limit}. You cannot final approve.`,
        );
      }
    }
    await query(
      `INSERT INTO adm_workflow_logs (document_workflow_id, step_order, action, actor_user_id, comments)
         VALUES (:id, :step, :action, :userId, :comments)`,
      {
        id: instance.id,
        step: instance.current_step_order,
        action,
        userId,
        comments: comments || "",
      },
    );
    const getInitiator = async () => {
      const logs = await query(
        "SELECT actor_user_id FROM adm_workflow_logs WHERE document_workflow_id = :id AND action = 'SUBMIT' LIMIT 1",
        { id: instance.id },
      );
      return logs.length ? logs[0].actor_user_id : null;
    };
    const notifyUser = async (targetUserId, title, message) => {
      if (!targetUserId) return;
      await query(
        `INSERT INTO adm_notifications (company_id, user_id, title, message, link, is_read) 
           VALUES (:companyId, :userId, :title, :message, :link, 0)`,
        {
          companyId: req.scope.companyId,
          userId: targetUserId,
          title,
          message,
          link: `/administration/workflows/approvals/${instance.id}`,
        },
      );
      const userRes = await query(
        "SELECT email FROM adm_users WHERE id = :id",
        { id: targetUserId },
      );
      if (userRes.length && userRes[0].email) {
        const to = userRes[0].email;
        const subject = title;
        const text = `${message} View: ${req.protocol}://${req.headers.host}/administration/workflows/approvals/${instance.id}`;
        const html = `<p>${message}</p><p><a href="/administration/workflows/approvals/${instance.id}">Open Approval</a></p>`;
        if (isMailerConfigured()) {
          try {
            await sendMail({ to, subject, text, html });
          } catch (e) {
            console.log(`[EMAIL ERROR] ${e?.message || e}`);
          }
        } else {
          console.log(`[MOCK EMAIL] To: ${to} | Subject: ${subject} | Body: ${text}`);
        }
      }
    };
    if (action === "APPROVE") {
      const nextSteps = await query(
        `SELECT * FROM adm_workflow_steps 
            WHERE workflow_id = :workflowId AND step_order > :currentOrder 
            ORDER BY step_order ASC LIMIT 1`,
        {
          workflowId: instance.workflow_id,
          currentOrder: instance.current_step_order,
        },
      );
      if (nextSteps.length > 0) {
        const nextStep = nextSteps[0];
        if (!nextStep.approver_user_id) {
          throw httpError(
            400,
            "BAD_REQUEST",
            "Next workflow step has no approver_user_id configured",
          );
        }
        const allowedUsers = await query(
          `SELECT approver_user_id 
             FROM adm_workflow_step_approvers 
             WHERE workflow_id = :wid AND step_order = :ord`,
          { wid: instance.workflow_id, ord: nextStep.step_order },
        );
        const allowedSet = new Set(
          allowedUsers.map((r) => Number(r.approver_user_id)),
        );
        const targetUserIdRaw = req.body?.target_user_id;
        let nextAssigned = null;
        if (targetUserIdRaw != null && allowedSet.has(Number(targetUserIdRaw))) {
          nextAssigned = Number(targetUserIdRaw);
        } else if (allowedUsers.length > 0) {
          nextAssigned = Number(allowedUsers[0].approver_user_id);
        } else {
          nextAssigned = Number(nextStep.approver_user_id);
        }
        await query(
          `UPDATE adm_document_workflows 
              SET current_step_order = :nextOrder, assigned_to_user_id = :nextUser 
              WHERE id = :id`,
          {
            id: instance.id,
            nextOrder: nextStep.step_order,
            nextUser: nextAssigned,
          },
        );
        await query(
          `UPDATE adm_workflow_tasks
             SET action = 'APPROVED'
             WHERE document_workflow_id = :dw AND step_order = :cur`,
          { dw: instance.id, cur: instance.current_step_order },
        );
        await query(
          `INSERT INTO adm_workflow_tasks
             (company_id, workflow_id, document_workflow_id, document_id, document_type, step_order, assigned_to_user_id, action)
             VALUES (:companyId, :workflow_id, :dw_id, :document_id, :document_type, :step_order, :assigned_to, 'PENDING')`,
          {
            companyId: req.scope.companyId,
            workflow_id: instance.workflow_id,
            dw_id: instance.id,
            document_id: instance.document_id,
            document_type: instance.document_type,
            step_order: nextStep.step_order,
            assigned_to: nextAssigned,
          },
        );
        await notifyUser(
          nextAssigned,
          "Approval Required",
          `Document #${instance.document_id} requires your approval.`,
        );
      } else {
        await query(
          `UPDATE adm_document_workflows SET status = 'APPROVED', assigned_to_user_id = NULL WHERE id = :id`,
          { id: instance.id },
        );
        await query(
          `UPDATE adm_workflow_tasks
             SET action = 'APPROVED'
             WHERE document_workflow_id = :dw AND step_order = :cur`,
          { dw: instance.id, cur: instance.current_step_order },
        );
        const initiatorId = await getInitiator();
        await notifyUser(
          initiatorId,
          "Document Approved",
          `Your document #${instance.document_id} has been fully approved.`,
        );
      }
    } else if (action === "REJECT") {
      await query(
        `UPDATE adm_document_workflows SET status = 'REJECTED', assigned_to_user_id = NULL WHERE id = :id`,
        { id: instance.id },
      );
      await query(
        `UPDATE adm_workflow_tasks
           SET action = 'REJECTED'
           WHERE document_workflow_id = :dw AND step_order = :cur`,
        { dw: instance.id, cur: instance.current_step_order },
      );
      if (
        instance.document_type === "STOCK_ADJUSTMENT" ||
        instance.document_type === "Stock Adjustment"
      ) {
        await query(
          `UPDATE inv_stock_adjustments SET status = 'REJECTED' WHERE id = :id AND company_id = :companyId`,
          { id: instance.document_id, companyId: instance.company_id },
        );
      } else if (
        instance.document_type === "PURCHASE_ORDER" ||
        instance.document_type === "Purchase Order"
      ) {
        await query(
          `UPDATE pur_orders SET status = 'REJECTED' WHERE id = :id AND company_id = :companyId`,
          { id: instance.document_id, companyId: instance.company_id },
        );
      } else if (
        instance.document_type === "GOODS_RECEIPT" ||
        instance.document_type === "Goods Receipt" ||
        instance.document_type === "GRN" ||
        instance.document_type === "Goods Receipt Note"
      ) {
        await query(
          `UPDATE inv_goods_receipt_notes SET status = 'REJECTED' WHERE id = :id AND company_id = :companyId`,
          { id: instance.document_id, companyId: instance.company_id },
        );
      } else if (
        instance.document_type === "PAYMENT_VOUCHER" ||
        instance.document_type === "Payment Voucher" ||
        instance.document_type === "PV"
      ) {
        await query(
          `UPDATE fin_vouchers SET status = 'REJECTED' WHERE id = :id AND company_id = :companyId`,
          { id: instance.document_id, companyId: instance.company_id },
        );
      } else if (
        instance.document_type === "RECEIPT_VOUCHER" ||
        instance.document_type === "Receipt Voucher" ||
        instance.document_type === "RV"
      ) {
        await query(
          `UPDATE fin_vouchers SET status = 'REJECTED' WHERE id = :id AND company_id = :companyId`,
          { id: instance.document_id, companyId: instance.company_id },
        );
      } else if (
        instance.document_type === "SALES_ORDER" ||
        instance.document_type === "Sales Order"
      ) {
        await query(
          `UPDATE sal_orders SET status = 'REJECTED' WHERE id = :id AND company_id = :companyId`,
          { id: instance.document_id, companyId: instance.company_id },
        );
      }
      const initiatorId = await getInitiator();
      await notifyUser(
        initiatorId,
        "Document Rejected",
        `Your document #${instance.document_id} was rejected.`,
      );
    } else if (action === "RETURN") {
      await query(
        `UPDATE adm_document_workflows SET status = 'RETURNED', assigned_to_user_id = NULL WHERE id = :id`,
        { id: instance.id },
      );
      await query(
        `UPDATE adm_workflow_tasks
           SET action = 'RETURNED'
           WHERE document_workflow_id = :dw AND step_order = :cur`,
        { dw: instance.id, cur: instance.current_step_order },
      );
      if (
        instance.document_type === "STOCK_ADJUSTMENT" ||
        instance.document_type === "Stock Adjustment"
      ) {
        await query(
          `UPDATE inv_stock_adjustments SET status = 'REVERSED' WHERE id = :id AND company_id = :companyId`,
          { id: instance.document_id, companyId: instance.company_id },
        );
      } else if (
        instance.document_type === "PURCHASE_ORDER" ||
        instance.document_type === "Purchase Order"
      ) {
        await query(
          `UPDATE pur_orders SET status = 'REVERSED' WHERE id = :id AND company_id = :companyId`,
          { id: instance.document_id, companyId: instance.company_id },
        );
      } else if (
        instance.document_type === "GOODS_RECEIPT" ||
        instance.document_type === "Goods Receipt" ||
        instance.document_type === "GRN" ||
        instance.document_type === "Goods Receipt Note"
      ) {
        await query(
          `UPDATE inv_goods_receipt_notes SET status = 'REVERSED' WHERE id = :id AND company_id = :companyId`,
          { id: instance.document_id, companyId: instance.company_id },
        );
      } else if (
        instance.document_type === "PAYMENT_VOUCHER" ||
        instance.document_type === "Payment Voucher" ||
        instance.document_type === "PV"
      ) {
        await query(
          `UPDATE fin_vouchers SET status = 'REVERSED' WHERE id = :id AND company_id = :companyId`,
          { id: instance.document_id, companyId: instance.company_id },
        );
      } else if (
        instance.document_type === "RECEIPT_VOUCHER" ||
        instance.document_type === "Receipt Voucher" ||
        instance.document_type === "RV"
      ) {
        await query(
          `UPDATE fin_vouchers SET status = 'REVERSED' WHERE id = :id AND company_id = :companyId`,
          { id: instance.document_id, companyId: instance.company_id },
        );
      } else if (
        instance.document_type === "CONTRA_VOUCHER" ||
        instance.document_type === "Contra Voucher" ||
        instance.document_type === "CV"
      ) {
        await query(
          `UPDATE fin_vouchers SET status = 'REVERSED' WHERE id = :id AND company_id = :companyId`,
          { id: instance.document_id, companyId: instance.company_id },
        );
      } else if (
        instance.document_type === "MATERIAL_REQUISITION" ||
        instance.document_type === "Material Requisition"
      ) {
        try {
          await query(
            `UPDATE inv_material_requisitions SET status = 'REVERSED' WHERE id = :id AND company_id = :companyId`,
            { id: instance.document_id, companyId: instance.company_id },
          );
        } catch (e) {}
      } else if (
        instance.document_type === "RETURN_TO_STORES" ||
        instance.document_type === "Return to Stores"
      ) {
        try {
          await query(
            `UPDATE inv_return_to_stores SET status = 'REVERSED' WHERE id = :id AND company_id = :companyId`,
            { id: instance.document_id, companyId: instance.company_id },
          );
        } catch (e) {}
      } else if (instance.document_type === "SALES_RETURN") {
        try {
          await query(
            `UPDATE sal_returns SET status = 'REVERSED' WHERE id = :id AND company_id = :companyId`,
            { id: instance.document_id, companyId: instance.company_id },
          );
        } catch (e) {}
      } else if (
        instance.document_type === "SALES_ORDER" ||
        instance.document_type === "Sales Order"
      ) {
        try {
          await query(
            `UPDATE sal_orders SET status = 'REVERSED' WHERE id = :id AND company_id = :companyId`,
            { id: instance.document_id, companyId: instance.company_id },
          );
        } catch (e) {}
      }
      const initiatorId = await getInitiator();
      await notifyUser(
        initiatorId,
        "Document Returned",
        `Your document #${instance.document_id} was returned for revision.`,
      );
    }
    if (action === "APPROVE") {
      const finalCheck = await query(
        `SELECT status, document_type, document_id, company_id FROM adm_document_workflows WHERE id = :id`,
        { id: instance.id },
      );
      const wf = finalCheck[0];
      if (wf.status === "APPROVED" && wf.document_type === "SALES_RETURN") {
        let headerRows;
        try {
          headerRows = await query(
            `SELECT id, branch_id, status FROM sal_returns WHERE id = :docId AND company_id = :companyId`,
            { docId: wf.document_id, companyId: wf.company_id },
          );
        } catch (e) {
          if (String(e.code) === "ER_NO_SUCH_TABLE") {
            await query(`
                CREATE TABLE IF NOT EXISTS sal_returns (
                  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
                  company_id BIGINT UNSIGNED NOT NULL,
                  branch_id BIGINT UNSIGNED NOT NULL,
                  return_no VARCHAR(50) NOT NULL,
                  return_date DATE NOT NULL,
                  invoice_id BIGINT UNSIGNED,
                  customer_id BIGINT UNSIGNED,
                  return_type VARCHAR(50) DEFAULT 'DAMAGED',
                  status VARCHAR(20) DEFAULT 'DRAFT',
                  remarks TEXT,
                  total_amount DECIMAL(18,2) DEFAULT 0,
                  created_by BIGINT UNSIGNED,
                  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                  PRIMARY KEY (id),
                  UNIQUE KEY uq_return_no (company_id, branch_id, return_no),
                  INDEX idx_company_branch (company_id, branch_id)
                )
              `);
            await query(`
                CREATE TABLE IF NOT EXISTS sal_return_details (
                  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
                  return_id BIGINT UNSIGNED NOT NULL,
                  item_id BIGINT UNSIGNED NOT NULL,
                  qty_returned DECIMAL(18,4) NOT NULL DEFAULT 0,
                  unit_price DECIMAL(18,4) NOT NULL DEFAULT 0,
                  total_amount DECIMAL(18,4) NOT NULL DEFAULT 0,
                  reason_code VARCHAR(50),
                  remarks TEXT,
                  PRIMARY KEY (id),
                  INDEX idx_return (return_id),
                  CONSTRAINT fk_sal_return_details_header FOREIGN KEY (return_id) REFERENCES sal_returns(id) ON DELETE CASCADE
                )
              `);
            headerRows = await query(
              `SELECT id, branch_id, status FROM sal_returns WHERE id = :docId AND company_id = :companyId`,
              { docId: wf.document_id, companyId: wf.company_id },
            );
          } else {
            throw e;
          }
        }
        if (headerRows.length) {
          const header = headerRows[0];
          if (header.status !== "APPROVED") {
            await query(
              `UPDATE sal_returns SET status = 'APPROVED' WHERE id = :id AND company_id = :companyId`,
              { id: header.id, companyId: wf.company_id },
            );
            const details = await query(
              `SELECT item_id, qty_returned FROM sal_return_details WHERE return_id = :id`,
              { id: header.id },
            );
            for (const d of details) {
              const itemId = toNumber(d.item_id);
              const qtyReturned = Number(d.qty_returned || 0);
              if (itemId && Number.isFinite(qtyReturned) && qtyReturned > 0) {
                await query(
                  `INSERT INTO inv_stock_balances (company_id, branch_id, warehouse_id, item_id, qty)
                     VALUES (:companyId, :branchId, :warehouseId, :itemId, :qtyReturned)
                     ON DUPLICATE KEY UPDATE qty = qty + :qtyReturned`,
                  {
                    companyId: wf.company_id,
                    branchId: header.branch_id,
                    warehouseId: null,
                    itemId,
                    qtyReturned,
                  },
                );
              }
            }
          }
        }
      } else if (
        wf.status === "APPROVED" &&
        (wf.document_type === "Material Requisition" ||
          wf.document_type === "MATERIAL_REQUISITION")
      ) {
        try {
          const mrRows = await query(
            `SELECT id, status FROM inv_material_requisitions WHERE id = :docId AND company_id = :companyId LIMIT 1`,
            { docId: wf.document_id, companyId: wf.company_id },
          );
          if (mrRows.length && mrRows[0].status !== "APPROVED") {
            await query(
              `UPDATE inv_material_requisitions SET status = 'APPROVED' WHERE id = :id AND company_id = :companyId`,
              { id: wf.document_id, companyId: wf.company_id },
            );
          }
        } catch (e) {}
      } else if (
        wf.status === "APPROVED" &&
        (wf.document_type === "RETURN_TO_STORES" ||
          wf.document_type === "Return to Stores")
      ) {
        try {
          const rtsRows = await query(
            `SELECT id, status FROM inv_return_to_stores WHERE id = :docId AND company_id = :CompanyId LIMIT 1`,
            { docId: wf.document_id, CompanyId: wf.company_id },
          );
          if (rtsRows.length && rtsRows[0].status !== "APPROVED") {
            await query(
              `UPDATE inv_return_to_stores SET status = 'APPROVED' WHERE id = :id AND company_id = :companyId`,
              { id: wf.document_id, companyId: wf.company_id },
            );
          }
        } catch (e) {}
      } else if (
        wf.status === "APPROVED" &&
        (wf.document_type === "GOODS_RECEIPT" ||
          wf.document_type === "Goods Receipt" ||
          wf.document_type === "GRN" ||
          wf.document_type === "Goods Receipt Note")
      ) {
        try {
          const grnRows = await query(
            `SELECT id, status, branch_id, warehouse_id FROM inv_goods_receipt_notes WHERE id = :docId AND company_id = :companyId LIMIT 1`,
            { docId: wf.document_id, companyId: wf.company_id },
          );
          if (grnRows.length && grnRows[0].status !== "APPROVED") {
            await query(
              `UPDATE inv_goods_receipt_notes SET status = 'APPROVED' WHERE id = :id AND company_id = :companyId`,
              { id: wf.document_id, companyId: wf.company_id },
            );
            const details = await query(
              `SELECT item_id, qty_accepted FROM inv_goods_receipt_note_details WHERE grn_id = :id`,
              { id: wf.document_id },
            );
            const branchId = Number(grnRows[0].branch_id || 0);
            const warehouseId = grnRows[0].warehouse_id || null;
            for (const d of details) {
              const itemId = Number(d.item_id);
              const qtyAccepted = Number(d.qty_accepted || 0);
              if (itemId && Number.isFinite(qtyAccepted) && qtyAccepted > 0) {
                await query(
                  `INSERT INTO inv_stock_balances (company_id, branch_id, warehouse_id, item_id, qty)
                     VALUES (:companyId, :branchId, :warehouseId, :itemId, :qtyAccepted)
                     ON DUPLICATE KEY UPDATE qty = qty + :qtyAccepted`,
                  {
                    companyId: wf.company_id,
                    branchId,
                    warehouseId,
                    itemId,
                    qtyAccepted,
                  },
                );
              }
            }
          }
        } catch (e) {}
      } else if (
        wf.status === "APPROVED" &&
        (wf.document_type === "STOCK_ADJUSTMENT" ||
          wf.document_type === "Stock Adjustment")
      ) {
        try {
          const adjRows = await query(
            `SELECT id, status, warehouse_id, branch_id FROM inv_stock_adjustments WHERE id = :docId AND company_id = :companyId LIMIT 1`,
            { docId: wf.document_id, companyId: wf.company_id },
          );
          if (adjRows.length && adjRows[0].status !== "APPROVED") {
            await query(
              `UPDATE inv_stock_adjustments SET status = 'APPROVED' WHERE id = :id AND company_id = :companyId`,
              { id: wf.document_id, companyId: wf.company_id },
            );
            const details = await query(
              `SELECT item_id, qty FROM inv_stock_adjustment_details WHERE adjustment_id = :id`,
              { id: wf.document_id },
            );
            const warehouseId = adjRows[0].warehouse_id;
            const branchId = adjRows[0].branch_id || 0;
            if (warehouseId) {
              for (const d of details) {
                const itemId = Number(d.item_id);
                const qtyDiff = Number(d.qty);
                if (itemId && Number.isFinite(qtyDiff) && qtyDiff !== 0) {
                  await query(
                    `INSERT INTO inv_stock_balances (company_id, branch_id, warehouse_id, item_id, qty)
                       VALUES (:companyId, :branchId, :warehouseId, :itemId, :qtyDiff)
                       ON DUPLICATE KEY UPDATE qty = qty + :qtyDiff`,
                    {
                      companyId: wf.company_id,
                      branchId,
                      warehouseId,
                      itemId,
                      qtyDiff,
                    },
                  );
                }
              }
            }
          }
        } catch (e) {}
      } else if (
        wf.status === "APPROVED" &&
        (wf.document_type === "PURCHASE_ORDER" ||
          wf.document_type === "Purchase Order")
      ) {
        try {
          const poRows = await query(
            `SELECT id, status FROM pur_orders WHERE id = :docId AND company_id = :companyId LIMIT 1`,
            { docId: wf.document_id, companyId: wf.company_id },
          );
          if (poRows.length && poRows[0].status !== "APPROVED") {
            await query(
              `UPDATE pur_orders SET status = 'APPROVED' WHERE id = :id AND company_id = :companyId`,
              { id: wf.document_id, companyId: wf.company_id },
            );
          }
        } catch (e) {}
      } else if (
        wf.status === "APPROVED" &&
        (wf.document_type === "GOODS_RECEIPT" ||
          wf.document_type === "Goods Receipt" ||
          wf.document_type === "GRN" ||
          wf.document_type === "Goods Receipt Note")
      ) {
        try {
          const rows = await query(
            `SELECT id, status FROM inv_goods_receipt_notes WHERE id = :docId AND company_id = :companyId LIMIT 1`,
            { docId: wf.document_id, companyId: wf.company_id },
          );
          if (rows.length && rows[0].status !== "APPROVED") {
            await query(
              `UPDATE inv_goods_receipt_notes SET status = 'APPROVED' WHERE id = :id AND company_id = :companyId`,
              { id: wf.document_id, companyId: wf.company_id },
            );
          }
        } catch (e) {}
      } else if (
        wf.status === "APPROVED" &&
        (wf.document_type === "PAYMENT_VOUCHER" ||
          wf.document_type === "Payment Voucher" ||
          wf.document_type === "PV")
      ) {
        try {
          const rows = await query(
            `SELECT id, status FROM fin_vouchers WHERE id = :docId AND company_id = :companyId LIMIT 1`,
            { docId: wf.document_id, companyId: wf.company_id },
          );
          if (rows.length && rows[0].status !== "APPROVED") {
            await query(
              `UPDATE fin_vouchers SET status = 'APPROVED' WHERE id = :id AND company_id = :companyId`,
              { id: wf.document_id, companyId: wf.company_id },
            );
          }
        } catch (e) {}
      } else if (
        wf.status === "APPROVED" &&
        (wf.document_type === "RECEIPT_VOUCHER" ||
          wf.document_type === "Receipt Voucher" ||
          wf.document_type === "RV")
      ) {
        try {
          const rows = await query(
            `SELECT id, status FROM fin_vouchers WHERE id = :docId AND company_id = :companyId LIMIT 1`,
            { docId: wf.document_id, companyId: wf.company_id },
          );
          if (rows.length && rows[0].status !== "APPROVED") {
            await query(
              `UPDATE fin_vouchers SET status = 'APPROVED' WHERE id = :id AND company_id = :companyId`,
              { id: wf.document_id, companyId: wf.company_id },
            );
          }
        } catch (e) {}
      } else if (
        wf.status === "APPROVED" &&
        (wf.document_type === "SALES_ORDER" ||
          wf.document_type === "Sales Order")
      ) {
        try {
          const rows = await query(
            `SELECT id, status FROM sal_orders WHERE id = :docId AND company_id = :companyId LIMIT 1`,
            { docId: wf.document_id, companyId: wf.company_id },
          );
          if (rows.length && rows[0].status !== "CONFIRMED") {
            await query(
              `UPDATE sal_orders SET status = 'CONFIRMED' WHERE id = :id AND company_id = :companyId`,
              { id: wf.document_id, companyId: wf.company_id },
            );
          }
        } catch (e) {}
      }
    }
    res.json({ message: "Action processed successfully" });
  } catch (err) {
    next(err);
  }
};

