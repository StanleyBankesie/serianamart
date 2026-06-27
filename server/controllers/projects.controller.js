import { query } from "../db/pool.js";
import { httpError } from "../utils/httpError.js";
import { pool } from "../db/pool.js";
import { recordMovementTx } from "../services/stock.service.js";

function toNumber(v, fallback = null) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

async function ensureProjectTables(companyId, branchId) {
  await query(`CREATE TABLE IF NOT EXISTS pm_projects (
    id INT AUTO_INCREMENT PRIMARY KEY,
    company_id INT NOT NULL, branch_id INT NOT NULL,
    project_code VARCHAR(50) NOT NULL, project_name VARCHAR(200) NOT NULL,
    client_name VARCHAR(200), manager_id INT, manager_name VARCHAR(200),
    budget DECIMAL(18,4) DEFAULT 0, project_priority VARCHAR(50) DEFAULT 'MEDIUM',
    project_status VARCHAR(50) DEFAULT 'PLANNING',
    start_date DATE, end_date DATE,
    actual_start_date DATE, actual_end_date DATE,
    completion_percent DECIMAL(5,2) DEFAULT 0,
    remarks TEXT, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

  await query(`CREATE TABLE IF NOT EXISTS pm_tasks (
    id INT AUTO_INCREMENT PRIMARY KEY,
    company_id INT NOT NULL, branch_id INT NOT NULL,
    project_id INT NOT NULL, phase_id INT NULL,
    task_title VARCHAR(200) NOT NULL, task_description TEXT,
    assigned_to_id INT, assigned_to_name VARCHAR(200),
    priority VARCHAR(50) DEFAULT 'MEDIUM', status VARCHAR(50) DEFAULT 'PENDING',
    start_date DATE, end_date DATE,
    estimated_hours DECIMAL(10,2) DEFAULT 0, actual_hours DECIMAL(10,2) DEFAULT 0,
    reason_for_delay TEXT,
    completion_percent DECIMAL(5,2) DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

  // Add columns if missing on existing tables
  try { await query(`ALTER TABLE pm_tasks ADD COLUMN reason_for_delay TEXT AFTER actual_hours`); } catch (e) {}
  try { await query(`ALTER TABLE pm_tasks ADD COLUMN completion_percent DECIMAL(5,2) DEFAULT 0 AFTER reason_for_delay`); } catch (e) {}

  await query(`CREATE TABLE IF NOT EXISTS pm_timesheets (
    id INT AUTO_INCREMENT PRIMARY KEY,
    company_id INT NOT NULL, branch_id INT NOT NULL,
    project_id INT NOT NULL, task_id INT NOT NULL,
    user_id INT NOT NULL, user_name VARCHAR(200),
    log_date DATE NOT NULL, hours DECIMAL(10,2) NOT NULL,
    description TEXT, status VARCHAR(50) DEFAULT 'APPROVED',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

  await query(`CREATE TABLE IF NOT EXISTS pm_expenses (
    id INT AUTO_INCREMENT PRIMARY KEY,
    company_id INT NOT NULL, branch_id INT NOT NULL,
    project_id INT NOT NULL, expense_date DATE NOT NULL,
    category VARCHAR(100), amount DECIMAL(18,4) NOT NULL,
    currency VARCHAR(10) DEFAULT 'GHS',
    description TEXT, recorded_by VARCHAR(200),
    status VARCHAR(50) DEFAULT 'PENDING',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

  await query(`CREATE TABLE IF NOT EXISTS pm_milestones (
    id INT AUTO_INCREMENT PRIMARY KEY,
    company_id INT NOT NULL, branch_id INT NOT NULL,
    project_id INT NOT NULL, title VARCHAR(200) NOT NULL,
    due_date DATE, completion_date DATE,
    status VARCHAR(50) DEFAULT 'PENDING',
    remarks TEXT, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

  try { await query(`ALTER TABLE pm_projects ADD COLUMN is_active ENUM('Y','N') DEFAULT 'Y' AFTER remarks`); } catch (e) {}

  await query(`CREATE TABLE IF NOT EXISTS pm_project_managers (
    id INT AUTO_INCREMENT PRIMARY KEY,
    company_id INT NOT NULL, branch_id INT NOT NULL,
    user_id INT NOT NULL,
    is_active ENUM('Y','N') DEFAULT 'Y',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_pm (company_id, branch_id, user_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
}

export const listProjects = async (req, res, next) => {
  try {
    const { companyId, branchId = null } = req.scope || {};
    await ensureProjectTables(companyId, branchId);
    const activeFilter = req.query.active !== 'all' ? " AND p.is_active = 'Y'" : "";
    const items = await query(`SELECT p.*,
          u.username AS created_by_name,
          COALESCE(e.expense_total,0) AS expense_total
         FROM pm_projects p
        LEFT JOIN adm_users u ON u.id = p.created_by
        LEFT JOIN (SELECT project_id, SUM(amount) AS expense_total FROM pm_expenses GROUP BY project_id) e ON p.id = e.project_id
         WHERE p.company_id = :companyId AND p.branch_id = :branchId${activeFilter} ORDER BY p.start_date DESC LIMIT 100`,
      { companyId, branchId },
    );
    res.json({ items });
  } catch (err) {
    next(err);
  }
};

export const getProjectById = async (req, res, next) => {
  try {
    const { companyId, branchId = null } = req.scope || {};
    const id = toNumber(req.params.id);
    if (!id) throw httpError(400, "VALIDATION_ERROR", "Invalid id");
    await ensureProjectTables(companyId, branchId);

    const items = await query(`SELECT p.*,
          u.username AS created_by_name
         FROM pm_projects p
        LEFT JOIN adm_users u ON u.id = p.created_by
         WHERE p.id = :id AND p.company_id = :companyId AND p.branch_id = :branchId LIMIT 1`,
      { id, companyId, branchId },
    );
    if (!items.length) throw httpError(404, "NOT_FOUND", "Project not found");
    res.json({ item: items[0] });
  } catch (err) {
    next(err);
  }
};

export const createProject = async (req, res, next) => {
  try {
    const { companyId, branchId = null } = req.scope || {};
    await ensureProjectTables(companyId, branchId);
    const b = req.body || {};

    if (!b.project_code || !b.project_name)
      throw httpError(400, "VALIDATION_ERROR", "Code and Name are required");

    const result = await query(`INSERT INTO pm_projects 
      (company_id, branch_id, project_code, project_name, client_name, manager_id, manager_name, budget, project_priority, project_status, start_date, end_date, remarks, is_active)
      VALUES (:companyId, :branchId, :project_code, :project_name, :client_name, :manager_id, :manager_name, :budget, :project_priority, :project_status, :start_date, :end_date, :remarks, :is_active)`,
      {
        companyId, branchId,
        project_code: b.project_code,
        project_name: b.project_name,
        client_name: b.client_name || null,
        manager_id: toNumber(b.manager_id),
        manager_name: b.manager_name || null,
        budget: Number(b.budget || 0),
        project_priority: b.project_priority || 'MEDIUM',
        project_status: b.project_status || "PLANNING",
        start_date: b.start_date || null,
        end_date: b.end_date || null,
        remarks: b.remarks || null,
        is_active: 'Y',
      },
    );

    res.status(201).json({ id: result.insertId });
  } catch (err) {
    next(err);
  }
};

export const updateProject = async (req, res, next) => {
  try {
    const { companyId, branchId = null } = req.scope || {};
    const id = toNumber(req.params.id);
    const b = req.body || {};
    await ensureProjectTables(companyId, branchId);

    await query(`UPDATE pm_projects SET
      project_name = :project_name, client_name = :client_name, manager_id = :manager_id,
      manager_name = :manager_name, budget = :budget, project_priority = :project_priority,
      project_status = :project_status, start_date = :start_date, end_date = :end_date,
      actual_start_date = :actual_start_date, actual_end_date = :actual_end_date,
      completion_percent = :completion_percent, remarks = :remarks,
      is_active = :is_active
      WHERE id = :id AND company_id = :companyId AND branch_id = :branchId`,
      {
        id, companyId, branchId,
        project_name: b.project_name,
        client_name: b.client_name || null,
        manager_id: toNumber(b.manager_id),
        manager_name: b.manager_name || null,
        budget: Number(b.budget || 0),
        project_priority: b.project_priority || 'MEDIUM',
        project_status: b.project_status || "PLANNING",
        start_date: b.start_date || null,
        end_date: b.end_date || null,
        actual_start_date: b.actual_start_date || null,
        actual_end_date: b.actual_end_date || null,
        completion_percent: Number(b.completion_percent || 0),
        remarks: b.remarks || null,
        is_active: b.is_active !== undefined ? (b.is_active ? 'Y' : 'N') : 'Y',
      }
    );
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
};

// ===== TASKS =====
export const listTasks = async (req, res, next) => {
  try {
    const { companyId, branchId = null } = req.scope || {};
    const projectId = toNumber(req.query.projectId);
    await ensureProjectTables(companyId, branchId);
    
    let sql = `SELECT t.*, p.project_name, p.project_code
               FROM pm_tasks t
               LEFT JOIN pm_projects p ON t.project_id = p.id
               WHERE t.company_id = :companyId AND t.branch_id = :branchId`;
    if (projectId) sql += ` AND t.project_id = :projectId`;
    sql += ` ORDER BY t.created_at DESC`;

    const items = await query(sql, { companyId, branchId, projectId });
    res.json({ items });
  } catch (err) {
    next(err);
  }
};

export const getTaskById = async (req, res, next) => {
  try {
    const { companyId, branchId = null } = req.scope || {};
    const id = toNumber(req.params.id);
    if (!id) throw httpError(400, "VALIDATION_ERROR", "Invalid task id");
    await ensureProjectTables(companyId, branchId);

    const items = await query(`SELECT t.*, p.project_name, p.project_code
          FROM pm_tasks t
          LEFT JOIN pm_projects p ON t.project_id = p.id
          WHERE t.id = :id AND t.company_id = :companyId AND t.branch_id = :branchId LIMIT 1`,
      { id, companyId, branchId },
    );
    if (!items.length) throw httpError(404, "NOT_FOUND", "Task not found");
    res.json({ item: items[0] });
  } catch (err) {
    next(err);
  }
};

export const createOrUpdateTask = async (req, res, next) => {
  try {
    const { companyId, branchId = null } = req.scope || {};
    const b = req.body || {};
    await ensureProjectTables(companyId, branchId);

    const taskId = toNumber(req.params.id) || b.id;

    if (taskId) {
      await query(`UPDATE pm_tasks SET
        task_title = :task_title, task_description = :task_description,
        assigned_to_id = :assigned_to_id, assigned_to_name = :assigned_to_name,
        priority = :priority, status = :status,
        start_date = :start_date, end_date = :end_date,
        estimated_hours = :estimated_hours, actual_hours = :actual_hours,
        reason_for_delay = :reason_for_delay,
        completion_percent = :completion_percent
        WHERE id = :id AND company_id = :companyId AND branch_id = :branchId`,
        { ...b, id: taskId, companyId, branchId }
      );
      res.json({ ok: true });
    } else {
      const r = await query(`INSERT INTO pm_tasks 
        (company_id, branch_id, project_id, task_title, task_description, assigned_to_id, assigned_to_name, priority, status, start_date, end_date, estimated_hours, reason_for_delay, completion_percent)
        VALUES (:companyId, :branchId, :project_id, :task_title, :task_description, :assigned_to_id, :assigned_to_name, :priority, :status, :start_date, :end_date, :estimated_hours, :reason_for_delay, :completion_percent)`,
        {
          ...b, companyId, branchId,
          status: b.status || 'PENDING',
          priority: b.priority || 'MEDIUM'
        }
      );
      res.status(201).json({ id: r.insertId });
    }
  } catch (err) {
    next(err);
  }
};

export const deleteTask = async (req, res, next) => {
  try {
    const { companyId, branchId = null } = req.scope || {};
    const id = toNumber(req.params.id);
    if (!id) throw httpError(400, "VALIDATION_ERROR", "Invalid id");
    await query(`DELETE FROM pm_tasks WHERE id = :id AND company_id = :companyId AND branch_id = :branchId`, { id, companyId, branchId });
    res.json({ ok: true });
  } catch (err) { next(err); }
};

export const deleteProject = async (req, res, next) => {
  try {
    const { companyId, branchId = null } = req.scope || {};
    const id = toNumber(req.params.id);
    if (!id) throw httpError(400, "VALIDATION_ERROR", "Invalid id");
    await query(`DELETE FROM pm_projects WHERE id = :id AND company_id = :companyId AND branch_id = :branchId`, { id, companyId, branchId });
    res.json({ ok: true });
  } catch (err) { next(err); }
};

// ===== PROJECT MANAGERS =====
export const listProjectManagers = async (req, res, next) => {
  try {
    const { companyId, branchId = null } = req.scope || {};
    const rows = await query(
      `SELECT pm.id, pm.user_id, pm.is_active, u.username, u.email
       FROM pm_project_managers pm
       JOIN adm_users u ON u.id = pm.user_id
       WHERE pm.company_id = :companyId AND pm.branch_id = :branchId
       ORDER BY u.username ASC`,
      { companyId, branchId },
    );
    res.json({ items: rows || [] });
  } catch (err) { next(err); }
};

export const createProjectManager = async (req, res, next) => {
  try {
    const { companyId, branchId = null } = req.scope || {};
    const userId = toNumber(req.body?.user_id);
    if (!userId) return next(httpError(400, "VALIDATION_ERROR", "user_id is required"));
    const result = await query(
      `INSERT INTO pm_project_managers (company_id, branch_id, user_id)
       VALUES (:companyId, :branchId, :userId)
       ON DUPLICATE KEY UPDATE is_active = 'Y'`,
      { companyId, branchId, userId },
    );
    res.status(201).json({ id: result.insertId });
  } catch (err) { next(err); }
};

export const removeProjectManager = async (req, res, next) => {
  try {
    const { companyId, branchId = null } = req.scope || {};
    const id = toNumber(req.params.id);
    if (!id) return next(httpError(400, "VALIDATION_ERROR", "Invalid id"));
    await query(
      `DELETE FROM pm_project_managers WHERE id = :id AND company_id = :companyId AND branch_id = :branchId`,
      { id, companyId, branchId },
    );
    res.json({ ok: true });
  } catch (err) { next(err); }
};

// ===== TIMESHEETS =====
export const listTimesheets = async (req, res, next) => {
  try {
    const { companyId, branchId = null } = req.scope || {};
    const projectId = toNumber(req.query.projectId);
    await ensureProjectTables(companyId, branchId);
    
    let sql = `SELECT ts.*, t.task_title, p.project_name FROM pm_timesheets ts 
               JOIN pm_tasks t ON ts.task_id = t.id
               JOIN pm_projects p ON ts.project_id = p.id
               WHERE ts.company_id = :companyId AND ts.branch_id = :branchId`;
    if (projectId) sql += ` AND ts.project_id = :projectId`;
    sql += ` ORDER BY ts.log_date DESC`;

    const items = await query(sql, { companyId, branchId, projectId });
    res.json({ items });
  } catch (err) {
    next(err);
  }
};

export const createTimesheet = async (req, res, next) => {
  try {
    const { companyId, branchId = null } = req.scope || {};
    const b = req.body || {};
    await ensureProjectTables(companyId, branchId);
    
    const r = await query(`INSERT INTO pm_timesheets 
      (company_id, branch_id, project_id, task_id, user_id, user_name, log_date, hours, description)
      VALUES (:companyId, :branchId, :project_id, :task_id, :user_id, :user_name, :log_date, :hours, :description)`,
      { ...b, companyId, branchId, user_id: req.user?.id, user_name: req.user?.full_name }
    );
    
    // Update task actual hours
    await query(`UPDATE pm_tasks SET actual_hours = actual_hours + :hours WHERE id = :task_id`, { hours: b.hours, task_id: b.task_id });
    
    res.status(201).json({ id: r.insertId });
  } catch (err) {
    next(err);
  }
};

export const updateTimesheet = async (req, res, next) => {
  try {
    const { companyId, branchId = null } = req.scope || {};
    const id = toNumber(req.params.id);
    if (!id) throw httpError(400, "VALIDATION_ERROR", "Invalid id");
    const b = req.body;
    const old = await query(`SELECT * FROM pm_timesheets WHERE id = :id AND company_id = :companyId AND branch_id = :branchId`, { id, companyId, branchId });
    if (!old.length) throw httpError(404, "NOT_FOUND", "Timesheet not found");
    const hoursDiff = Number(b.hours || 0) - Number(old[0].hours || 0);
    await query(`UPDATE pm_timesheets SET log_date = :logDate, hours = :hours, description = :description WHERE id = :id`, {
      id, logDate: b.log_date, hours: b.hours, description: b.description
    });
    if (hoursDiff !== 0 && old[0].task_id) {
      await query(`UPDATE pm_tasks SET actual_hours = GREATEST(actual_hours + :diff, 0) WHERE id = :taskId`, { diff: hoursDiff, taskId: old[0].task_id });
    }
    res.json({ ok: true });
  } catch (err) { next(err); }
};

export const deleteTimesheet = async (req, res, next) => {
  try {
    const { companyId, branchId = null } = req.scope || {};
    const id = toNumber(req.params.id);
    if (!id) throw httpError(400, "VALIDATION_ERROR", "Invalid id");
    const old = await query(`SELECT * FROM pm_timesheets WHERE id = :id AND company_id = :companyId AND branch_id = :branchId`, { id, companyId, branchId });
    if (!old.length) throw httpError(404, "NOT_FOUND", "Timesheet not found");
    await query(`DELETE FROM pm_timesheets WHERE id = :id`, { id });
    if (old[0].task_id) {
      await query(`UPDATE pm_tasks SET actual_hours = GREATEST(actual_hours - :hours, 0) WHERE id = :taskId`, { hours: old[0].hours, taskId: old[0].task_id });
    }
    res.json({ ok: true });
  } catch (err) { next(err); }
};

// ===== DASHBOARD =====
export const getPMDashboardStats = async (req, res, next) => {
  try {
    const { companyId, branchId = null } = req.scope || {};
    await ensureProjectTables(companyId, branchId);

    const [projects] = await query(`SELECT COUNT(*) as count FROM pm_projects WHERE company_id = :companyId AND branch_id = :branchId`, { companyId, branchId });
    const [activeTasks] = await query(`SELECT COUNT(*) as count FROM pm_tasks WHERE company_id = :companyId AND branch_id = :branchId AND status IN ('PENDING', 'IN_PROGRESS')`, { companyId, branchId });
    const [budgetRows] = await query(`SELECT SUM(budget) as total FROM pm_projects WHERE company_id = :companyId AND branch_id = :branchId`, { companyId, branchId });
    const [hoursRows] = await query(`SELECT SUM(hours) as total FROM pm_timesheets WHERE company_id = :companyId AND branch_id = :branchId`, { companyId, branchId });

    res.json({
      totalProjects: projects.count,
      activeTasks: activeTasks.count,
      totalBudget: budgetRows.total || 0,
      totalLoggedHours: hoursRows.total || 0
    });
  } catch (err) {
    next(err);
  }
};

// ===== TASK DEPENDENCIES =====
async function ensureTaskDependenciesTable(companyId, branchId) {
  await query(`CREATE TABLE IF NOT EXISTS pm_task_dependencies (
    id INT AUTO_INCREMENT PRIMARY KEY,
    company_id INT NOT NULL, branch_id INT NOT NULL,
    task_id INT NOT NULL,
    predecessor_id INT NOT NULL,
    dependency_type VARCHAR(10) DEFAULT 'FS',
    lag_days INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_task_predecessor (company_id, branch_id, task_id, predecessor_id),
    KEY idx_dep_task (task_id),
    KEY idx_dep_predecessor (predecessor_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`).catch(() => {});
}

export const listTaskDependencies = async (req, res, next) => {
  try {
    const { companyId, branchId = null } = req.scope || {};
    await ensureTaskDependenciesTable(companyId, branchId);
    const taskId = req.query.taskId ? toNumber(req.query.taskId) : null;
    let sql = `SELECT d.*, t.task_title AS task_title, p.task_title AS predecessor_title
      FROM pm_task_dependencies d
      LEFT JOIN pm_tasks t ON d.task_id = t.id
      LEFT JOIN pm_tasks p ON d.predecessor_id = p.id
      WHERE d.company_id = :companyId AND d.branch_id = :branchId`;
    if (taskId) sql += ` AND d.task_id = :taskId`;
    sql += ` ORDER BY d.id`;
    const rows = await query(sql, { companyId, branchId, taskId });
    res.json({ items: rows });
  } catch (err) { next(err); }
};

export const createTaskDependency = async (req, res, next) => {
  try {
    const { companyId, branchId = null } = req.scope || {};
    await ensureTaskDependenciesTable(companyId, branchId);
    const b = req.body;
    if (!b.task_id || !b.predecessor_id) throw httpError(400, "VALIDATION_ERROR", "task_id and predecessor_id required");
    await query(`INSERT INTO pm_task_dependencies (company_id, branch_id, task_id, predecessor_id, dependency_type, lag_days)
      VALUES (:companyId, :branchId, :taskId, :predecessorId, :depType, :lagDays)
      ON DUPLICATE KEY UPDATE dependency_type = VALUES(dependency_type), lag_days = VALUES(lag_days)`, {
      companyId, branchId, taskId: b.task_id, predecessorId: b.predecessor_id,
      depType: b.dependency_type || 'FS', lagDays: b.lag_days || 0
    });
    res.status(201).json({ ok: true });
  } catch (err) { next(err); }
};

export const deleteTaskDependency = async (req, res, next) => {
  try {
    const { companyId, branchId = null } = req.scope || {};
    const id = toNumber(req.params.id);
    if (!id) throw httpError(400, "VALIDATION_ERROR", "Invalid id");
    await query(`DELETE FROM pm_task_dependencies WHERE id = :id AND company_id = :companyId AND branch_id = :branchId`, { id, companyId, branchId });
    res.json({ ok: true });
  } catch (err) { next(err); }
};

// ===== EXPENSES CRUD =====
export const listExpenses = async (req, res, next) => {
  try {
    const { companyId, branchId = null } = req.scope || {};
    await ensureProjectTables(companyId, branchId);
    const projectId = toNumber(req.query.projectId);
    let sql = `SELECT e.*, p.project_name, u.username AS created_by_name
      FROM pm_expenses e
      LEFT JOIN pm_projects p ON e.project_id = p.id
      LEFT JOIN adm_users u ON e.recorded_by = u.username
      WHERE e.company_id = :companyId AND e.branch_id = :branchId`;
    if (projectId) sql += ` AND e.project_id = :projectId`;
    sql += ` ORDER BY e.expense_date DESC`;
    const rows = await query(sql, { companyId, branchId, projectId });
    res.json({ items: rows });
  } catch (err) { next(err); }
};

export const createExpense = async (req, res, next) => {
  try {
    const { companyId, branchId = null } = req.scope || {};
    await ensureProjectTables(companyId, branchId);
    const b = req.body;
    if (!b.project_id || !b.amount) throw httpError(400, "VALIDATION_ERROR", "project_id and amount required");
    const r = await query(`INSERT INTO pm_expenses (company_id, branch_id, project_id, expense_date, category, amount, currency, description, recorded_by, status)
      VALUES (:companyId, :branchId, :projectId, :expenseDate, :category, :amount, :currency, :description, :recordedBy, :status)`, {
      companyId, branchId,
      projectId: toNumber(b.project_id),
      expenseDate: b.expense_date || new Date().toISOString().split('T')[0],
      category: b.category || 'OTHER',
      amount: Number(b.amount || 0),
      currency: b.currency || 'GHS',
      description: b.description || null,
      recordedBy: req.user?.username || null,
      status: b.status || 'PENDING'
    });
    res.status(201).json({ id: r.insertId });
  } catch (err) { next(err); }
};

export const updateExpense = async (req, res, next) => {
  try {
    const { companyId, branchId = null } = req.scope || {};
    const id = toNumber(req.params.id);
    if (!id) throw httpError(400, "VALIDATION_ERROR", "Invalid id");
    const b = req.body;
    await query(`UPDATE pm_expenses SET expense_date = :expenseDate, category = :category, amount = :amount, description = :description, status = :status WHERE id = :id AND company_id = :companyId AND branch_id = :branchId`, {
      id, companyId, branchId,
      expenseDate: b.expense_date || null,
      category: b.category || 'OTHER',
      amount: Number(b.amount || 0),
      description: b.description || null,
      status: b.status || 'PENDING'
    });
    res.json({ ok: true });
  } catch (err) { next(err); }
};

export const deleteExpense = async (req, res, next) => {
  try {
    const { companyId, branchId = null } = req.scope || {};
    const id = toNumber(req.params.id);
    if (!id) throw httpError(400, "VALIDATION_ERROR", "Invalid id");
    await query(`DELETE FROM pm_expenses WHERE id = :id AND company_id = :companyId AND branch_id = :branchId`, { id, companyId, branchId });
    res.json({ ok: true });
  } catch (err) { next(err); }
};

// ===== ENHANCED DASHBOARD STATS =====
export const getPMDashboardDetail = async (req, res, next) => {
  try {
    const { companyId, branchId = null } = req.scope || {};
    await ensureProjectTables(companyId, branchId);
    const [projectStats] = await query(`SELECT
      COUNT(*) AS total, SUM(CASE WHEN project_status = 'IN_PROGRESS' THEN 1 ELSE 0 END) AS active,
      SUM(CASE WHEN project_status = 'PLANNING' THEN 1 ELSE 0 END) AS planning,
      SUM(CASE WHEN project_status = 'COMPLETED' THEN 1 ELSE 0 END) AS completed,
      SUM(budget) AS total_budget
      FROM pm_projects WHERE company_id = :companyId AND branch_id = :branchId`, { companyId, branchId });
    const [taskStats] = await query(`SELECT COUNT(*) AS total,
      SUM(CASE WHEN status IN ('PENDING','IN_PROGRESS') THEN 1 ELSE 0 END) AS open,
      SUM(CASE WHEN status = 'COMPLETED' THEN 1 ELSE 0 END) AS completed,
      SUM(CASE WHEN status = 'BLOCKED' THEN 1 ELSE 0 END) AS blocked
      FROM pm_tasks WHERE company_id = :companyId AND branch_id = :branchId`, { companyId, branchId });
    const [hoursRow] = await query(`SELECT COALESCE(SUM(hours),0) AS total FROM pm_timesheets WHERE company_id = :companyId AND branch_id = :branchId`, { companyId, branchId });
    const [expenseRow] = await query(`SELECT COALESCE(SUM(amount),0) AS total FROM pm_expenses WHERE company_id = :companyId AND branch_id = :branchId`, { companyId, branchId });
    res.json({
      projects: projectStats,
      tasks: taskStats,
      totalLoggedHours: hoursRow.total,
      totalExpenses: expenseRow.total
    });
  } catch (err) { next(err); }
};

// ===== BUDGET VS ACTUAL =====
export const getBudgetVsActual = async (req, res, next) => {
  try {
    const { companyId, branchId = null } = req.scope || {};
    await ensureProjectTables(companyId, branchId);
    const rows = await query(`SELECT
      p.id, p.project_name, p.project_code, p.project_status, p.budget, p.completion_percent,
      COALESCE(e.total_expense,0) AS total_expense,
      COALESCE(t.total_labor,0) AS total_labor,
      (COALESCE(e.total_expense,0) + COALESCE(t.total_labor,0)) AS total_spent,
      GREATEST(p.budget - COALESCE(e.total_expense,0) - COALESCE(t.total_labor,0), 0) AS remaining,
      CASE WHEN p.budget > 0
        THEN ROUND(((COALESCE(e.total_expense,0) + COALESCE(t.total_labor,0)) / p.budget) * 100, 1)
        ELSE 0 END AS spend_pct
      FROM pm_projects p
      LEFT JOIN (SELECT project_id, SUM(amount) AS total_expense FROM pm_expenses GROUP BY project_id) e ON p.id = e.project_id
      LEFT JOIN (SELECT project_id, SUM(hours * 50) AS total_labor FROM pm_timesheets GROUP BY project_id) t ON p.id = t.project_id
      WHERE p.company_id = :companyId AND p.branch_id = :branchId
      ORDER BY spend_pct DESC`, { companyId, branchId });
    res.json({ items: rows });
  } catch (err) { next(err); }
};

// ===== PROJECT DETAIL DASHBOARD =====
export const getProjectDetail = async (req, res, next) => {
  try {
    const { companyId, branchId = null } = req.scope || {};
    const projectId = toNumber(req.params.id);
    if (!projectId) throw httpError(400, "VALIDATION_ERROR", "Invalid id");
    await ensureProjectTables(companyId, branchId);

    const [project] = await query(`SELECT * FROM pm_projects WHERE id = :projectId AND company_id = :companyId AND branch_id = :branchId`, { projectId, companyId, branchId });
    if (!project) throw httpError(404, "NOT_FOUND", "Project not found");

    const tasks = await query(`SELECT * FROM pm_tasks WHERE project_id = :projectId AND company_id = :companyId AND branch_id = :branchId ORDER BY start_date ASC`, { projectId, companyId, branchId });

    const [hoursRow] = await query(`SELECT COALESCE(SUM(hours),0) AS total FROM pm_timesheets WHERE project_id = :projectId AND company_id = :companyId AND branch_id = :branchId`, { projectId, companyId, branchId });

    const [expenseRow] = await query(`SELECT COALESCE(SUM(amount),0) AS total FROM pm_expenses WHERE project_id = :projectId AND company_id = :companyId AND branch_id = :branchId`, { projectId, companyId, branchId });

    const deps = await query(`SELECT d.*, pt.task_title AS predecessor_title FROM pm_task_dependencies d LEFT JOIN pm_tasks pt ON d.predecessor_id = pt.id WHERE d.task_id IN (SELECT id FROM pm_tasks WHERE project_id = :projectId) AND d.company_id = :companyId AND d.branch_id = :branchId`, { projectId, companyId, branchId });

    const laborCost = hoursRow.total * 50;
    res.json({
      project,
      tasks,
      totalHours: hoursRow.total,
      totalExpenses: expenseRow.total,
      totalLaborCost: laborCost,
      totalSpent: expenseRow.total + laborCost,
      remaining: Math.max(project.budget - expenseRow.total - laborCost, 0),
      spendPct: project.budget > 0 ? Number(((expenseRow.total + laborCost) / project.budget) * 100).toFixed(1) : 0,
      dependencies: deps
    });
  } catch (err) { next(err); }
};

// ===== PM MATERIAL REQUISITION TABLES (shared with inventory) =====
async function ensurePMMaterialRequisitionTables(companyId, branchId) {
  try { await query(`ALTER TABLE inv_material_requisitions ADD COLUMN IF NOT EXISTS project_id BIGINT UNSIGNED DEFAULT NULL AFTER department_id`); } catch (e) {}
  try { await query(`ALTER TABLE inv_material_requisition_details ADD COLUMN IF NOT EXISTS qty_received DECIMAL(18,3) NOT NULL DEFAULT 0 AFTER qty_issued`); } catch (e) {}
  try { await query(`ALTER TABLE inv_material_requisition_details ADD COLUMN IF NOT EXISTS uom VARCHAR(20) DEFAULT 'PCS' AFTER qty_received`); } catch (e) {}
}

async function nextPMMRNo(companyId, branchId) {
  const rows = await query(`SELECT requisition_no FROM inv_material_requisitions WHERE company_id = :companyId AND branch_id = :branchId AND requisition_no LIKE 'MR-%' ORDER BY CAST(SUBSTRING(requisition_no, 4) AS UNSIGNED) DESC LIMIT 1`, { companyId, branchId });
  let nextNum = 1;
  if (rows.length > 0) {
    const prev = String(rows[0].requisition_no || "");
    const numPart = prev.slice(3);
    const n = parseInt(numPart, 10);
    if (Number.isFinite(n)) nextNum = n + 1;
  }
  return `MR-${String(nextNum).padStart(6, "0")}`;
}

// ===== PM MATERIAL UTILIZATION TABLES =====
async function ensurePMMaterialUtilizationTables(companyId, branchId) {
  await query(`CREATE TABLE IF NOT EXISTS pm_material_utilization (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    company_id BIGINT UNSIGNED NOT NULL,
    branch_id BIGINT UNSIGNED NOT NULL,
    utilization_no VARCHAR(50) NOT NULL,
    utilization_date DATE NOT NULL,
    project_id INT NOT NULL,
    task_id INT DEFAULT NULL,
    task_summary VARCHAR(500) DEFAULT NULL,
    location VARCHAR(255) DEFAULT NULL,
    warehouse_id BIGINT UNSIGNED DEFAULT NULL,
    remarks TEXT,
    status VARCHAR(30) DEFAULT 'DRAFT',
    created_by BIGINT UNSIGNED DEFAULT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_pm_mu_scope_no (company_id, branch_id, utilization_no)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

  await query(`ALTER TABLE pm_material_utilization ADD COLUMN IF NOT EXISTS warehouse_id BIGINT UNSIGNED DEFAULT NULL AFTER location`).catch(() => {});

  await query(`CREATE TABLE IF NOT EXISTS pm_material_utilization_items (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    utilization_id BIGINT UNSIGNED NOT NULL,
    item_id BIGINT UNSIGNED NOT NULL,
    item_name VARCHAR(255) DEFAULT NULL,
    uom VARCHAR(20) DEFAULT 'PCS',
    required_qty DECIMAL(18,3) NOT NULL DEFAULT 0,
    qty_in_stock DECIMAL(18,3) NOT NULL DEFAULT 0,
    cost_price DECIMAL(18,4) DEFAULT 0,
    PRIMARY KEY (id),
    KEY idx_pm_mui_util (utilization_id),
    CONSTRAINT fk_pm_mui_util FOREIGN KEY (utilization_id) REFERENCES pm_material_utilization (id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
}

async function nextPMUtilNo(companyId, branchId) {
  const rows = await query(`SELECT utilization_no FROM pm_material_utilization WHERE company_id = :companyId AND branch_id = :branchId AND utilization_no LIKE 'MT-%' ORDER BY CAST(SUBSTRING(utilization_no, 4) AS UNSIGNED) DESC LIMIT 1`, { companyId, branchId });
  let nextNum = 1;
  if (rows.length > 0) {
    const prev = String(rows[0].utilization_no || "");
    const numPart = prev.slice(3);
    const n = parseInt(numPart, 10);
    if (Number.isFinite(n)) nextNum = n + 1;
  }
  return `MT-${String(nextNum).padStart(6, "0")}`;
}

// ===== PM MATERIALS RECEIPT TABLES =====
async function ensurePMMaterialReceiptTables(companyId, branchId) {
  await query(`CREATE TABLE IF NOT EXISTS pm_material_receipts (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    company_id BIGINT UNSIGNED NOT NULL,
    branch_id BIGINT UNSIGNED NOT NULL,
    receipt_no VARCHAR(50) NOT NULL,
    receipt_date DATE NOT NULL,
    issue_id BIGINT UNSIGNED DEFAULT NULL,
    source_doc VARCHAR(50) DEFAULT NULL,
    warehouse_id BIGINT UNSIGNED DEFAULT NULL,
    department_id BIGINT UNSIGNED DEFAULT NULL,
    remarks TEXT,
    status VARCHAR(30) DEFAULT 'DRAFT',
    created_by BIGINT UNSIGNED DEFAULT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_pm_mrcpt_scope_no (company_id, branch_id, receipt_no)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

  await query(`CREATE TABLE IF NOT EXISTS pm_material_receipt_items (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    receipt_id BIGINT UNSIGNED NOT NULL,
    item_id BIGINT UNSIGNED NOT NULL,
    item_name VARCHAR(255) DEFAULT NULL,
    uom VARCHAR(20) DEFAULT 'PCS',
    transfer_qty DECIMAL(18,3) NOT NULL DEFAULT 0,
    receipt_qty DECIMAL(18,3) NOT NULL DEFAULT 0,
    batch_no VARCHAR(100) DEFAULT NULL,
    expiry_date DATE DEFAULT NULL,
    mfg_date DATE DEFAULT NULL,
    PRIMARY KEY (id),
    KEY idx_pm_mrcpt_i_rcpt (receipt_id),
    CONSTRAINT fk_pm_mrcpt_i_rcpt FOREIGN KEY (receipt_id) REFERENCES pm_material_receipts (id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
}

async function nextPMRcptNo(companyId, branchId) {
  const rows = await query(`SELECT receipt_no FROM pm_material_receipts WHERE company_id = :companyId AND branch_id = :branchId AND receipt_no LIKE 'RCPT-%' ORDER BY CAST(SUBSTRING(receipt_no, 6) AS UNSIGNED) DESC LIMIT 1`, { companyId, branchId });
  let nextNum = 1;
  if (rows.length > 0) {
    const prev = String(rows[0].receipt_no || "");
    const numPart = prev.slice(5);
    const n = parseInt(numPart, 10);
    if (Number.isFinite(n)) nextNum = n + 1;
  }
  return `RCPT-${String(nextNum).padStart(6, "0")}`;
}

// ===== PM MATERIAL REQUISITION CRUD =====
export const listPMMaterialRequisitions = async (req, res, next) => {
  try {
    const { companyId, branchId = null } = req.scope || {};
    await ensurePMMaterialRequisitionTables(companyId, branchId);
    const rows = await query(`SELECT r.*, p.project_name, w.warehouse_name, d.name AS department_name, u.username AS created_by_name
      FROM inv_material_requisitions r
      LEFT JOIN pm_projects p ON r.project_id = p.id
      LEFT JOIN inv_warehouses w ON r.warehouse_id = w.id
      LEFT JOIN adm_departments d ON r.department_id = d.id
      LEFT JOIN adm_users u ON r.created_by = u.id
      WHERE r.company_id = :companyId AND r.branch_id = :branchId AND r.requisition_type = 'PROJECT' AND COALESCE(r.is_active,'Y') = 'Y'
      ORDER BY r.created_at DESC`, { companyId, branchId });
    res.json({ items: rows });
  } catch (err) { next(err); }
};

export const getPMMaterialRequisitionById = async (req, res, next) => {
  try {
    const { companyId, branchId = null } = req.scope || {};
    const id = toNumber(req.params.id);
    if (!id) throw httpError(400, "VALIDATION_ERROR", "Invalid id");
    await ensurePMMaterialRequisitionTables(companyId, branchId);
    const [hdr] = await query(`SELECT r.*, p.project_name, w.warehouse_name, d.name AS department_name, u.username AS created_by_name
      FROM inv_material_requisitions r
      LEFT JOIN pm_projects p ON r.project_id = p.id
      LEFT JOIN inv_warehouses w ON r.warehouse_id = w.id
      LEFT JOIN adm_departments d ON r.department_id = d.id
      LEFT JOIN adm_users u ON r.created_by = u.id
      WHERE r.id = :id LIMIT 1`, { id });
    if (!hdr) throw httpError(404, "NOT_FOUND", "Material requisition not found");
    const details = await query(`SELECT d.*, i.item_code, i.item_name FROM inv_material_requisition_details d LEFT JOIN inv_items i ON d.item_id = i.id WHERE d.requisition_id = :id ORDER BY d.id`, { id });
    res.json({ item: hdr, details });
  } catch (err) { next(err); }
};

export const createPMMaterialRequisition = async (req, res, next) => {
  const conn = await pool.getConnection();
  try {
    const { companyId, branchId = null } = req.scope || {};
    await ensurePMMaterialRequisitionTables(companyId, branchId);
    const b = req.body || {};
    const reqNo = await nextPMMRNo(companyId, branchId);
    const details = Array.isArray(b.details) ? b.details : [];
    await conn.beginTransaction();
    const [hdr] = await conn.execute(`INSERT INTO inv_material_requisitions (company_id, branch_id, requisition_no, requisition_date, project_id, warehouse_id, department_id, requisition_type, priority, requested_by, remarks, status, created_by)
      VALUES (:companyId, :branchId, :reqNo, :reqDate, :projectId, :warehouseId, :departmentId, 'PROJECT', :priority, :requestedBy, :remarks, :status, :createdBy)`, {
      companyId, branchId, reqNo,
      reqDate: b.requisition_date || new Date().toISOString().split('T')[0],
      projectId: toNumber(b.project_id),
      warehouseId: toNumber(b.warehouse_id),
      departmentId: toNumber(b.department_id),
      priority: b.priority || 'MEDIUM',
      requestedBy: b.requested_by || null,
      remarks: b.remarks || null,
      status: b.status || 'DRAFT',
      createdBy: req.user?.sub || null
    });
    const reqId = hdr.insertId;
    for (const d of details) {
      const itemId = toNumber(d.item_id);
      if (!itemId || !Number(d.qty_requested)) continue;
      await conn.execute(`INSERT INTO inv_material_requisition_details (requisition_id, item_id, qty_requested, qty_issued, qty_received, uom, batch_no) VALUES (:reqId, :itemId, :qtyReq, 0, :qtyRecv, :uom, :batchNo)`, {
        reqId, itemId,
        qtyReq: Number(d.qty_requested) || 0,
        qtyRecv: Number(d.qty_received || 0),
        uom: d.uom || 'PCS',
        batchNo: d.batch_no || null
      });
    }
    await conn.commit();
    res.status(201).json({ id: reqId, requisition_no: reqNo });
  } catch (err) { try { await conn.rollback(); } catch {} next(err); } finally { conn.release(); }
};

export const updatePMMaterialRequisition = async (req, res, next) => {
  const conn = await pool.getConnection();
  try {
    const { companyId, branchId = null } = req.scope || {};
    const id = toNumber(req.params.id);
    if (!id) throw httpError(400, "VALIDATION_ERROR", "Invalid id");
    await ensurePMMaterialRequisitionTables(companyId, branchId);
    const b = req.body || {};
    const details = Array.isArray(b.details) ? b.details : [];
    await conn.beginTransaction();
    await conn.execute(`UPDATE inv_material_requisitions SET requisition_date = :reqDate, project_id = :projectId, warehouse_id = :warehouseId, department_id = :departmentId, priority = :priority, requested_by = :requestedBy, remarks = :remarks, status = :status WHERE id = :id AND company_id = :companyId AND branch_id = :branchId`, {
      id, companyId, branchId,
      reqDate: b.requisition_date || null,
      projectId: toNumber(b.project_id),
      warehouseId: toNumber(b.warehouse_id),
      departmentId: toNumber(b.department_id),
      priority: b.priority || 'MEDIUM',
      requestedBy: b.requested_by || null,
      remarks: b.remarks || null,
      status: b.status || 'DRAFT'
    });
    if (b.status === 'CANCELLED') {
      await conn.execute(`UPDATE inv_material_requisitions SET is_active = 'N', deleted_at = NOW() WHERE id = :id`, { id });
    }
    await conn.execute(`DELETE FROM inv_material_requisition_details WHERE requisition_id = :id`, { id });
    for (const d of details) {
      const itemId = toNumber(d.item_id);
      if (!itemId || !Number(d.qty_requested)) continue;
      await conn.execute(`INSERT INTO inv_material_requisition_details (requisition_id, item_id, qty_requested, qty_issued, qty_received, uom, batch_no) VALUES (:id, :itemId, :qtyReq, 0, :qtyRecv, :uom, :batchNo)`, {
        id, itemId,
        qtyReq: Number(d.qty_requested) || 0,
        qtyRecv: Number(d.qty_received || 0),
        uom: d.uom || 'PCS',
        batchNo: d.batch_no || null
      });
    }
    await conn.commit();
    res.json({ ok: true });
  } catch (err) { try { await conn.rollback(); } catch {} next(err); } finally { conn.release(); }
};

export const submitPMMaterialRequisition = async (req, res, next) => {
  try {
    const { companyId = null } = req.scope || {};
    const id = toNumber(req.params.id);
    if (!id) throw httpError(400, "VALIDATION_ERROR", "Invalid id");
    await query(`UPDATE inv_material_requisitions SET status = 'PENDING_APPROVAL' WHERE id = :id AND company_id = :companyId`, { id, companyId });
    const wfByRoute = await query(`SELECT * FROM adm_workflows WHERE company_id = :companyId AND document_route = '/projects/material-requisitions' ORDER BY id ASC`, { companyId });
    const wfDefs = await query(`SELECT * FROM adm_workflows WHERE company_id = :companyId AND (document_type = 'PM_MATERIAL_REQUISITION' OR document_type = 'PM Material Requisition') ORDER BY id ASC`, { companyId });
    let activeWf = null;
    for (const list of [wfByRoute, wfDefs]) {
      for (const wf of list) {
        if (Number(wf.is_active) !== 1) continue;
        activeWf = wf; break;
      } if (activeWf) break;
    }
    if (!activeWf) {
      await query(`UPDATE inv_material_requisitions SET status = 'APPROVED' WHERE id = :id`, { id });
      return res.json({ status: 'APPROVED' });
    }
    const [firstStep] = await query(`SELECT * FROM adm_workflow_steps WHERE workflow_id = :wf ORDER BY step_order ASC LIMIT 1`, { wf: activeWf.id });
    if (!firstStep || !firstStep.approver_user_id) {
      await query(`UPDATE inv_material_requisitions SET status = 'APPROVED' WHERE id = :id`, { id });
      return res.json({ status: 'APPROVED' });
    }
    await query(`INSERT INTO adm_document_workflows (company_id, workflow_id, document_id, document_type, current_step_order, status, assigned_to_user_id)
      VALUES (:companyId, :wfId, :docId, 'PM_MATERIAL_REQUISITION', :stepOrder, 'PENDING', :assignedTo)`, {
      companyId, wfId: activeWf.id, docId: id, stepOrder: firstStep.step_order, assignedTo: firstStep.approver_user_id
    });
    await query(`INSERT INTO adm_workflow_tasks (company_id, workflow_id, document_workflow_id, document_id, document_type, step_order, assigned_to_user_id, action)
      VALUES (:companyId, :wfId, LAST_INSERT_ID(), :docId, 'PM_MATERIAL_REQUISITION', :stepOrder, :assignedTo, 'PENDING')`, {
      companyId, wfId: activeWf.id, docId: id, stepOrder: firstStep.step_order, assignedTo: firstStep.approver_user_id
    });
    res.json({ status: 'PENDING_APPROVAL' });
  } catch (err) { next(err); }
};

// ===== PM MATERIAL UTILIZATION CRUD =====
export const listPMMaterialUtilizations = async (req, res, next) => {
  try {
    const { companyId, branchId = null } = req.scope || {};
    await ensurePMMaterialUtilizationTables(companyId, branchId);
    const rows = await query(`SELECT u.id, u.utilization_no, u.utilization_date, u.project_id, u.task_id, u.task_summary, u.warehouse_id, u.remarks, u.status, u.created_by, u.created_at, u.updated_at,
      p.project_name, t.task_title, u2.username AS created_by_name, w.warehouse_name
      FROM pm_material_utilization u
      LEFT JOIN pm_projects p ON u.project_id = p.id
      LEFT JOIN pm_tasks t ON u.task_id = t.id
      LEFT JOIN adm_users u2 ON u.created_by = u2.id
      LEFT JOIN inv_warehouses w ON u.warehouse_id = w.id
      WHERE u.company_id = :companyId AND u.branch_id = :branchId
      ORDER BY u.created_at DESC`, { companyId, branchId });
    res.json({ items: rows });
  } catch (err) { next(err); }
};

export const getPMMaterialUtilizationById = async (req, res, next) => {
  try {
    const { companyId, branchId = null } = req.scope || {};
    const id = toNumber(req.params.id);
    if (!id) throw httpError(400, "VALIDATION_ERROR", "Invalid id");
    await ensurePMMaterialUtilizationTables(companyId, branchId);
    const [hdr] = await query(`SELECT u.*, p.project_name, t.task_title, u2.username AS created_by_name
      FROM pm_material_utilization u
      LEFT JOIN pm_projects p ON u.project_id = p.id
      LEFT JOIN pm_tasks t ON u.task_id = t.id
      LEFT JOIN adm_users u2 ON u.created_by = u2.id
      WHERE u.id = :id LIMIT 1`, { id });
    if (!hdr) throw httpError(404, "NOT_FOUND", "Material utilization not found");
    const details = await query(`SELECT d.*, i.item_code, i.item_name FROM pm_material_utilization_items d LEFT JOIN inv_items i ON d.item_id = i.id WHERE d.utilization_id = :id ORDER BY d.id`, { id });
    res.json({ item: hdr, details });
  } catch (err) { next(err); }
};

export const createPMMaterialUtilization = async (req, res, next) => {
  const conn = await pool.getConnection();
  try {
    const { companyId, branchId = null } = req.scope || {};
    await ensurePMMaterialUtilizationTables(companyId, branchId);
    const b = req.body || {};
    const utilNo = b.utilization_no || await nextPMUtilNo(companyId, branchId);
    const details = Array.isArray(b.details) ? b.details : [];
    await conn.beginTransaction();
    const [hdr] = await conn.execute(`INSERT INTO pm_material_utilization (company_id, branch_id, utilization_no, utilization_date, project_id, task_id, task_summary, location, warehouse_id, remarks, status, created_by)
      VALUES (:companyId, :branchId, :utilNo, :utilDate, :projectId, :taskId, :taskSummary, :location, :warehouseId, :remarks, :status, :createdBy)`, {
      companyId, branchId, utilNo,
      utilDate: b.utilization_date || new Date().toISOString().split('T')[0],
      projectId: toNumber(b.project_id),
      taskId: toNumber(b.task_id),
      taskSummary: b.task_summary || null,
      location: b.location || null,
      warehouseId: toNumber(b.warehouse_id) || null,
      remarks: b.remarks || null,
      status: b.status || 'DRAFT',
      createdBy: req.user?.sub || null
    });
    const utilId = hdr.insertId;
    const warehouseId = toNumber(b.warehouse_id);
    const userId = req.user?.sub || null;
    for (const d of details) {
      const itemId = toNumber(d.item_id);
      if (!itemId) continue;
      await conn.execute(`INSERT INTO pm_material_utilization_items (utilization_id, item_id, item_name, uom, required_qty, qty_in_stock, cost_price) VALUES (:utilId, :itemId, :itemName, :uom, :reqQty, :qtyInStock, :costPrice)`, {
        utilId, itemId,
        itemName: d.item_name || null,
        uom: d.uom || 'PCS',
        reqQty: Number(d.required_qty || 0),
        qtyInStock: Number(d.qty_in_stock || 0),
        costPrice: Number(d.cost_price || 0)
      });
    }
    if ((b.status || 'DRAFT') === 'POSTED' && warehouseId) {
      for (const d of details) {
        const itemId = toNumber(d.item_id);
        const reqQty = Number(d.required_qty || 0);
        if (!itemId || reqQty <= 0) continue;
        const [rows] = await conn.execute(
          `SELECT id, qty FROM inv_stock_balances
           WHERE company_id = :companyId AND branch_id = :branchId
             AND warehouse_id = :warehouseId AND item_id = :itemId
           LIMIT 1`,
          { companyId, branchId, warehouseId, itemId },
        );
        const currentQty = Number(rows?.[0]?.qty || 0);
        if (currentQty < reqQty) {
          throw httpError(400, "INSUFFICIENT_STOCK", `Insufficient stock for item ${d.item_name || itemId}: available ${currentQty}, required ${reqQty}`);
        }
        await conn.execute(
          `UPDATE inv_stock_balances SET qty = GREATEST(qty - :reqQty, 0) WHERE id = :id`,
          { reqQty, id: rows[0].id },
        );
        await conn.execute(
          `INSERT INTO inv_stock_ledger
            (company_id, branch_id, warehouse_id, item_id, transaction_type,
             qty_change, source_ref, created_by)
           VALUES
            (:companyId, :branchId, :warehouseId, :itemId, :transactionType,
             :qtyChange, :sourceRef, :createdBy)`,
          {
            companyId, branchId, warehouseId, itemId,
            transactionType: 'MATERIAL_UTILIZATION',
            qtyChange: -reqQty,
            sourceRef: utilNo,
            createdBy: userId,
          },
        );
      }
    }
    await conn.commit();
    res.status(201).json({ id: utilId, utilization_no: utilNo });
  } catch (err) { try { await conn.rollback(); } catch {} next(err); } finally { conn.release(); }
};

export const updatePMMaterialUtilization = async (req, res, next) => {
  const conn = await pool.getConnection();
  try {
    const { companyId, branchId = null } = req.scope || {};
    const id = toNumber(req.params.id);
    if (!id) throw httpError(400, "VALIDATION_ERROR", "Invalid id");
    await ensurePMMaterialUtilizationTables(companyId, branchId);
    const b = req.body || {};
    const details = Array.isArray(b.details) ? b.details : [];
    await conn.beginTransaction();
    const [oldHdr] = await conn.execute(
      `SELECT warehouse_id, status FROM pm_material_utilization WHERE id = :id AND company_id = :companyId AND branch_id = :branchId`,
      { id, companyId, branchId },
    );
    const oldStatus = oldHdr?.[0]?.status || 'DRAFT';
    const oldWarehouseId = toNumber(oldHdr?.[0]?.warehouse_id);
    const [oldItems] = await conn.execute(
      `SELECT item_id, required_qty FROM pm_material_utilization_items WHERE utilization_id = :id`,
      { id },
    );
    const newStatus = b.status || 'DRAFT';
    const newWarehouseId = toNumber(b.warehouse_id);
    const utilNo = (await conn.execute(
      `SELECT utilization_no FROM pm_material_utilization WHERE id = :id`,
      { id },
    ))?.[0]?.[0]?.utilization_no || `MT-${id}`;
    const userId = req.user?.sub || null;
    if (oldStatus === 'POSTED' && oldWarehouseId) {
      for (const d of oldItems) {
        const itemId = toNumber(d.item_id);
        const reqQty = Number(d.required_qty || 0);
        if (!itemId || reqQty <= 0) continue;
        await conn.execute(
          `UPDATE inv_stock_balances SET qty = qty + :reqQty
           WHERE company_id = :companyId AND branch_id = :branchId
             AND warehouse_id = :warehouseId AND item_id = :itemId
           LIMIT 1`,
          { companyId, branchId, warehouseId: oldWarehouseId, itemId, reqQty },
        );
        await conn.execute(
          `INSERT INTO inv_stock_ledger
            (company_id, branch_id, warehouse_id, item_id, transaction_type,
             qty_change, source_ref, created_by)
           VALUES
            (:companyId, :branchId, :warehouseId, :itemId, :transactionType,
             :qtyChange, :sourceRef, :createdBy)`,
          {
            companyId, branchId, warehouseId: oldWarehouseId, itemId,
            transactionType: 'MATERIAL_UTILIZATION_REVERSAL',
            qtyChange: reqQty,
            sourceRef: utilNo,
            createdBy: userId,
          },
        );
      }
    }
    await conn.execute(`UPDATE pm_material_utilization SET utilization_date = :utilDate, project_id = :projectId, task_id = :taskId, task_summary = :taskSummary, location = :location, warehouse_id = :warehouseId, remarks = :remarks, status = :status WHERE id = :id AND company_id = :companyId AND branch_id = :branchId`, {
      id, companyId, branchId,
      utilDate: b.utilization_date || null,
      projectId: toNumber(b.project_id),
      taskId: toNumber(b.task_id),
      taskSummary: b.task_summary || null,
      location: b.location || null,
      warehouseId: newWarehouseId || null,
      remarks: b.remarks || null,
      status: newStatus
    });
    await conn.execute(`DELETE FROM pm_material_utilization_items WHERE utilization_id = :id`, { id });
    for (const d of details) {
      const itemId = toNumber(d.item_id);
      if (!itemId) continue;
      await conn.execute(`INSERT INTO pm_material_utilization_items (utilization_id, item_id, item_name, uom, required_qty, qty_in_stock, cost_price) VALUES (:id, :itemId, :itemName, :uom, :reqQty, :qtyInStock, :costPrice)`, {
        id, itemId,
        itemName: d.item_name || null,
        uom: d.uom || 'PCS',
        reqQty: Number(d.required_qty || 0),
        qtyInStock: Number(d.qty_in_stock || 0),
        costPrice: Number(d.cost_price || 0)
      });
    }
    if (newStatus === 'POSTED' && newWarehouseId) {
      for (const d of details) {
        const itemId = toNumber(d.item_id);
        const reqQty = Number(d.required_qty || 0);
        if (!itemId || reqQty <= 0) continue;
        const [rows] = await conn.execute(
          `SELECT id, qty FROM inv_stock_balances
           WHERE company_id = :companyId AND branch_id = :branchId
             AND warehouse_id = :warehouseId AND item_id = :itemId
           LIMIT 1`,
          { companyId, branchId, warehouseId: newWarehouseId, itemId },
        );
        const currentQty = Number(rows?.[0]?.qty || 0);
        if (currentQty < reqQty) {
          throw httpError(400, "INSUFFICIENT_STOCK", `Insufficient stock for item ${d.item_name || itemId}: available ${currentQty}, required ${reqQty}`);
        }
        await conn.execute(
          `UPDATE inv_stock_balances SET qty = GREATEST(qty - :reqQty, 0) WHERE id = :id`,
          { reqQty, id: rows[0].id },
        );
        await conn.execute(
          `INSERT INTO inv_stock_ledger
            (company_id, branch_id, warehouse_id, item_id, transaction_type,
             qty_change, source_ref, created_by)
           VALUES
            (:companyId, :branchId, :warehouseId, :itemId, :transactionType,
             :qtyChange, :sourceRef, :createdBy)`,
          {
            companyId, branchId, warehouseId: newWarehouseId, itemId,
            transactionType: 'MATERIAL_UTILIZATION',
            qtyChange: -reqQty,
            sourceRef: utilNo,
            createdBy: userId,
          },
        );
      }
    }
    await conn.commit();
    res.json({ ok: true });
  } catch (err) { try { await conn.rollback(); } catch {} next(err); } finally { conn.release(); }
};

export const confirmPMMaterialUtilization = async (req, res, next) => {
  const conn = await pool.getConnection();
  try {
    const { companyId, branchId = null } = req.scope || {};
    const id = toNumber(req.params.id);
    if (!id) throw httpError(400, "VALIDATION_ERROR", "Invalid id");
    await ensurePMMaterialUtilizationTables(companyId, branchId);
    await conn.beginTransaction();
    const [hdr] = await conn.execute(
      `SELECT id, status, warehouse_id, utilization_no FROM pm_material_utilization
       WHERE id = :id AND company_id = :companyId AND branch_id = :branchId`,
      { id, companyId, branchId },
    );
    if (!hdr?.length) throw httpError(404, "NOT_FOUND", "Material utilization not found");
    const current = hdr[0];
    if (current.status !== 'DRAFT') {
      throw httpError(400, "VALIDATION_ERROR", `Cannot confirm utilization with status ${current.status}`);
    }
    const warehouseId = toNumber(current.warehouse_id);
    if (!warehouseId) {
      throw httpError(400, "VALIDATION_ERROR", "Warehouse is required to confirm utilization");
    }
    const [items] = await conn.execute(
      `SELECT item_id, item_name, required_qty FROM pm_material_utilization_items WHERE utilization_id = :id`,
      { id },
    );
    const userId = req.user?.sub || null;
    for (const d of items) {
      const itemId = toNumber(d.item_id);
      const reqQty = Number(d.required_qty || 0);
      if (!itemId || reqQty <= 0) continue;
      const [rows] = await conn.execute(
        `SELECT id, qty FROM inv_stock_balances
         WHERE company_id = :companyId AND branch_id = :branchId
           AND warehouse_id = :warehouseId AND item_id = :itemId
         LIMIT 1`,
        { companyId, branchId, warehouseId, itemId },
      );
      const currentQty = Number(rows?.[0]?.qty || 0);
      if (currentQty < reqQty) {
        throw httpError(400, "INSUFFICIENT_STOCK", `Insufficient stock for item ${d.item_name || itemId}: available ${currentQty}, required ${reqQty}`);
      }
      await conn.execute(
        `UPDATE inv_stock_balances SET qty = GREATEST(qty - :reqQty, 0) WHERE id = :id`,
        { reqQty, id: rows[0].id },
      );
      await conn.execute(
        `INSERT INTO inv_stock_ledger
          (company_id, branch_id, warehouse_id, item_id, transaction_type,
           qty_change, source_ref, created_by)
         VALUES
          (:companyId, :branchId, :warehouseId, :itemId, :transactionType,
           :qtyChange, :sourceRef, :createdBy)`,
        {
          companyId, branchId, warehouseId, itemId,
          transactionType: 'MATERIAL_UTILIZATION',
          qtyChange: -reqQty,
          sourceRef: current.utilization_no,
          createdBy: userId,
        },
      );
    }
    await conn.execute(
      `UPDATE pm_material_utilization SET status = 'POSTED' WHERE id = :id AND company_id = :companyId AND branch_id = :branchId`,
      { id, companyId, branchId },
    );
    await conn.commit();
    res.json({ ok: true, status: "POSTED" });
  } catch (err) { try { await conn.rollback(); } catch {} next(err); } finally { conn.release(); }
};

// ===== PM MATERIALS RECEIPT CRUD =====
export const listPMMaterialReceipts = async (req, res, next) => {
  try {
    const { companyId, branchId = null } = req.scope || {};
    await ensurePMMaterialReceiptTables(companyId, branchId);
    const rows = await query(`SELECT r.*, w.warehouse_name, d.name AS department_name, u.username AS created_by_name
      FROM pm_material_receipts r
      LEFT JOIN inv_warehouses w ON r.warehouse_id = w.id
      LEFT JOIN adm_departments d ON r.department_id = d.id
      LEFT JOIN adm_users u ON r.created_by = u.id
      WHERE r.company_id = :companyId AND r.branch_id = :branchId
      ORDER BY r.created_at DESC`, { companyId, branchId });
    res.json({ items: rows });
  } catch (err) { next(err); }
};

export const getPMMaterialReceiptById = async (req, res, next) => {
  try {
    const { companyId, branchId = null } = req.scope || {};
    const id = toNumber(req.params.id);
    if (!id) throw httpError(400, "VALIDATION_ERROR", "Invalid id");
    await ensurePMMaterialReceiptTables(companyId, branchId);
    const [hdr] = await query(`SELECT r.*, w.warehouse_name, d.name AS department_name, u.username AS created_by_name
      FROM pm_material_receipts r
      LEFT JOIN inv_warehouses w ON r.warehouse_id = w.id
      LEFT JOIN adm_departments d ON r.department_id = d.id
      LEFT JOIN adm_users u ON r.created_by = u.id
      WHERE r.id = :id LIMIT 1`, { id });
    if (!hdr) throw httpError(404, "NOT_FOUND", "Materials receipt not found");
    const details = await query(`SELECT d.* FROM pm_material_receipt_items d WHERE d.receipt_id = :id ORDER BY d.id`, { id });
    res.json({ item: hdr, details });
  } catch (err) { next(err); }
};

export const createPMMaterialReceipt = async (req, res, next) => {
  const conn = await pool.getConnection();
  try {
    const { companyId, branchId, branchIdsStr = '' } = req.scope;
    await ensurePMMaterialReceiptTables(companyId, branchId);
    const b = req.body || {};
    const rcptNo = b.receipt_no || await nextPMRcptNo(companyId, branchId);
    const details = Array.isArray(b.details) ? b.details : [];
    await conn.beginTransaction();
    const [hdr] = await conn.execute(`INSERT INTO pm_material_receipts (company_id, branch_id, receipt_no, receipt_date, issue_id, source_doc, warehouse_id, department_id, remarks, status, created_by)
      VALUES (:companyId, :branchId, :rcptNo, :rcptDate, :issueId, :sourceDoc, :warehouseId, :departmentId, :remarks, :status, :createdBy)`, {
      companyId, branchId, rcptNo,
      rcptDate: b.receipt_date || new Date().toISOString().split('T')[0],
      issueId: toNumber(b.issue_id),
      sourceDoc: b.source_doc || null,
      warehouseId: toNumber(b.warehouse_id),
      departmentId: toNumber(b.department_id),
      remarks: b.remarks || null,
      status: b.status || 'DRAFT',
      createdBy: req.user?.sub || null
    });
    const rcptId = hdr.insertId;
    const warehouseId = toNumber(b.warehouse_id);
    const userId = req.user?.sub || null;
    const issueId = toNumber(b.issue_id);
    for (const d of details) {
      const itemId = toNumber(d.item_id);
      if (!itemId) continue;
      const receiptQty = Number(d.receipt_qty || 0);
      await conn.execute(`INSERT INTO pm_material_receipt_items (receipt_id, item_id, item_name, uom, transfer_qty, receipt_qty, batch_no, expiry_date, mfg_date) VALUES (:rcptId, :itemId, :itemName, :uom, :transferQty, :receiptQty, :batchNo, :expiryDate, :mfgDate)`, {
        rcptId, itemId,
        itemName: d.item_name || null,
        uom: d.uom || 'PCS',
        transferQty: Number(d.transfer_qty || 0),
        receiptQty,
        batchNo: d.batch_no || null,
        expiryDate: d.expiry_date || null,
        mfgDate: d.mfg_date || null
      });
      if ((b.status || 'DRAFT') === 'POSTED' && receiptQty > 0 && warehouseId) {
        await recordMovementTx(conn, {
          companyId, branchId, branchIdsStr,
          warehouseId,
          itemId,
          transactionType: 'MATERIAL_RECEIPT',
          qtyChange: receiptQty,
          batchNo: d.batch_no || null,
          expiryDate: d.expiry_date || null,
          sourceRef: rcptNo,
          createdBy: userId,
          sourceType: 'PM_MATERIAL_RECEIPT',
          sourceId: rcptId,
        });
      }
    }
    if (['POSTED', 'APPROVED'].includes(b.status || 'DRAFT') && issueId) {
      const [issueRows] = await conn.execute(
        `SELECT warehouse_id FROM inv_issue_to_requirement WHERE id = :issueId AND company_id = :companyId AND branch_id = :branchId`,
        { issueId, companyId, branchId },
      );
      const issueWhId = toNumber(issueRows?.[0]?.warehouse_id);
      if (issueWhId) {
        for (const d of details) {
          const itemId = toNumber(d.item_id);
          const receiptQty = Number(d.receipt_qty || 0);
          if (!itemId || receiptQty <= 0) continue;
          await conn.execute(
            `UPDATE inv_stock_balances SET reserved_qty = GREATEST(COALESCE(reserved_qty, 0) - :receiptQty, 0)
             WHERE company_id = :companyId AND branch_id = :branchId
               AND warehouse_id = :warehouseId AND item_id = :itemId
             LIMIT 1`,
            { companyId, branchId, warehouseId: issueWhId, itemId, receiptQty },
          );
        }
      }
    }
    await conn.commit();
    res.status(201).json({ id: rcptId, receipt_no: rcptNo });
  } catch (err) { try { await conn.rollback(); } catch {} next(err); } finally { conn.release(); }
};

export const updatePMMaterialReceipt = async (req, res, next) => {
  const conn = await pool.getConnection();
  try {
    const { companyId, branchId, branchIdsStr = '' } = req.scope;
    const id = toNumber(req.params.id);
    if (!id) throw httpError(400, "VALIDATION_ERROR", "Invalid id");
    await ensurePMMaterialReceiptTables(companyId, branchId);
    const b = req.body || {};
    const details = Array.isArray(b.details) ? b.details : [];
    await conn.beginTransaction();

    const [oldHdr] = await conn.execute(`SELECT warehouse_id, status, issue_id FROM pm_material_receipts WHERE id = :id AND company_id = :companyId AND branch_id = :branchId`, { id, companyId, branchId });
    const oldItems = await conn.execute(`SELECT item_id, receipt_qty, batch_no, expiry_date FROM pm_material_receipt_items WHERE receipt_id = :id`, { id });
    const oldStatus = oldHdr?.[0]?.status;
    const oldWarehouseId = toNumber(oldHdr?.[0]?.warehouse_id);
    const oldIssueId = toNumber(oldHdr?.[0]?.issue_id);
    const userId = req.user?.sub || null;
    const newStatus = b.status || 'DRAFT';
    const newIssueId = toNumber(b.issue_id);

    if (['POSTED', 'APPROVED'].includes(oldStatus) && oldIssueId) {
      const [oldIssueRows] = await conn.execute(
        `SELECT warehouse_id FROM inv_issue_to_requirement WHERE id = :issueId AND company_id = :companyId AND branch_id = :branchId`,
        { issueId: oldIssueId, companyId, branchId },
      );
      const oldIssueWhId = toNumber(oldIssueRows?.[0]?.warehouse_id);
      if (oldIssueWhId) {
        for (const old of oldItems) {
          const oldItemId = toNumber(old.item_id);
          const oldQty = Number(old.receipt_qty || 0);
          if (!oldItemId || oldQty <= 0) continue;
          await conn.execute(
            `UPDATE inv_stock_balances SET reserved_qty = COALESCE(reserved_qty, 0) + :oldQty
             WHERE company_id = :companyId AND branch_id = :branchId
               AND warehouse_id = :warehouseId AND item_id = :itemId`,
            { companyId, branchId, warehouseId: oldIssueWhId, itemId: oldItemId, oldQty },
          );
        }
      }
    }

    if (oldStatus === 'POSTED' && oldWarehouseId) {
      for (const old of oldItems) {
        const oldItemId = toNumber(old.item_id);
        const oldQty = Number(old.receipt_qty || 0);
        if (!oldItemId || oldQty <= 0) continue;
        await recordMovementTx(conn, {
          companyId, branchId, branchIdsStr,
          warehouseId: oldWarehouseId,
          itemId: oldItemId,
          transactionType: 'MATERIAL_RECEIPT_REVERSAL',
          qtyChange: -oldQty,
          batchNo: old.batch_no || null,
          expiryDate: old.expiry_date || null,
          sourceRef: `REVERSAL-RECEIPT-${id}`,
          createdBy: userId,
          sourceType: 'PM_MATERIAL_RECEIPT',
          sourceId: id,
        });
      }
    }

    await conn.execute(`UPDATE pm_material_receipts SET receipt_date = :rcptDate, issue_id = :issueId, source_doc = :sourceDoc, warehouse_id = :warehouseId, department_id = :departmentId, remarks = :remarks, status = :status WHERE id = :id AND company_id = :companyId AND branch_id = :branchId`, {
      id, companyId, branchId,
      rcptDate: b.receipt_date || null,
      issueId: toNumber(b.issue_id),
      sourceDoc: b.source_doc || null,
      warehouseId: toNumber(b.warehouse_id),
      departmentId: toNumber(b.department_id),
      remarks: b.remarks || null,
      status: newStatus
    });
    await conn.execute(`DELETE FROM pm_material_receipt_items WHERE receipt_id = :id`, { id });
    const warehouseId = toNumber(b.warehouse_id);
    for (const d of details) {
      const itemId = toNumber(d.item_id);
      if (!itemId) continue;
      const receiptQty = Number(d.receipt_qty || 0);
      await conn.execute(`INSERT INTO pm_material_receipt_items (receipt_id, item_id, item_name, uom, transfer_qty, receipt_qty, batch_no, expiry_date, mfg_date) VALUES (:id, :itemId, :itemName, :uom, :transferQty, :receiptQty, :batchNo, :expiryDate, :mfgDate)`, {
        id, itemId,
        itemName: d.item_name || null,
        uom: d.uom || 'PCS',
        transferQty: Number(d.transfer_qty || 0),
        receiptQty,
        batchNo: d.batch_no || null,
        expiryDate: d.expiry_date || null,
        mfgDate: d.mfg_date || null
      });
      if (newStatus === 'POSTED' && receiptQty > 0 && warehouseId) {
        await recordMovementTx(conn, {
          companyId, branchId, branchIdsStr,
          warehouseId,
          itemId,
          transactionType: 'MATERIAL_RECEIPT',
          qtyChange: receiptQty,
          batchNo: d.batch_no || null,
          expiryDate: d.expiry_date || null,
          sourceRef: `RECEIPT-${id}`,
          createdBy: userId,
          sourceType: 'PM_MATERIAL_RECEIPT',
          sourceId: id,
        });
      }
    }
    if (['POSTED', 'APPROVED'].includes(newStatus) && newIssueId) {
      const [newIssueRows] = await conn.execute(
        `SELECT warehouse_id FROM inv_issue_to_requirement WHERE id = :issueId AND company_id = :companyId AND branch_id = :branchId`,
        { issueId: newIssueId, companyId, branchId },
      );
      const newIssueWhId = toNumber(newIssueRows?.[0]?.warehouse_id);
      if (newIssueWhId) {
        for (const d of details) {
          const itemId = toNumber(d.item_id);
          const receiptQty = Number(d.receipt_qty || 0);
          if (!itemId || receiptQty <= 0) continue;
          await conn.execute(
            `UPDATE inv_stock_balances SET reserved_qty = GREATEST(COALESCE(reserved_qty, 0) - :receiptQty, 0)
             WHERE company_id = :companyId AND branch_id = :branchId
               AND warehouse_id = :warehouseId AND item_id = :itemId
             LIMIT 1`,
            { companyId, branchId, warehouseId: newIssueWhId, itemId, receiptQty },
          );
        }
      }
    }
    await conn.commit();
    res.json({ ok: true });
  } catch (err) { try { await conn.rollback(); } catch {} next(err); } finally { conn.release(); }
};

// ===== AUTO-POPULATE FROM ISSUE TO REQUIREMENT =====
export const getPendingIssueToRequirement = async (req, res, next) => {
  try {
    const { companyId, branchId = null } = req.scope || {};
    const departmentId = req.query.department_id ? toNumber(req.query.department_id) : null;
    await ensurePMMaterialReceiptTables(companyId, branchId);

    let sql = `SELECT i.id, i.issue_no, i.issue_date, i.warehouse_id, i.department_id, i.issued_to, i.status, i.remarks,
      w.warehouse_name, d.name AS department_name
      FROM inv_issue_to_requirement i
      LEFT JOIN inv_warehouses w ON i.warehouse_id = w.id
      LEFT JOIN adm_departments d ON i.department_id = d.id
      WHERE i.company_id = :companyId AND i.branch_id = :branchId
      AND i.status IN ('POSTED', 'ISSUED')
      AND i.id NOT IN (SELECT issue_id FROM pm_material_receipts WHERE issue_id IS NOT NULL)`;

    const params = { companyId, branchId };

    if (departmentId) {
      sql += ` AND i.department_id = :departmentId`;
      params.departmentId = departmentId;
    }

    sql += ` ORDER BY i.issue_date DESC`;

    const rows = await query(sql, params);
    res.json({ items: rows });
  } catch (err) { next(err); }
};

export const getIssueToRequirementDetail = async (req, res, next) => {
  try {
    const { companyId, branchId = null } = req.scope || {};
    const issueId = toNumber(req.params.issueId);
    if (!issueId) throw httpError(400, "VALIDATION_ERROR", "Invalid issue id");
    const [hdr] = await query(`SELECT i.*, w.warehouse_name, d.name AS department_name
      FROM inv_issue_to_requirement i
      LEFT JOIN inv_warehouses w ON i.warehouse_id = w.id
      LEFT JOIN adm_departments d ON i.department_id = d.id
      WHERE i.id = :issueId AND i.company_id = :companyId AND i.branch_id = :branchId LIMIT 1`, { issueId, companyId, branchId });
    if (!hdr) throw httpError(404, "NOT_FOUND", "Issue not found");
    const details = await query(`SELECT d.*, i.item_code, i.item_name, i.uom, sb.qty AS stock_qty
      FROM inv_issue_to_requirement_details d
      LEFT JOIN inv_items i ON d.item_id = i.id
      LEFT JOIN (SELECT item_id, SUM(qty) AS qty FROM inv_stock_balances WHERE company_id = :companyId GROUP BY item_id) sb ON sb.item_id = d.item_id
      WHERE d.issue_id = :issueId ORDER BY d.id`, { issueId, companyId });
    res.json({ item: hdr, details });
  } catch (err) { next(err); }
};

// ===== PROJECT STATUS REPORT =====
export const getProjectStatusReport = async (req, res, next) => {
  try {
    const { companyId, branchId = null, branchIdsStr = '' } = req.scope || {};
    await ensureProjectTables(companyId, branchId);
    const rows = await query(`SELECT p.id, p.project_code, p.project_name, p.project_status, p.completion_percent,
      p.start_date, p.end_date, p.actual_start_date, p.actual_end_date,
      p.manager_name, p.budget, p.client_name,
      COUNT(DISTINCT t.id) AS total_tasks,
      COUNT(DISTINCT CASE WHEN t.status = 'COMPLETED' THEN t.id END) AS completed_tasks,
      COUNT(DISTINCT CASE WHEN t.status = 'IN_PROGRESS' THEN t.id END) AS in_progress_tasks,
      COUNT(DISTINCT CASE WHEN t.status = 'BLOCKED' THEN t.id END) AS blocked_tasks,
      COUNT(DISTINCT CASE WHEN t.status = 'PENDING' THEN t.id END) AS pending_tasks,
      COALESCE(SUM(CASE WHEN t.status = 'COMPLETED' THEN t.completion_percent ELSE 0 END) / NULLIF(COUNT(DISTINCT t.id), 0), 0) AS avg_task_completion,
      SUM(t.estimated_hours) AS total_estimated_hours,
      SUM(t.actual_hours) AS total_actual_hours
      FROM pm_projects p
      LEFT JOIN pm_tasks t ON t.project_id = p.id
      WHERE p.company_id = :companyId AND (:branchIdsStr = '' OR FIND_IN_SET(p.branch_id, :branchIdsStr))
      GROUP BY p.id
      ORDER BY p.start_date DESC`, { companyId, branchId, branchIdsStr });
    res.json({ items: rows });
  } catch (err) { next(err); }
};

export const getProjectIncomeReport = async (req, res, next) => {
  try {
    const { companyId, branchId = null, branchIdsStr = '' } = req.scope || {};
    const projectId = req.query.project_id ? toNumber(req.query.project_id) : null;
    if (!projectId) {
      const projects = await query(`SELECT DISTINCT p.id, p.project_code, p.project_name
        FROM pm_projects p
        JOIN fin_vouchers v ON v.project_id = p.id AND v.company_id = p.company_id
        JOIN fin_voucher_types vt ON vt.id = v.voucher_type_id AND vt.company_id = v.company_id
        WHERE p.company_id = :companyId AND vt.code = 'RV'
          AND (:branchIdsStr = '' OR FIND_IN_SET(p.branch_id, :branchIdsStr))
        ORDER BY p.project_name`, { companyId, branchId, branchIdsStr });
      return res.json({ projects });
    }
    const items = await query(`SELECT v.id, v.voucher_no, v.voucher_date,
        COALESCE((SELECT l.description FROM fin_voucher_lines l WHERE l.voucher_id = v.id AND l.company_id = v.company_id AND NULLIF(TRIM(l.description), '') IS NOT NULL ORDER BY l.line_no ASC LIMIT 1), v.narration) AS description,
        vt.name AS voucher_type_name, c.code AS currency_code, v.total_debit AS amount, v.status
      FROM fin_vouchers v
      JOIN fin_voucher_types vt ON vt.id = v.voucher_type_id AND vt.company_id = v.company_id
      LEFT JOIN fin_currencies c ON c.id = v.currency_id AND c.company_id = v.company_id
      WHERE v.company_id = :companyId AND v.project_id = :projectId AND vt.code = 'RV'
        AND (:branchIdsStr = '' OR FIND_IN_SET(v.branch_id, :branchIdsStr))
      ORDER BY v.voucher_date DESC, v.id DESC`, { companyId, branchId, branchIdsStr, projectId });
    const summary = { count: items.length, total: items.reduce((s, v) => s + Number(v.amount || 0), 0) };
    res.json({ items, summary });
  } catch (err) { next(err); }
};

export const getProjectExpenseReport = async (req, res, next) => {
  try {
    const { companyId, branchId = null, branchIdsStr = '' } = req.scope || {};
    const projectId = req.query.project_id ? toNumber(req.query.project_id) : null;
    if (!projectId) {
      const projects = await query(`SELECT DISTINCT p.id, p.project_code, p.project_name
        FROM pm_projects p
        JOIN fin_vouchers v ON v.project_id = p.id AND v.company_id = p.company_id
        JOIN fin_voucher_types vt ON vt.id = v.voucher_type_id AND vt.company_id = v.company_id
        WHERE p.company_id = :companyId AND vt.code = 'PV'
          AND (:branchIdsStr = '' OR FIND_IN_SET(p.branch_id, :branchIdsStr))
        ORDER BY p.project_name`, { companyId, branchId, branchIdsStr });
      return res.json({ projects });
    }
    const items = await query(`SELECT v.id, v.voucher_no, v.voucher_date,
        COALESCE((SELECT l.description FROM fin_voucher_lines l WHERE l.voucher_id = v.id AND l.company_id = v.company_id AND NULLIF(TRIM(l.description), '') IS NOT NULL ORDER BY l.line_no ASC LIMIT 1), v.narration) AS description,
        vt.name AS voucher_type_name, c.code AS currency_code, v.total_debit AS amount, v.status
      FROM fin_vouchers v
      JOIN fin_voucher_types vt ON vt.id = v.voucher_type_id AND vt.company_id = v.company_id
      LEFT JOIN fin_currencies c ON c.id = v.currency_id AND c.company_id = v.company_id
      WHERE v.company_id = :companyId AND v.project_id = :projectId AND vt.code = 'PV'
        AND (:branchIdsStr = '' OR FIND_IN_SET(v.branch_id, :branchIdsStr))
      ORDER BY v.voucher_date DESC, v.id DESC`, { companyId, branchId, branchIdsStr, projectId });
    const summary = { count: items.length, total: items.reduce((s, v) => s + Number(v.amount || 0), 0) };
    res.json({ items, summary });
  } catch (err) { next(err); }
};

