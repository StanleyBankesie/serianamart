import { query } from "../db/pool.js";
import { httpError } from "../utils/httpError.js";

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
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

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
}

export const listProjects = async (req, res, next) => {
  try {
    const { companyId, branchId } = req.scope;
    await ensureProjectTables(companyId, branchId);
    const items = await query(`SELECT p.*,
          u.username AS created_by_name
         FROM pm_projects p
        LEFT JOIN adm_users u ON u.id = p.created_by
         WHERE p.company_id = :companyId AND p.branch_id = :branchId ORDER BY p.start_date DESC LIMIT 100`,
      { companyId, branchId },
    );
    res.json({ items });
  } catch (err) {
    next(err);
  }
};

export const getProjectById = async (req, res, next) => {
  try {
    const { companyId, branchId } = req.scope;
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
    const { companyId, branchId } = req.scope;
    await ensureProjectTables(companyId, branchId);
    const b = req.body || {};

    if (!b.project_code || !b.project_name)
      throw httpError(400, "VALIDATION_ERROR", "Code and Name are required");

    const result = await query(`INSERT INTO pm_projects 
      (company_id, branch_id, project_code, project_name, client_name, manager_id, manager_name, budget, project_priority, project_status, start_date, end_date, remarks)
      VALUES (:companyId, :branchId, :project_code, :project_name, :client_name, :manager_id, :manager_name, :budget, :project_priority, :project_status, :start_date, :end_date, :remarks)`,
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
      },
    );

    res.status(201).json({ id: result.insertId });
  } catch (err) {
    next(err);
  }
};

export const updateProject = async (req, res, next) => {
  try {
    const { companyId, branchId } = req.scope;
    const id = toNumber(req.params.id);
    const b = req.body || {};
    await ensureProjectTables(companyId, branchId);

    await query(`UPDATE pm_projects SET
      project_name = :project_name, client_name = :client_name, manager_id = :manager_id,
      manager_name = :manager_name, budget = :budget, project_priority = :project_priority,
      project_status = :project_status, start_date = :start_date, end_date = :end_date,
      actual_start_date = :actual_start_date, actual_end_date = :actual_end_date,
      completion_percent = :completion_percent, remarks = :remarks
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
    const { companyId, branchId } = req.scope;
    const projectId = toNumber(req.query.projectId);
    await ensureProjectTables(companyId, branchId);
    
    let sql = `SELECT * FROM pm_tasks WHERE company_id = :companyId AND branch_id = :branchId`;
    if (projectId) sql += ` AND project_id = :projectId`;
    sql += ` ORDER BY created_at DESC`;

    const items = await query(sql, { companyId, branchId, projectId });
    res.json({ items });
  } catch (err) {
    next(err);
  }
};

export const createOrUpdateTask = async (req, res, next) => {
  try {
    const { companyId, branchId } = req.scope;
    const b = req.body || {};
    await ensureProjectTables(companyId, branchId);

    if (b.id) {
      await query(`UPDATE pm_tasks SET
        task_title = :task_title, task_description = :task_description,
        assigned_to_id = :assigned_to_id, assigned_to_name = :assigned_to_name,
        priority = :priority, status = :status, start_date = :start_date, end_date = :end_date,
        estimated_hours = :estimated_hours, actual_hours = :actual_hours
        WHERE id = :id AND company_id = :companyId AND branch_id = :branchId`,
        { ...b, companyId, branchId }
      );
      res.json({ ok: true });
    } else {
      const r = await query(`INSERT INTO pm_tasks 
        (company_id, branch_id, project_id, task_title, task_description, assigned_to_id, assigned_to_name, priority, status, start_date, end_date, estimated_hours)
        VALUES (:companyId, :branchId, :project_id, :task_title, :task_description, :assigned_to_id, :assigned_to_name, :priority, :status, :start_date, :end_date, :estimated_hours)`,
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

// ===== TIMESHEETS =====
export const listTimesheets = async (req, res, next) => {
  try {
    const { companyId, branchId } = req.scope;
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
    const { companyId, branchId } = req.scope;
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

// ===== DASHBOARD =====
export const getPMDashboardStats = async (req, res, next) => {
  try {
    const { companyId, branchId } = req.scope;
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

