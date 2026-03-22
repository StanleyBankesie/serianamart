import { query, pool } from "../db/pool.js";
import { httpError } from "../utils/httpError.js";
import {
  ensureWorkflowTables,
  toNumber,
  ensureHRTables,
} from "../utils/dbUtils.js";
import { sendMail } from "../utils/mailer.js";

/**
 * List all employees with filters
 */
export async function listEmployees(req, res, next) {
  try {
    await ensureHRTables();
    const { companyId, branchId } = req.scope;
    const { dept_id, status, q } = req.query;

    const clauses = ["e.company_id = :companyId", "e.deleted_at IS NULL"];
    const params = { companyId };

    if (dept_id && dept_id !== "ALL") {
      clauses.push("e.dept_id = :dept_id");
      params.dept_id = dept_id;
    }

    if (status && status !== "ALL") {
      clauses.push("e.status = :status");
      params.status = status;
    }

    if (q) {
      clauses.push(
        "(e.first_name LIKE :q OR e.last_name LIKE :q OR e.emp_code LIKE :q)",
      );
      params.q = `%${q}%`;
    }

    const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";

    const items = await query(
      `SELECT e.id, e.emp_code, e.first_name, e.last_name, e.middle_name, e.email, e.phone, e.dept_id, e.pos_id, e.manager_id,
              e.employment_type, e.status, e.base_salary, e.joining_date,
              d.dept_name, p.pos_name, m.first_name as manager_first_name, m.last_name as manager_last_name,
              CONCAT(e.first_name, ' ', COALESCE(e.middle_name, ''), ' ', e.last_name) as full_name,
              CASE WHEN e.status = 'ACTIVE' THEN 1 ELSE 0 END as is_active
       FROM hr_employees e
       LEFT JOIN hr_departments d ON d.id = e.dept_id
       LEFT JOIN hr_positions p ON p.id = e.pos_id
       LEFT JOIN hr_employees m ON m.id = e.manager_id
       ${where}
       ORDER BY e.emp_code ASC`,
      params,
    );

    res.json({ items });
  } catch (err) {
    next(err);
  }
}

/**
 * Performance APIs
 */
export async function listKPIs(req, res, next) {
  try {
    const { companyId } = req.scope;
    const items = await query(
      `SELECT * FROM hr_kpis WHERE company_id = :companyId AND is_active = 1 ORDER BY name ASC`,
      { companyId },
    );
    res.json({ items });
  } catch (err) {
    next(err);
  }
}

export async function saveKPI(req, res, next) {
  try {
    const { companyId } = req.scope;
    const { id, code, name, description, target_value, is_active } = req.body;
    if (id) {
      await query(
        `UPDATE hr_kpis SET code = :code, name = :name, description = :description, target_value = :target_value, is_active = :is_active 
         WHERE id = :id AND company_id = :companyId`,
        {
          id,
          code,
          name,
          description,
          target_value: toNumber(target_value, null),
          is_active: is_active ? 1 : 0,
          companyId,
        },
      );
      res.json({ message: "KPI updated" });
    } else {
      const result = await query(
        `INSERT INTO hr_kpis (company_id, code, name, description, target_value, is_active)
         VALUES (:companyId, :code, :name, :description, :target_value, 1)`,
        {
          companyId,
          code,
          name,
          description,
          target_value: toNumber(target_value, null),
        },
      );
      res.status(201).json({ id: result.insertId, message: "KPI created" });
    }
  } catch (err) {
    next(err);
  }
}

/**
 * Training APIs
 */
async function listTrainingProgramsDup(req, res, next) {
  try {
    const { companyId } = req.scope;
    const items = await query(
      `SELECT * FROM hr_training_programs WHERE company_id = :companyId AND is_active = 1 ORDER BY start_date DESC`,
      { companyId },
    );
    res.json({ items });
  } catch (err) {
    next(err);
  }
}

/**
 * Compliance APIs
 */
export async function listPolicies(req, res, next) {
  try {
    const { companyId } = req.scope;
    const items = await query(
      `SELECT * FROM hr_policies WHERE company_id = :companyId AND is_active = 1 ORDER BY title ASC`,
      { companyId },
    );
    res.json({ items });
  } catch (err) {
    next(err);
  }
}

export async function savePolicy(req, res, next) {
  try {
    const { companyId } = req.scope;
    const { id, code, title, content, is_active } = req.body;
    if (id) {
      await query(
        `UPDATE hr_policies SET code = :code, title = :title, content = :content, is_active = :is_active
         WHERE id = :id AND company_id = :companyId`,
        { id, code, title, content, is_active: is_active ? 1 : 0, companyId },
      );
      res.json({ message: "Policy updated" });
    } else {
      const result = await query(
        `INSERT INTO hr_policies (company_id, code, title, content, is_active)
         VALUES (:companyId, :code, :title, :content, 1)`,
        { companyId, code, title, content },
      );
      res.status(201).json({ id: result.insertId, message: "Policy created" });
    }
  } catch (err) {
    next(err);
  }
}

export async function acknowledgePolicy(req, res, next) {
  try {
    const { companyId } = req.scope;
    const userId = req.user?.id || req.user?.sub;
    const { employee_id, policy_id } = req.body;
    await query(
      `INSERT INTO hr_policy_acknowledgements (company_id, employee_id, policy_id, acknowledged_at)
       VALUES (:companyId, :employee_id, :policy_id, NOW())`,
      { companyId, employee_id, policy_id },
    );
    res.status(201).json({ message: "Acknowledged" });
  } catch (err) {
    next(err);
  }
}

/**
 * Exit & Clearance APIs
 */
export async function saveExit(req, res, next) {
  try {
    const {
      employee_id,
      exit_type,
      resignation_date,
      last_working_day,
      reason,
      status,
    } = req.body;
    const result = await query(
      `INSERT INTO hr_exits (employee_id, exit_type, resignation_date, last_working_day, reason, status)
       VALUES (:employee_id, :exit_type, :resignation_date, :last_working_day, :reason, :status)`,
      {
        employee_id,
        exit_type,
        resignation_date: resignation_date || null,
        last_working_day,
        reason: reason || null,
        status: status || "PENDING",
      },
    );
    const exitId = result.insertId;

    // Initialize clearance items
    const depts = ["IT", "Finance", "HR", "Admin", "Library", "Department Head"];
    for (const dept of depts) {
      await query(
        `INSERT INTO hr_clearance (exit_id, department, cleared) VALUES (:exitId, :dept, 0)`,
        { exitId, dept },
      );
    }

    res.status(201).json({ id: exitId, message: "Exit submitted and clearance initialized" });
  } catch (err) {
    next(err);
  }
}

export async function listExits(req, res, next) {
  try {
    const { employee_id } = req.query;
    const clauses = [];
    const params = {};
    if (employee_id) {
      clauses.push("e.employee_id = :employee_id");
      params.employee_id = toNumber(employee_id, null);
    }
    const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
    const items = await query(
      `SELECT e.*, emp.first_name, emp.last_name 
       FROM hr_exits e
       LEFT JOIN hr_employees emp ON emp.id = e.employee_id
       ${where}
       ORDER BY e.id DESC`,
      params,
    );
    res.json({ items });
  } catch (err) {
    next(err);
  }
}

export async function listClearance(req, res, next) {
  try {
    const { exit_id } = req.query;
    const items = await query(
      `SELECT * FROM hr_clearance WHERE exit_id = :exit_id ORDER BY department ASC`,
      { exit_id },
    );
    res.json({ items });
  } catch (err) {
    next(err);
  }
}

export async function updateClearance(req, res, next) {
  try {
    const { id, cleared, remarks } = req.body;
    await query(
      `UPDATE hr_clearance SET cleared = :cleared, cleared_at = CASE WHEN :cleared = 1 THEN NOW() ELSE NULL END, remarks = :remarks
       WHERE id = :id`,
      { id, cleared: cleared ? 1 : 0, remarks: remarks || null },
    );
    res.json({ message: "Clearance updated" });
  } catch (err) {
    next(err);
  }
}
export async function listKpis(req, res, next) {
  try {
    const { companyId } = req.scope;
    const items = await query(
      `SELECT * FROM hr_kpis WHERE company_id = :companyId ORDER BY name ASC`,
      { companyId },
    );
    res.json({ items });
  } catch (err) {
    next(err);
  }
}

export async function saveKpi(req, res, next) {
  try {
    const { companyId } = req.scope;
    const { id, code, name, description, target_value, is_active } = req.body;
    if (id) {
      await query(
        `UPDATE hr_kpis SET code = :code, name = :name, description = :description, target_value = :target_value, is_active = :is_active WHERE id = :id AND company_id = :companyId`,
        {
          id,
          code,
          name,
          description,
          target_value,
          is_active: is_active ? 1 : 0,
          companyId,
        },
      );
      res.json({ message: "KPI updated" });
    } else {
      const result = await query(
        `INSERT INTO hr_kpis (company_id, code, name, description, target_value, is_active) VALUES (:companyId, :code, :name, :description, :target_value, 1)`,
        { companyId, code, name, description, target_value },
      );
      res.status(201).json({ id: result.insertId, message: "KPI created" });
    }
  } catch (err) {
    next(err);
  }
}

export async function listPerformanceReviews(req, res, next) {
  try {
    const { employee_id } = req.query;
    const clauses = [];
    const params = {};
    if (employee_id) {
      clauses.push("r.employee_id = :employee_id");
      params.employee_id = employee_id;
    }
    const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
    const items = await query(
      `SELECT r.*, e.first_name, e.last_name FROM hr_performance_reviews r LEFT JOIN hr_employees e ON e.id = r.employee_id ${where} ORDER BY r.created_at DESC`,
      params,
    );
    res.json({ items });
  } catch (err) {
    next(err);
  }
}

export async function savePerformanceReview(req, res, next) {
  try {
    const { companyId } = req.scope;
    const {
      id,
      employee_id,
      period_name,
      reviewer_user_id,
      overall_rating,
      comments,
      status,
    } = req.body;
    if (id) {
      await query(
        `UPDATE hr_performance_reviews SET period_name = :period_name, reviewer_user_id = :reviewer_user_id, overall_rating = :overall_rating, comments = :comments, status = :status WHERE id = :id AND company_id = :companyId`,
        {
          id,
          period_name,
          reviewer_user_id,
          overall_rating,
          comments,
          status,
          companyId,
        },
      );
      res.json({ message: "Review updated" });
    } else {
      const result = await query(
        `INSERT INTO hr_performance_reviews (company_id, employee_id, period_name, reviewer_user_id, overall_rating, comments, status) VALUES (:companyId, :employee_id, :period_name, :reviewer_user_id, :overall_rating, :comments, :status)`,
        {
          companyId,
          employee_id,
          period_name,
          reviewer_user_id,
          overall_rating,
          comments,
          status: status || "DRAFT",
        },
      );
      res.status(201).json({ id: result.insertId, message: "Review created" });
    }
  } catch (err) {
    next(err);
  }
}

export async function listTrainingPrograms(req, res, next) {
  try {
    const { companyId } = req.scope;
    const items = await query(
      `SELECT * FROM hr_training_programs WHERE company_id = :companyId ORDER BY start_date DESC`,
      { companyId },
    );
    res.json({ items });
  } catch (err) {
    next(err);
  }
}

export async function saveTrainingProgram(req, res, next) {
  try {
    const { companyId } = req.scope;
    const { id, code, title, description, start_date, end_date, is_active } =
      req.body;
    if (id) {
      await query(
        `UPDATE hr_training_programs SET code = :code, title = :title, description = :description, start_date = :start_date, end_date = :end_date, is_active = :is_active WHERE id = :id AND company_id = :companyId`,
        {
          id,
          code,
          title,
          description,
          start_date,
          end_date,
          is_active: is_active ? 1 : 0,
          companyId,
        },
      );
      res.json({ message: "Program updated" });
    } else {
      const result = await query(
        `INSERT INTO hr_training_programs (company_id, code, title, description, start_date, end_date, is_active) VALUES (:companyId, :code, :title, :description, :start_date, :end_date, 1)`,
        { companyId, code, title, description, start_date, end_date },
      );
      res.status(201).json({ id: result.insertId, message: "Program created" });
    }
  } catch (err) {
    next(err);
  }
}

export async function listTrainingRecords(req, res, next) {
  try {
    const { employee_id } = req.query;
    const clauses = [];
    const params = {};
    if (employee_id) {
      clauses.push("r.employee_id = :employee_id");
      params.employee_id = employee_id;
    }
    const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
    const items = await query(
      `SELECT r.*, p.title AS program_title FROM hr_training_records r LEFT JOIN hr_training_programs p ON p.id = r.program_id ${where} ORDER BY r.completion_date DESC`,
      params,
    );
    res.json({ items });
  } catch (err) {
    next(err);
  }
}

export async function saveTrainingRecord(req, res, next) {
  try {
    const { companyId } = req.scope;
    const { id, employee_id, program_id, completion_date, status, remarks } =
      req.body;
    if (id) {
      await query(
        `UPDATE hr_training_records SET employee_id = :employee_id, program_id = :program_id, completion_date = :completion_date, status = :status, remarks = :remarks WHERE id = :id AND company_id = :companyId`,
        {
          id,
          employee_id,
          program_id,
          completion_date,
          status,
          remarks,
          companyId,
        },
      );
      res.json({ message: "Record updated" });
    } else {
      const result = await query(
        `INSERT INTO hr_training_records (company_id, employee_id, program_id, completion_date, status, remarks) VALUES (:companyId, :employee_id, :program_id, :completion_date, :status, :remarks)`,
        {
          companyId,
          employee_id,
          program_id,
          completion_date,
          status,
          remarks,
        },
      );
      res.status(201).json({ id: result.insertId, message: "Record created" });
    }
  } catch (err) {
    next(err);
  }
}

/**
 * Get employee detail by ID
 */
export async function getEmployeeById(req, res, next) {
  try {
    const { companyId } = req.scope;
    const { id } = req.params;

    const rows = await query(
      `SELECT e.*, d.dept_name, p.pos_name, m.first_name as manager_first_name, m.last_name as manager_last_name,
              CONCAT(e.first_name, ' ', COALESCE(e.middle_name, ''), ' ', e.last_name) as full_name
       FROM hr_employees e
       LEFT JOIN hr_departments d ON d.id = e.dept_id
       LEFT JOIN hr_positions p ON p.id = e.pos_id
       LEFT JOIN hr_employees m ON m.id = e.manager_id
       WHERE e.id = :id AND e.company_id = :companyId AND e.deleted_at IS NULL`,
      { id, companyId },
    );

    if (!rows.length) throw httpError(404, "NOT_FOUND", "Employee not found");

    const documents = await query(
      `SELECT * FROM hr_employee_documents WHERE employee_id = :id`,
      { id },
    );

    res.json({ item: rows[0], documents });
  } catch (err) {
    next(err);
  }
}

/**
 * Create/Update employee
 */
export async function saveEmployee(req, res, next) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const { companyId, branchId } = req.scope;
    const userId = req.user?.id || req.user?.sub;
    const body = req.body;

    if (body.id) {
      await conn.execute(
        `UPDATE hr_employees SET 
          emp_code = ?, first_name = ?, last_name = ?, middle_name = ?,
          gender = ?, dob = ?, joining_date = ?, email = ?, phone = ?, 
          dept_id = ?, pos_id = ?, manager_id = ?,
          employment_type = ?, status = ?, base_salary = ?, address = ?, 
          updated_by = ?
         WHERE id = ? AND company_id = ?`,
        [
          body.emp_code,
          body.first_name,
          body.last_name,
          body.middle_name || null,
          body.gender || null,
          body.dob || null,
          body.joining_date,
          body.email || null,
          body.phone || null,
          body.dept_id || null,
          body.pos_id || null,
          body.manager_id || null,
          body.employment_type || "FULL_TIME",
          body.status || "PROBATION",
          body.base_salary || 0,
          body.address || null,
          userId,
          body.id,
          companyId,
        ],
      );
      await conn.commit();
      res.json({ message: "Employee updated successfully" });
    } else {
      const [result] = await conn.execute(
        `INSERT INTO hr_employees (
          company_id, branch_id, emp_code, first_name, last_name, middle_name,
          gender, dob, joining_date, email, phone, dept_id, pos_id, manager_id,
          employment_type, status, base_salary, address, created_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          companyId,
          branchId,
          body.emp_code,
          body.first_name,
          body.last_name,
          body.middle_name || null,
          body.gender || null,
          body.dob || null,
          body.joining_date,
          body.email || null,
          body.phone || null,
          body.dept_id || null,
          body.pos_id || null,
          body.manager_id || null,
          body.employment_type || "FULL_TIME",
          body.status || "PROBATION",
          body.base_salary || 0,
          body.address || null,
          userId,
        ],
      );
      await conn.commit();
      res.status(201).json({
        id: result.insertId,
        message: "Employee created successfully",
      });
    }
  } catch (err) {
    await conn.rollback();
    next(err);
  } finally {
    conn.release();
  }
}

/**
 * List Departments
 */
export async function listDepartments(req, res, next) {
  try {
    await ensureHRTables();
    const { companyId } = req.scope;
    const items = await query(
      `SELECT id, dept_code, dept_name FROM hr_departments WHERE company_id = :companyId AND deleted_at IS NULL ORDER BY dept_name ASC`,
      { companyId },
    );
    res.json({ items });
  } catch (err) {
    next(err);
  }
}

/**
 * List Positions
 */
export async function listPositions(req, res, next) {
  try {
    await ensureHRTables();
    const { companyId } = req.scope;
    const items = await query(
      `SELECT id, pos_code, pos_name FROM hr_positions WHERE company_id = :companyId AND deleted_at IS NULL ORDER BY pos_name ASC`,
      { companyId },
    );
    res.json({ items });
  } catch (err) {
    next(err);
  }
}

/**
 * Create/Update Department
 */
export async function saveDepartment(req, res, next) {
  try {
    await ensureHRTables();
    const { companyId, branchId } = req.scope;
    const { id, dept_code, dept_name, manager_id, parent_dept_id } = req.body;
    const userId = toNumber(req.user?.id || req.user?.sub, null);

    const params = {
      dept_code,
      dept_name,
      manager_id: toNumber(manager_id, null),
      parent_dept_id: toNumber(parent_dept_id, null),
      userId,
      companyId,
    };

    if (id) {
      await query(
        `UPDATE hr_departments SET dept_code = :dept_code, dept_name = :dept_name, 
                manager_id = :manager_id, parent_dept_id = :parent_dept_id, updated_by = :userId
         WHERE id = :id AND company_id = :companyId`,
        { ...params, id },
      );
      res.json({ message: "Department updated" });
    } else {
      const result = await query(
        `INSERT INTO hr_departments (company_id, branch_id, dept_code, dept_name, manager_id, parent_dept_id, created_by)
         VALUES (:companyId, :branchId, :dept_code, :dept_name, :manager_id, :parent_dept_id, :userId)`,
        { ...params, branchId },
      );
      res
        .status(201)
        .json({ id: result.insertId, message: "Department created" });
    }
  } catch (err) {
    next(err);
  }
}

/**
 * Create/Update Position
 */
export async function savePosition(req, res, next) {
  try {
    await ensureHRTables();
    const { companyId, branchId } = req.scope;
    const { id, pos_code, pos_name, dept_id } = req.body;
    const userId = toNumber(req.user?.id || req.user?.sub, null);

    const params = {
      pos_code,
      pos_name,
      dept_id: toNumber(dept_id, null),
      userId,
      companyId,
    };

    if (id) {
      await query(
        `UPDATE hr_positions SET pos_code = :pos_code, pos_name = :pos_name, 
                dept_id = :dept_id, updated_by = :userId
         WHERE id = :id AND company_id = :companyId`,
        { ...params, id },
      );
      res.json({ message: "Position updated" });
    } else {
      const result = await query(
        `INSERT INTO hr_positions (company_id, branch_id, pos_code, pos_name, dept_id, created_by)
         VALUES (:companyId, :branchId, :pos_code, :pos_name, :dept_id, :userId)`,
        { ...params, branchId },
      );
      res
        .status(201)
        .json({ id: result.insertId, message: "Position created" });
    }
  } catch (err) {
    next(err);
  }
}

/**
 * Recruitment - List Requisitions
 */
export async function getNextRequisitionNo(req, res, next) {
  try {
    const { companyId } = req.scope;
    const rows = await query(
      `SELECT MAX(id) as max_id FROM hr_job_requisitions WHERE company_id = :companyId`,
      { companyId },
    );
    const nextId = (rows[0]?.max_id || 0) + 1;
    const nextReqNo = String(nextId).padStart(6, "0");
    res.json({ nextReqNo });
  } catch (err) {
    next(err);
  }
}

export async function listRequisitions(req, res, next) {
  try {
    const { companyId } = req.scope;
    const items = await query(
      `SELECT r.*, d.dept_name, p.pos_name 
       FROM hr_job_requisitions r
       LEFT JOIN hr_departments d ON d.id = r.dept_id
       LEFT JOIN hr_positions p ON p.id = r.pos_id
       WHERE r.company_id = :companyId
       ORDER BY r.created_at DESC`,
      { companyId },
    );
    res.json({ items });
  } catch (err) {
    next(err);
  }
}

export async function getRequisitionById(req, res, next) {
  try {
    const { companyId } = req.scope;
    const { id } = req.params;
    const rows = await query(
      `SELECT r.*, d.dept_name, p.pos_name 
       FROM hr_job_requisitions r
       LEFT JOIN hr_departments d ON d.id = r.dept_id
       LEFT JOIN hr_positions p ON p.id = r.pos_id
       WHERE r.id = :id AND r.company_id = :companyId`,
      { id, companyId },
    );
    if (!rows.length)
      throw httpError(404, "NOT_FOUND", "Requisition not found");
    res.json({ item: rows[0] });
  } catch (err) {
    next(err);
  }
}
/**
 * Recruitment - Save Requisition
 */
export async function saveRequisition(req, res, next) {
  try {
    const { companyId, branchId } = req.scope;
    const userId = req.user?.id || req.user?.sub;
    const {
      id,
      req_no,
      title,
      dept_id,
      pos_id,
      vacancies,
      employment_type,
      recruitment_type,
      from_date,
      to_date,
      reason,
      requirements,
      status,
    } = req.body;

    if (id) {
      await query(
        `UPDATE hr_job_requisitions SET title = :title, vacancies = :vacancies, 
                employment_type = :employment_type, recruitment_type = :recruitment_type,
                from_date = :from_date, to_date = :to_date,
                reason = :reason, requirements = :requirements, 
                status = :status, updated_by = :userId
         WHERE id = :id AND company_id = :companyId`,
        {
          id,
          title,
          vacancies,
          employment_type,
          recruitment_type,
          from_date,
          to_date,
          reason,
          requirements,
          status,
          userId,
          companyId,
        },
      );
      res.json({ message: "Requisition updated" });
    } else {
      const result = await query(
        `INSERT INTO hr_job_requisitions (company_id, branch_id, req_no, title, dept_id, pos_id, vacancies, employment_type, recruitment_type, from_date, to_date, reason, requirements, status, created_by)
         VALUES (:companyId, :branchId, :req_no, :title, :dept_id, :pos_id, :vacancies, :employment_type, :recruitment_type, :from_date, :to_date, :reason, :requirements, :status, :userId)`,
        {
          companyId,
          branchId,
          req_no,
          title,
          dept_id,
          pos_id,
          vacancies,
          employment_type,
          recruitment_type,
          from_date,
          to_date,
          reason,
          requirements,
          status,
          userId,
        },
      );
      res
        .status(201)
        .json({ id: result.insertId, message: "Requisition created" });
    }
  } catch (err) {
    next(err);
  }
}

/**
 * Recruitment - Submit Requisition to Workflow
 */
export async function submitRequisition(req, res, next) {
  try {
    await ensureWorkflowTables();
    const { companyId } = req.scope;
    const id = toNumber(req.params.id, null);
    if (!id) throw httpError(400, "BAD_REQUEST", "Invalid requisition ID");

    const [reqRow] = await query(
      `SELECT * FROM hr_job_requisitions WHERE id = :id AND company_id = :companyId`,
      { id, companyId },
    ).catch(() => []);
    if (!reqRow) throw httpError(404, "NOT_FOUND", "Requisition not found");

    const [workflow] = await query(
      `SELECT * FROM adm_workflows 
       WHERE company_id = :companyId 
         AND (document_type = 'Job Requisition' OR document_type = 'JOB_REQUISITION')
         AND is_active = 1 
       ORDER BY id ASC LIMIT 1`,
      { companyId },
    ).catch(() => []);
    if (!workflow)
      throw httpError(
        400,
        "BAD_REQUEST",
        "Job Requisition workflow not configured",
      );

    const [firstStep] = await query(
      `SELECT * FROM adm_workflow_steps WHERE workflow_id = :wfId ORDER BY step_order ASC LIMIT 1`,
      { wfId: workflow.id },
    ).catch(() => []);
    if (!firstStep)
      throw httpError(400, "BAD_REQUEST", "Workflow has no steps");

    const [firstAssignedRow] = await query(
      `SELECT approver_user_id 
       FROM adm_workflow_step_approvers 
       WHERE workflow_id = :wfId AND step_order = :step 
       ORDER BY approver_user_id ASC LIMIT 1`,
      { wfId: workflow.id, step: firstStep.step_order },
    ).catch(() => []);
    const firstAssigned =
      firstAssignedRow?.approver_user_id || firstStep.approver_user_id || null;

    const result = await query(
      `INSERT INTO adm_document_workflows 
       (company_id, workflow_id, document_id, document_type, amount, current_step_order, status, assigned_to_user_id)
       VALUES (:companyId, :workflow_id, :document_id, :document_type, :amount, :step_order, 'PENDING', :user_id)`,
      {
        companyId,
        workflow_id: workflow.id,
        document_id: id,
        document_type: "Job Requisition",
        amount: 0,
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
        workflow_id: workflow.id,
        dw_id: result.insertId,
        document_id: id,
        document_type: "Job Requisition",
        step_order: firstStep.step_order,
        assigned_to: firstAssigned,
      },
    );

    await query(
      `INSERT INTO adm_workflow_logs (document_workflow_id, step_order, action, actor_user_id, comments)
       VALUES (:id, :step, 'SUBMIT', :userId, 'Job requisition submitted for approval')`,
      {
        id: result.insertId,
        step: firstStep.step_order,
        userId: req.user.sub,
      },
    );

    await query(
      `UPDATE hr_job_requisitions SET status = 'PENDING' WHERE id = :id`,
      { id },
    );

    try {
      const { notifyWorkflowForward } =
        await import("../services/notifications/workflowNotify.js");
      if (firstAssigned) {
        await notifyWorkflowForward({
          companyId,
          userId: firstAssigned,
          workflowInstanceId: result.insertId,
          documentId: id,
          documentType: "Job Requisition",
          title: "Job Requisition Forwarded",
          message: `Job Requisition #${reqRow.req_no || id} forwarded for approval.`,
          action: "APPROVE",
          senderName: req.user?.name || req.user?.username || "System",
        });
      }
    } catch {}

    res.status(201).json({
      message: "Workflow started",
      instanceId: result.insertId,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Recruitment - Candidates
 */
export async function listCandidates(req, res, next) {
  try {
    const { companyId } = req.scope;
    const items = await query(
      `SELECT c.*, r.title as requisition_title, r.recruitment_type, p.pos_name
       FROM hr_candidates c
       LEFT JOIN hr_job_requisitions r ON r.id = c.requisition_id
       LEFT JOIN hr_positions p ON p.id = r.pos_id
       WHERE c.company_id = :companyId
       ORDER BY c.created_at DESC`,
      { companyId },
    );
    res.json({ items });
  } catch (err) {
    next(err);
  }
}

export async function getCandidate(req, res, next) {
  try {
    const { companyId } = req.scope;
    const { id } = req.params;
    const rows = await query(
      `SELECT c.*, r.title as requisition_title, r.recruitment_type, p.pos_name
       FROM hr_candidates c
       LEFT JOIN hr_job_requisitions r ON r.id = c.requisition_id
       LEFT JOIN hr_positions p ON p.id = r.pos_id
       WHERE c.id = :id AND c.company_id = :companyId`,
      { id, companyId },
    );
    if (!rows.length) throw httpError(404, "NOT_FOUND", "Candidate not found");
    res.json({ item: rows[0] });
  } catch (err) {
    next(err);
  }
}

export async function saveCandidate(req, res, next) {
  try {
    const { companyId } = req.scope;
    const {
      id,
      first_name,
      last_name,
      email,
      phone,
      resume_url,
      source,
      requisition_id,
      status,
    } = req.body;

    if (id) {
      await query(
        `UPDATE hr_candidates SET first_name = :first_name, last_name = :last_name, 
                email = :email, phone = :phone, resume_url = :resume_url, 
                source = :source, requisition_id = :requisition_id, status = :status
         WHERE id = :id AND company_id = :companyId`,
        {
          id,
          first_name,
          last_name,
          email,
          phone,
          resume_url,
          source,
          requisition_id,
          status,
          companyId,
        },
      );
      res.json({ message: "Candidate updated" });
    } else {
      const result = await query(
        `INSERT INTO hr_candidates (company_id, first_name, last_name, email, phone, resume_url, source, requisition_id, status)
         VALUES (:companyId, :first_name, :last_name, :email, :phone, :resume_url, :source, :requisition_id, :status)`,
        {
          companyId,
          first_name,
          last_name,
          email,
          phone,
          resume_url,
          source,
          requisition_id,
          status,
        },
      );
      res.status(201).json({ id: result.insertId, message: "Candidate created" });
    }
  } catch (err) {
    next(err);
  }
}

export async function savePromotion(req, res, next) {
  try {
    const { companyId } = req.scope;
    const {
      employee_id,
      promotion_date,
      previous_pos_id,
      new_pos_id,
      previous_salary,
      new_salary,
      remarks,
    } = req.body;

    await query(
      `INSERT INTO hr_promotions (company_id, employee_id, promotion_date, previous_pos_id, new_pos_id, previous_salary, new_salary, remarks)
       VALUES (:companyId, :employee_id, :promotion_date, :previous_pos_id, :new_pos_id, :previous_salary, :new_salary, :remarks)`,
      {
        companyId,
        employee_id,
        promotion_date,
        previous_pos_id,
        new_pos_id,
        previous_salary,
        new_salary,
        remarks,
      },
    );

    // Update employee record if position or salary changed
    const updates = [];
    const params = { employee_id, companyId };
    if (new_pos_id) {
      updates.push("pos_id = :new_pos_id");
      params.new_pos_id = new_pos_id;
    }
    if (new_salary) {
      updates.push("base_salary = :new_salary");
      params.new_salary = new_salary;
    }

    if (updates.length > 0) {
      await query(
        `UPDATE hr_employees SET ${updates.join(", ")} WHERE id = :employee_id AND company_id = :companyId`,
        params,
      );
    }

    res.json({ message: "Promotion saved and employee updated" });
  } catch (err) {
    next(err);
  }
}

export async function listPromotions(req, res, next) {
  try {
    const { companyId } = req.scope;
    const items = await query(
      `SELECT pr.*, e.first_name, e.last_name, e.emp_code, p1.pos_name as previous_pos, p2.pos_name as new_pos
       FROM hr_promotions pr
       JOIN hr_employees e ON e.id = pr.employee_id
       LEFT JOIN hr_positions p1 ON p1.id = pr.previous_pos_id
       LEFT JOIN hr_positions p2 ON p2.id = pr.new_pos_id
       WHERE pr.company_id = :companyId
       ORDER BY pr.promotion_date DESC`,
      { companyId },
    );
    res.json({ items });
  } catch (err) {
    next(err);
  }
}

export async function saveInterview(req, res, next) {
  try {
    const {
      id,
      company_id,
      requisition_id,
      candidate_id,
      interviewer_user_id,
      scheduled_at,
      status,
      feedback,
    } = req.body;
    if (id) {
      await query(
        `UPDATE hr_interviews SET interviewer_user_id = :interviewer_user_id, scheduled_at = :scheduled_at, status = :status, feedback = :feedback
         WHERE id = :id`,
        { id, interviewer_user_id, scheduled_at, status, feedback },
      );
      res.json({ message: "Interview updated" });
    } else {
      const result = await query(
        `INSERT INTO hr_interviews (company_id, requisition_id, candidate_id, interviewer_user_id, scheduled_at, status, feedback)
         VALUES (:companyId, :requisition_id, :candidate_id, :interviewer_user_id, :scheduled_at, :status, :feedback)`,
        {
          companyId: company_id || req.scope.companyId,
          requisition_id,
          candidate_id,
          interviewer_user_id,
          scheduled_at,
          status: status || "SCHEDULED",
          feedback: feedback || null,
        },
      );
      res.status(201).json({ id: result.insertId, message: "Interview saved" });
    }
  } catch (err) {
    next(err);
  }
}

export async function listInterviews(req, res, next) {
  try {
    const { requisition_id, candidate_id } = req.query;
    const clauses = [];
    const params = {};
    if (requisition_id) {
      clauses.push("i.requisition_id = :requisition_id");
      params.requisition_id = requisition_id;
    }
    if (candidate_id) {
      clauses.push("i.candidate_id = :candidate_id");
      params.candidate_id = candidate_id;
    }
    const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
    const items = await query(
      `SELECT i.*, c.first_name, c.last_name, r.title AS requisition_title
       FROM hr_interviews i
       LEFT JOIN hr_candidates c ON c.id = i.candidate_id
       LEFT JOIN hr_job_requisitions r ON r.id = i.requisition_id
       ${where}
       ORDER BY i.scheduled_at DESC`,
      params,
    );
    res.json({ items });
  } catch (err) {
    next(err);
  }
}

/**
 * Recruitment - Offers
 */
export async function saveOffer(req, res, next) {
  try {
    const {
      id,
      company_id,
      requisition_id,
      candidate_id,
      offer_no,
      offer_date,
      position_id,
      gross_salary,
      allowances,
      deductions,
      net_salary,
      status,
      remarks,
    } = req.body;
    if (id) {
      await query(
        `UPDATE hr_offers SET offer_no = :offer_no, offer_date = :offer_date, position_id = :position_id,
                gross_salary = :gross_salary, allowances = :allowances, deductions = :deductions, net_salary = :net_salary,
                status = :status, remarks = :remarks
         WHERE id = :id`,
        {
          id,
          offer_no,
          offer_date,
          position_id,
          gross_salary,
          allowances,
          deductions,
          net_salary,
          status,
          remarks,
        },
      );
      res.json({ message: "Offer updated" });
    } else {
      const result = await query(
        `INSERT INTO hr_offers (company_id, requisition_id, candidate_id, offer_no, offer_date, position_id, gross_salary, allowances, deductions, net_salary, status, remarks)
         VALUES (:company_id, :requisition_id, :candidate_id, :offer_no, :offer_date, :position_id, :gross_salary, :allowances, :deductions, :net_salary, :status, :remarks)`,
        {
          company_id: company_id || req.scope.companyId,
          requisition_id,
          candidate_id,
          offer_no,
          offer_date,
          position_id: position_id || null,
          gross_salary: gross_salary || 0,
          allowances: allowances || 0,
          deductions: deductions || 0,
          net_salary:
            net_salary ||
            (gross_salary || 0) + (allowances || 0) - (deductions || 0),
          status: status || "DRAFT",
          remarks: remarks || null,
        },
      );
      res.status(201).json({ id: result.insertId, message: "Offer created" });
    }
  } catch (err) {
    next(err);
  }
}

export async function listOffers(req, res, next) {
  try {
    const { requisition_id, candidate_id } = req.query;
    const clauses = [];
    const params = {};
    if (requisition_id) {
      clauses.push("o.requisition_id = :requisition_id");
      params.requisition_id = requisition_id;
    }
    if (candidate_id) {
      clauses.push("o.candidate_id = :candidate_id");
      params.candidate_id = candidate_id;
    }
    const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
    const items = await query(
      `SELECT o.*, c.first_name, c.last_name, r.title AS requisition_title
       FROM hr_offers o
       LEFT JOIN hr_candidates c ON c.id = o.candidate_id
       LEFT JOIN hr_job_requisitions r ON r.id = o.requisition_id
       ${where}
       ORDER BY o.offer_date DESC`,
      params,
    );
    res.json({ items });
  } catch (err) {
    next(err);
  }
}

/**
 * Attendance APIs
 */
export async function listShifts(req, res, next) {
  try {
    await ensureHRTables();
    const { companyId } = req.scope;
    const items = await query(
      `SELECT * FROM hr_shifts WHERE company_id = :companyId AND is_active = 1 ORDER BY start_time ASC`,
      { companyId },
    );
    res.json({ items });
  } catch (err) {
    next(err);
  }
}

export async function saveShift(req, res, next) {
  try {
    const { companyId } = req.scope;
    const userId = req.user?.id || req.user?.sub;
    const { id, code, name, start_time, end_time, break_minutes, is_active } =
      req.body;
    if (id) {
      await query(
        `UPDATE hr_shifts SET code = :code, name = :name, start_time = :start_time, end_time = :end_time, break_minutes = :break_minutes, is_active = :is_active, updated_by = :userId
         WHERE id = :id AND company_id = :companyId`,
        {
          id,
          code,
          name,
          start_time,
          end_time,
          break_minutes: toNumber(break_minutes, 0),
          is_active: is_active ? 1 : 0,
          userId,
          companyId,
        },
      );
      res.json({ message: "Shift updated" });
    } else {
      const result = await query(
        `INSERT INTO hr_shifts (company_id, code, name, start_time, end_time, break_minutes, is_active, created_by)
         VALUES (:companyId, :code, :name, :start_time, :end_time, :break_minutes, 1, :userId)`,
        {
          companyId,
          code,
          name,
          start_time,
          end_time,
          break_minutes: toNumber(break_minutes, 0),
          userId,
        },
      );
      res.status(201).json({ id: result.insertId, message: "Shift created" });
    }
  } catch (err) {
    next(err);
  }
}

export async function clockIn(req, res, next) {
  try {
    const { companyId } = req.scope;
    const employee_id = toNumber(req.body.employee_id, null);
    const attendance_date =
      req.body.attendance_date || new Date().toISOString().slice(0, 10);
    if (!employee_id)
      throw httpError(400, "BAD_REQUEST", "employee_id required");

    const existing = await query(
      `SELECT id, clock_in FROM hr_attendance WHERE employee_id = :employee_id AND attendance_date = :attendance_date`,
      { employee_id, attendance_date },
    );
    if (existing.length && existing[0].clock_in) {
      return res.json({ id: existing[0].id, message: "Already clocked in" });
    }
    if (existing.length) {
      await query(
        `UPDATE hr_attendance SET clock_in = NOW(), status = 'PRESENT' WHERE id = :id`,
        { id: existing[0].id },
      );
      return res.json({ id: existing[0].id, message: "Clock-in updated" });
    }
    const result = await query(
      `INSERT INTO hr_attendance (company_id, employee_id, attendance_date, clock_in, status)
       VALUES (:companyId, :employee_id, :attendance_date, NOW(), 'PRESENT')`,
      { companyId, employee_id, attendance_date },
    );
    return res.status(201).json({ id: result.insertId, message: "Clocked in" });
  } catch (err) {
    next(err);
  }
}

export async function clockOut(req, res, next) {
  try {
    const employee_id = toNumber(req.body.employee_id, null);
    const attendance_date =
      req.body.attendance_date || new Date().toISOString().slice(0, 10);
    if (!employee_id)
      throw httpError(400, "BAD_REQUEST", "employee_id required");
    const rows = await query(
      `SELECT id, clock_in FROM hr_attendance WHERE employee_id = :employee_id AND attendance_date = :attendance_date`,
      { employee_id, attendance_date },
    );
    if (!rows.length) throw httpError(404, "NOT_FOUND", "Attendance not found");
    await query(`UPDATE hr_attendance SET clock_out = NOW() WHERE id = :id`, {
      id: rows[0].id,
    });
    res.json({ id: rows[0].id, message: "Clocked out" });
  } catch (err) {
    next(err);
  }
}

export async function listAttendance(req, res, next) {
  try {
    await ensureHRTables();
    const { employee_id, from_date, to_date } = req.query;
    const clauses = [];
    const params = {};
    if (employee_id) {
      clauses.push("a.employee_id = :employee_id");
      params.employee_id = toNumber(employee_id, null);
    }
    if (from_date) {
      clauses.push("a.attendance_date >= :from_date");
      params.from_date = from_date;
    }
    if (to_date) {
      clauses.push("a.attendance_date <= :to_date");
      params.to_date = to_date;
    }
    const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
    const items = await query(
      `SELECT a.*, e.first_name, e.last_name
       FROM hr_attendance a
       LEFT JOIN hr_employees e ON e.id = a.employee_id
       ${where}
       ORDER BY a.attendance_date DESC`,
      params,
    );
    res.json({ items });
  } catch (err) {
    next(err);
  }
}

export async function saveBulkAttendance(req, res, next) {
  try {
    const { companyId } = req.scope;
    const { date, attendance } = req.body; // attendance is an array of { employee_id, status, clock_in, clock_out, remarks }

    if (!date || !Array.isArray(attendance)) {
      throw httpError(400, "VALIDATION_ERROR", "Invalid payload");
    }

    for (const item of attendance) {
      await query(
        `INSERT INTO hr_attendance (company_id, employee_id, attendance_date, status, clock_in, clock_out, remarks)
         VALUES (:companyId, :employeeId, :date, :status, :clockIn, :clockOut, :remarks)
         ON DUPLICATE KEY UPDATE status = VALUES(status), clock_in = VALUES(clock_in), clock_out = VALUES(clock_out), remarks = VALUES(remarks)`,
        {
          companyId,
          employeeId: item.employee_id,
          date,
          status: item.status || "PRESENT",
          clockIn: item.clock_in || null,
          clockOut: item.clock_out || null,
          remarks: item.remarks || null,
        },
      );
    }

    res.json({ message: "Bulk attendance saved successfully" });
  } catch (err) {
    next(err);
  }
}

export async function saveTimesheet(req, res, next) {
  try {
    const { companyId } = req.scope;
    const { employee_id, work_date, hours_worked, overtime_hours, remarks } =
      req.body;
    const existing = await query(
      `SELECT id FROM hr_timesheets WHERE employee_id = :employee_id AND work_date = :work_date`,
      { employee_id, work_date },
    );
    if (existing.length) {
      await query(
        `UPDATE hr_timesheets SET hours_worked = :hours_worked, overtime_hours = :overtime_hours, remarks = :remarks 
         WHERE id = :id`,
        {
          id: existing[0].id,
          hours_worked: toNumber(hours_worked, 0),
          overtime_hours: toNumber(overtime_hours, 0),
          remarks: remarks || null,
        },
      );
      return res.json({ id: existing[0].id, message: "Timesheet updated" });
    }
    const result = await query(
      `INSERT INTO hr_timesheets (company_id, employee_id, work_date, hours_worked, overtime_hours, remarks)
       VALUES (:companyId, :employee_id, :work_date, :hours_worked, :overtime_hours, :remarks)`,
      {
        companyId,
        employee_id,
        work_date,
        hours_worked: toNumber(hours_worked, 0),
        overtime_hours: toNumber(overtime_hours, 0),
        remarks: remarks || null,
      },
    );
    res.status(201).json({ id: result.insertId, message: "Timesheet saved" });
  } catch (err) {
    next(err);
  }
}

export async function listTimesheets(req, res, next) {
  try {
    const { companyId } = req.scope;
    const { employee_id, from_date, to_date } = req.query;
    const clauses = ["t.company_id = :companyId"];
    const params = { companyId };

    if (employee_id) {
      clauses.push("t.employee_id = :employee_id");
      params.employee_id = employee_id;
    }
    if (from_date) {
      clauses.push("t.work_date >= :from_date");
      params.from_date = from_date;
    }
    if (to_date) {
      clauses.push("t.work_date <= :to_date");
      params.to_date = to_date;
    }

    const where = `WHERE ${clauses.join(" AND ")}`;
    const items = await query(
      `SELECT t.*, e.first_name, e.last_name, e.emp_code 
       FROM hr_timesheets t
       JOIN hr_employees e ON e.id = t.employee_id
       ${where}
       ORDER BY t.work_date DESC, e.last_name ASC`,
      params,
    );
    res.json({ items });
  } catch (err) {
    next(err);
  }
}

export async function biometricWebhook(req, res, next) {
  try {
    const { employee_code, event_type, event_time } = req.body;
    const rows = await query(
      `SELECT id FROM hr_employees WHERE emp_code = :code LIMIT 1`,
      { code: employee_code },
    );
    if (!rows.length) throw httpError(404, "NOT_FOUND", "Employee not found");
    const employee_id = rows[0].id;
    const dateStr = (event_time || new Date().toISOString()).slice(0, 10);
    const exist = await query(
      `SELECT id, clock_in, clock_out FROM hr_attendance WHERE employee_id = :eid AND attendance_date = :d`,
      { eid: employee_id, d: dateStr },
    );
    if (String(event_type || "").toUpperCase() === "IN") {
      if (exist.length) {
        await query(
          `UPDATE hr_attendance SET clock_in = :t, status = 'PRESENT' WHERE id = :id`,
          { t: event_time || new Date().toISOString(), id: exist[0].id },
        );
      } else {
        await query(
          `INSERT INTO hr_attendance (company_id, employee_id, attendance_date, clock_in, status)
           VALUES (:companyId, :eid, :date, :t, 'PRESENT')`,
          {
            companyId: req.scope.companyId,
            eid: employee_id,
            date: dateStr,
            t: event_time || new Date().toISOString(),
          },
        );
      }
    } else if (String(event_type || "").toUpperCase() === "OUT") {
      if (exist.length) {
        await query(`UPDATE hr_attendance SET clock_out = :t WHERE id = :id`, {
          t: event_time || new Date().toISOString(),
          id: exist[0].id,
        });
      } else {
        await query(
          `INSERT INTO hr_attendance (company_id, employee_id, attendance_date, clock_out, status)
           VALUES (:companyId, :eid, :date, :t, 'PRESENT')`,
          {
            companyId: req.scope.companyId,
            eid: employee_id,
            date: dateStr,
            t: event_time || new Date().toISOString(),
          },
        );
      }
    }
    res.json({ message: "Recorded" });
  } catch (err) {
    next(err);
  }
}
/**
 * Leave Management
 */
export async function listLeaveTypes(req, res, next) {
  try {
    await ensureHRTables();
    const { companyId } = req.scope;
    const items = await query(
      `SELECT * FROM hr_leave_types WHERE company_id = :companyId ORDER BY type_name ASC`,
      { companyId },
    );
    res.json({ items });
  } catch (err) {
    next(err);
  }
}

export async function getLeaveType(req, res, next) {
  try {
    const { id } = req.params;
    const { companyId } = req.scope;
    const rows = await query(
      `SELECT * FROM hr_leave_types WHERE id = :id AND company_id = :companyId`,
      { id, companyId },
    );
    if (!rows.length) throw httpError(404, "NOT_FOUND", "Leave type not found");
    res.json({ item: rows[0] });
  } catch (err) {
    next(err);
  }
}

export async function saveLeaveType(req, res, next) {
  try {
    await ensureHRTables();
    const { companyId } = req.scope;
    const { id, type_name, days_per_year, is_paid, carry_forward } = req.body;
    if (id) {
      await query(
        `UPDATE hr_leave_types SET type_name = :type_name, days_per_year = :days_per_year, is_paid = :is_paid, carry_forward = :carry_forward 
         WHERE id = :id AND company_id = :companyId`,
        {
          id,
          type_name,
          days_per_year: toNumber(days_per_year, 0),
          is_paid: is_paid ? 1 : 0,
          carry_forward: carry_forward ? 1 : 0,
          companyId,
        },
      );
      res.json({ message: "Leave type updated" });
    } else {
      const result = await query(
        `INSERT INTO hr_leave_types (company_id, type_name, days_per_year, is_paid, carry_forward)
         VALUES (:companyId, :type_name, :days_per_year, :is_paid, :carry_forward)`,
        {
          companyId,
          type_name,
          days_per_year: toNumber(days_per_year, 0),
          is_paid: is_paid ? 1 : 0,
          carry_forward: carry_forward ? 1 : 0,
        },
      );
      res
        .status(201)
        .json({ id: result.insertId, message: "Leave type created" });
    }
  } catch (err) {
    next(err);
  }
}

export async function listLeaveBalances(req, res, next) {
  try {
    const { employee_id } = req.query;
    const clauses = [];
    const params = {};
    if (employee_id) {
      clauses.push("b.employee_id = :employee_id");
      params.employee_id = toNumber(employee_id, null);
    }
    const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
    const items = await query(
      `SELECT b.*, t.type_name
       FROM hr_leave_balances b
       JOIN hr_leave_types t ON t.id = b.leave_type_id
       ${where}
       ORDER BY t.type_name ASC`,
      params,
    );
    res.json({ items });
  } catch (err) {
    next(err);
  }
}

export async function listLeaveRequests(req, res, next) {
  try {
    const { employee_id, status } = req.query;
    const clauses = [];
    const params = {};
    if (employee_id) {
      clauses.push("r.employee_id = :employee_id");
      params.employee_id = toNumber(employee_id, null);
    }
    if (status && status !== "ALL") {
      clauses.push("r.status = :status");
      params.status = status;
    }
    const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
    const items = await query(
      `SELECT r.*, e.first_name, e.last_name, t.type_name 
       FROM hr_leave_requests r
       LEFT JOIN hr_employees e ON e.id = r.employee_id
       LEFT JOIN hr_leave_types t ON t.id = r.leave_type_id
       ${where}
       ORDER BY r.created_at DESC`,
      params,
    );
    res.json({ items });
  } catch (err) {
    next(err);
  }
}

export async function applyLeave(req, res, next) {
  try {
    const {
      employee_id,
      leave_type_id,
      start_date,
      end_date,
      total_days,
      reason,
    } = req.body;
    try {
      const { validateLeaveRequest } =
        await import("../validators/hr.validators.js");
      const errs = validateLeaveRequest(req.body);
      if (errs.length)
        throw httpError(
          400,
          "VALIDATION_ERROR",
          `Missing fields: ${errs.join(",")}`,
        );
    } catch {}
    const result = await query(
      `INSERT INTO hr_leave_requests (employee_id, leave_type_id, start_date, end_date, total_days, reason, status)
       VALUES (:employee_id, :leave_type_id, :start_date, :end_date, :total_days, :reason, 'PENDING')`,
      {
        employee_id,
        leave_type_id,
        start_date,
        end_date,
        total_days: toNumber(total_days, 0),
        reason: reason || null,
      },
    );
    res.status(201).json({ id: result.insertId, message: "Leave requested" });
  } catch (err) {
    next(err);
  }
}

export async function approveLeave(req, res, next) {
  try {
    const { id } = req.params;
    const { approved } = req.body;
    const rows = await query(`SELECT * FROM hr_leave_requests WHERE id = :id`, {
      id,
    });
    if (!rows.length)
      throw httpError(404, "NOT_FOUND", "Leave request not found");
    const reqRow = rows[0];
    const nextStatus = approved ? "APPROVED" : "REJECTED";
    await query(
      `UPDATE hr_leave_requests SET status = :status WHERE id = :id`,
      { status: nextStatus, id },
    );
    if (approved) {
      const existing = await query(
        `SELECT id, balance_days FROM hr_leave_balances WHERE employee_id = :employee_id AND leave_type_id = :leave_type_id`,
        {
          employee_id: reqRow.employee_id,
          leave_type_id: reqRow.leave_type_id,
        },
      );
      if (existing.length) {
        await query(
          `UPDATE hr_leave_balances SET balance_days = GREATEST(balance_days - :days, 0) WHERE id = :id`,
          { id: existing[0].id, days: toNumber(reqRow.total_days, 0) },
        );
      }
    }
    res.json({ message: `Leave ${nextStatus.toLowerCase()}` });
  } catch (err) {
    next(err);
  }
}

/**
 * Payroll APIs
 */
export async function listPayrollPeriods(req, res, next) {
  try {
    await ensureHRTables();
    const { companyId } = req.scope;
    const items = await query(
      `SELECT * FROM hr_payroll_periods WHERE company_id = :companyId ORDER BY start_date DESC`,
      { companyId },
    );
    res.json({ items });
  } catch (err) {
    next(err);
  }
}

export async function savePayrollPeriod(req, res, next) {
  try {
    await ensureHRTables();
    const { companyId } = req.scope;
    const { id, period_name, start_date, end_date, status } = req.body;
    if (id) {
      await query(
        `UPDATE hr_payroll_periods SET period_name = :period_name, start_date = :start_date, end_date = :end_date, status = :status
         WHERE id = :id AND company_id = :companyId`,
        { id, period_name, start_date, end_date, status, companyId },
      );
      res.json({ message: "Payroll period updated" });
    } else {
      const result = await query(
        `INSERT INTO hr_payroll_periods (company_id, period_name, start_date, end_date, status)
         VALUES (:companyId, :period_name, :start_date, :end_date, :status)`,
        {
          companyId,
          period_name,
          start_date,
          end_date,
          status: status || "OPEN",
        },
      );
      res
        .status(201)
        .json({ id: result.insertId, message: "Payroll period created" });
    }
  } catch (err) {
    next(err);
  }
}

export async function generatePayroll(req, res, next) {
  try {
    const { companyId } = req.scope;
    const { period_id } = req.body;
    if (!period_id) throw httpError(400, "BAD_REQUEST", "period_id required");
    const [period] = await query(
      `SELECT * FROM hr_payroll_periods WHERE id = :id AND company_id = :companyId`,
      { id: period_id, companyId },
    );
    if (!period) throw httpError(404, "NOT_FOUND", "Payroll period not found");

    const existing = await query(
      `SELECT id, status FROM hr_payroll WHERE company_id = :companyId AND period_id = :period_id`,
      { companyId, period_id },
    );
    let payrollId = null;
    if (existing.length) {
      payrollId = existing[0].id;
      await query(
        `UPDATE hr_payroll SET status = 'OPEN', generated_at = NOW() WHERE id = :id`,
        { id: payrollId },
      );
      await query(`DELETE FROM hr_payroll_items WHERE payroll_id = :id`, {
        id: payrollId,
      });
    } else {
      const hdr = await query(
        `INSERT INTO hr_payroll (company_id, period_id, status, generated_at)
         VALUES (:companyId, :period_id, 'OPEN', NOW())`,
        { companyId, period_id },
      );
      payrollId = hdr.insertId;
    }

    const employees = await query(
      `SELECT id, base_salary FROM hr_employees WHERE company_id = :companyId AND status = 'ACTIVE' AND deleted_at IS NULL`,
      { companyId },
    );
    for (const e of employees) {
      const overrides = await query(
        `SELECT * FROM hr_employee_salaries WHERE employee_id = :eid AND status = 'ACTIVE' ORDER BY effective_from DESC LIMIT 1`,
        { eid: e.id },
      ).catch(() => []);
      const basic = overrides.length
        ? overrides[0].basic_salary
        : e.base_salary;
      const allowances = overrides.length ? overrides[0].allowances : 0;
      const deductions = overrides.length ? overrides[0].deductions : 0;
      const net = Number(basic) + Number(allowances) - Number(deductions);
      // eslint-disable-next-line no-await-in-loop
      await query(
        `INSERT INTO hr_payroll_items (payroll_id, employee_id, basic_salary, allowances, deductions, net_salary)
         VALUES (:payroll_id, :employee_id, :basic_salary, :allowances, :deductions, :net_salary)`,
        {
          payroll_id: payrollId,
          employee_id: e.id,
          basic_salary: basic || 0,
          allowances: allowances || 0,
          deductions: deductions || 0,
          net_salary: net || 0,
        },
      );
      // eslint-disable-next-line no-await-in-loop
      await query(
        `INSERT INTO hr_payslips (employee_id, period_id, basic_salary, allowances, deductions, net_salary, status)
         VALUES (:employee_id, :period_id, :basic_salary, :allowances, :deductions, :net_salary, 'DRAFT')
         ON DUPLICATE KEY UPDATE basic_salary = VALUES(basic_salary), allowances = VALUES(allowances), deductions = VALUES(deductions), net_salary = VALUES(net_salary)`,
        {
          employee_id: e.id,
          period_id,
          basic_salary: basic || 0,
          allowances: allowances || 0,
          deductions: deductions || 0,
          net_salary: net || 0,
        },
      );
    }

    await query(`UPDATE hr_payroll SET status = 'GENERATED' WHERE id = :id`, {
      id: payrollId,
    });

    res.json({ id: payrollId, message: "Payroll generated" });
  } catch (err) {
    next(err);
  }
}

export async function listPayslips(req, res, next) {
  try {
    const { companyId } = req.scope;
    const { period_id, employee_id } = req.query;
    const clauses = ["e.company_id = :companyId"];
    const params = { companyId };
    if (period_id) {
      clauses.push("p.period_id = :period_id");
      params.period_id = period_id;
    }
    if (employee_id) {
      clauses.push("p.employee_id = :employee_id");
      params.employee_id = employee_id;
    }
    const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
    const items = await query(
      `SELECT p.*, e.first_name, e.last_name, e.emp_code, e.email, pr.period_name
       FROM hr_payslips p
       JOIN hr_employees e ON e.id = p.employee_id
       JOIN hr_payroll_periods pr ON pr.id = p.period_id
       ${where}
       ORDER BY pr.start_date DESC`,
      params,
    );
    res.json({ items });
  } catch (err) {
    next(err);
  }
}

export async function sendPayslipEmail(req, res, next) {
  try {
    const { companyId } = req.scope;
    const { payslipId } = req.body;
    const rows = await query(
      `SELECT p.*, e.first_name, e.last_name, e.email, pr.period_name
       FROM hr_payslips p
       JOIN hr_employees e ON e.id = p.employee_id
       JOIN hr_payroll_periods pr ON pr.id = p.period_id
       WHERE p.id = :id AND e.company_id = :companyId`,
      { id: payslipId, companyId },
    );
    if (!rows.length) throw httpError(404, "NOT_FOUND", "Payslip not found");
    const p = rows[0];
    if (!p.email) throw httpError(400, "BAD_REQUEST", "Employee email not set");

    const html = `
      <div style="font-family: sans-serif; padding: 20px; border: 1px solid #ddd; max-width: 600px;">
        <h2 style="color: #1d4ed8; margin-top: 0;">Payslip for ${p.period_name}</h2>
        <p>Dear ${p.first_name} ${p.last_name},</p>
        <p>Your payslip for ${p.period_name} has been generated and is now available for your review.</p>
        <div style="background: #f8fafc; padding: 15px; border-radius: 4px; margin: 20px 0;">
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 8px 0; border-bottom: 1px solid #e2e8f0;"><strong>Basic Salary</strong></td>
              <td style="padding: 8px 0; border-bottom: 1px solid #e2e8f0; text-align: right;">${Number(p.basic_salary).toFixed(2)}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; border-bottom: 1px solid #e2e8f0;"><strong>Allowances</strong></td>
              <td style="padding: 8px 0; border-bottom: 1px solid #e2e8f0; text-align: right;">${Number(p.allowances).toFixed(2)}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; border-bottom: 1px solid #e2e8f0;"><strong>Deductions</strong></td>
              <td style="padding: 8px 0; border-bottom: 1px solid #e2e8f0; text-align: right;">${Number(p.deductions).toFixed(2)}</td>
            </tr>
            <tr style="font-size: 1.1em;">
              <td style="padding: 12px 0;"><strong>Net Salary</strong></td>
              <td style="padding: 12px 0; text-align: right; color: #15803d;"><strong>${Number(p.net_salary).toFixed(2)}</strong></td>
            </tr>
          </table>
        </div>
        <p>Regards,<br/>Human Resources Department</p>
      </div>
    `;

    await sendMail({
      to: p.email,
      subject: `Your Payslip for ${p.period_name}`,
      html,
    });

    res.json({ message: "Payslip sent to " + p.email });
  } catch (err) {
    next(err);
  }
}

/**
 * Medical Policy APIs
 */
export async function listMedicalPolicies(req, res, next) {
  try {
    await ensureHRTables();
    const { companyId } = req.scope;
    const items = await query(
      `SELECT * FROM hr_medical_policies WHERE company_id = :companyId AND is_active = 1 ORDER BY policy_name ASC`,
      { companyId },
    );
    res.json({ items });
  } catch (err) {
    next(err);
  }
}

export async function getMedicalPolicy(req, res, next) {
  try {
    const { companyId } = req.scope;
    const { id } = req.params;
    const rows = await query(
      `SELECT * FROM hr_medical_policies WHERE id = :id AND company_id = :companyId`,
      { id, companyId },
    );
    if (!rows.length)
      throw httpError(404, "NOT_FOUND", "Medical policy not found");
    res.json({ item: rows[0] });
  } catch (err) {
    next(err);
  }
}

export async function saveMedicalPolicy(req, res, next) {
  try {
    const { companyId, branchId } = req.scope;
    const userId = toNumber(req.user?.id || req.user?.sub, null);
    const {
      id,
      policy_code,
      policy_name,
      provider,
      description,
      coverage_details,
      premium_amount,
      renewal_date,
      is_active,
    } = req.body;

    const params = {
      policy_code,
      policy_name,
      provider,
      description,
      coverage_details,
      premium_amount: toNumber(premium_amount, 0),
      renewal_date: renewal_date || null,
      is_active: is_active ? 1 : 0,
      userId,
      companyId,
    };

    if (id) {
      await query(
        `UPDATE hr_medical_policies SET 
          policy_code = :policy_code, policy_name = :policy_name, provider = :provider,
          description = :description, coverage_details = :coverage_details,
          premium_amount = :premium_amount, renewal_date = :renewal_date,
          is_active = :is_active, updated_by = :userId
         WHERE id = :id AND company_id = :companyId`,
        { ...params, id },
      );
      res.json({ message: "Medical policy updated" });
    } else {
      const result = await query(
        `INSERT INTO hr_medical_policies (
          company_id, branch_id, policy_code, policy_name, provider, 
          description, coverage_details, premium_amount, renewal_date, 
          is_active, created_by
        ) VALUES (
          :companyId, :branchId, :policy_code, :policy_name, :provider,
          :description, :coverage_details, :premium_amount, :renewal_date,
          :is_active, :userId
        )`,
        { ...params, branchId },
      );
      res
        .status(201)
        .json({ id: result.insertId, message: "Medical policy created" });
    }
  } catch (err) {
    next(err);
  }
}

/**
 * Allowance APIs
 */
export async function listAllowances(req, res, next) {
  try {
    await ensureHRTables();
    const { companyId } = req.scope;
    const items = await query(
      `SELECT * FROM hr_allowances WHERE company_id = :companyId AND is_active = 1 ORDER BY allowance_name ASC`,
      { companyId },
    );
    res.json({ items });
  } catch (err) {
    next(err);
  }
}

export async function saveAllowance(req, res, next) {
  try {
    const { companyId, branchId } = req.scope;
    const userId = toNumber(req.user?.id || req.user?.sub, null);
    const { id, allowance_code, allowance_name, amount_type, amount, is_taxable, is_active } = req.body;

    const params = {
      allowance_code,
      allowance_name,
      amount_type,
      amount: toNumber(amount, 0),
      is_taxable: is_taxable ? 1 : 0,
      is_active: is_active ? 1 : 0,
      userId,
      companyId,
    };

    if (id) {
      await query(
        `UPDATE hr_allowances SET 
          allowance_code = :allowance_code, allowance_name = :allowance_name, 
          amount_type = :amount_type, amount = :amount, 
          is_taxable = :is_taxable, is_active = :is_active, updated_by = :userId
         WHERE id = :id AND company_id = :companyId`,
        { ...params, id },
      );
      res.json({ message: "Allowance updated" });
    } else {
      const result = await query(
        `INSERT INTO hr_allowances (company_id, branch_id, allowance_code, allowance_name, amount_type, amount, is_taxable, is_active, created_by)
         VALUES (:companyId, :branchId, :allowance_code, :allowance_name, :amount_type, :amount, :is_taxable, :is_active, :userId)`,
        { ...params, branchId },
      );
      res.status(201).json({ id: result.insertId, message: "Allowance created" });
    }
  } catch (err) {
    next(err);
  }
}

/**
 * Loan APIs
 */
export async function listLoans(req, res, next) {
  try {
    const { companyId } = req.scope;
    const { employee_id } = req.query;
    const clauses = ["l.company_id = :companyId"];
    const params = { companyId };

    if (employee_id) {
      clauses.push("l.employee_id = :employee_id");
      params.employee_id = employee_id;
    }

    const where = `WHERE ${clauses.join(" AND ")}`;
    const items = await query(
      `SELECT l.*, e.first_name, e.last_name 
       FROM hr_loans l
       JOIN hr_employees e ON e.id = l.employee_id
       ${where}
       ORDER BY l.created_at DESC`,
      params,
    );
    res.json({ items });
  } catch (err) {
    next(err);
  }
}

export async function saveLoan(req, res, next) {
  try {
    const { companyId, branchId } = req.scope;
    const userId = toNumber(req.user?.id || req.user?.sub, null);
    const { id, employee_id, loan_type, amount, interest_rate, repayment_period_months, monthly_installment, start_date, status } = req.body;

    const params = {
      employee_id,
      loan_type,
      amount: toNumber(amount, 0),
      interest_rate: toNumber(interest_rate, 0),
      repayment_period_months: toNumber(repayment_period_months, 0),
      monthly_installment: toNumber(monthly_installment, 0),
      start_date,
      status: status || 'PENDING',
      userId,
      companyId,
    };

    if (id) {
      await query(
        `UPDATE hr_loans SET 
          loan_type = :loan_type, amount = :amount, interest_rate = :interest_rate, 
          repayment_period_months = :repayment_period_months, monthly_installment = :monthly_installment, 
          start_date = :start_date, status = :status, updated_by = :userId
         WHERE id = :id AND company_id = :companyId`,
        { ...params, id },
      );
      res.json({ message: "Loan updated" });
    } else {
      const result = await query(
        `INSERT INTO hr_loans (company_id, branch_id, employee_id, loan_type, amount, interest_rate, repayment_period_months, monthly_installment, start_date, status, created_by)
         VALUES (:companyId, :branchId, :employee_id, :loan_type, :amount, :interest_rate, :repayment_period_months, :monthly_installment, :start_date, :status, :userId)`,
        { ...params, branchId },
      );
      res.status(201).json({ id: result.insertId, message: "Loan created" });
    }
  } catch (err) {
    next(err);
  }
}

/**
 * Tax Config APIs
 */
export async function listTaxConfigs(req, res, next) {
  try {
    const { companyId } = req.scope;
    const items = await query(
      `SELECT * FROM hr_tax_config WHERE company_id = :companyId AND is_active = 1 ORDER BY tax_name ASC, min_amount ASC`,
      { companyId },
    );
    res.json({ items });
  } catch (err) {
    next(err);
  }
}

export async function saveTaxConfig(req, res, next) {
  try {
    const { companyId } = req.scope;
    const { id, tax_name, tax_type, min_amount, max_amount, tax_rate, fixed_amount, is_active } = req.body;

    const params = {
      tax_name,
      tax_type,
      min_amount: toNumber(min_amount, 0),
      max_amount: toNumber(max_amount, null),
      tax_rate: toNumber(tax_rate, 0),
      fixed_amount: toNumber(fixed_amount, 0),
      is_active: is_active ? 1 : 0,
      companyId,
    };

    if (id) {
      await query(
        `UPDATE hr_tax_config SET 
          tax_name = :tax_name, tax_type = :tax_type, min_amount = :min_amount, 
          max_amount = :max_amount, tax_rate = :tax_rate, fixed_amount = :fixed_amount, is_active = :is_active
         WHERE id = :id AND company_id = :companyId`,
        { ...params, id },
      );
      res.json({ message: "Tax config updated" });
    } else {
      const result = await query(
        `INSERT INTO hr_tax_config (company_id, tax_name, tax_type, min_amount, max_amount, tax_rate, fixed_amount, is_active)
         VALUES (:companyId, :tax_name, :tax_type, :min_amount, :max_amount, :tax_rate, :fixed_amount, :is_active)`,
        params,
      );
      res.status(201).json({ id: result.insertId, message: "Tax config created" });
    }
  } catch (err) {
    next(err);
  }
}

/**
 * Salary Structure APIs
 */
export async function listSalaryStructures(req, res, next) {
  try {
    const { companyId } = req.scope;
    const items = await query(
      `SELECT * FROM hr_salary_structures WHERE company_id = :companyId AND is_active = 1 ORDER BY name ASC`,
      { companyId },
    );
    res.json({ items });
  } catch (err) {
    next(err);
  }
}

export async function saveSalaryStructure(req, res, next) {
  try {
    const { companyId } = req.scope;
    const { id, name, description, is_active } = req.body;

    const params = {
      name,
      description,
      is_active: is_active ? 1 : 0,
      companyId,
    };

    if (id) {
      await query(
        `UPDATE hr_salary_structures SET name = :name, description = :description, is_active = :is_active
         WHERE id = :id AND company_id = :companyId`,
        { ...params, id },
      );
      res.json({ message: "Salary structure updated" });
    } else {
      const result = await query(
        `INSERT INTO hr_salary_structures (company_id, name, description, is_active)
         VALUES (:companyId, :name, :description, :is_active)`,
        params,
      );
      res.status(201).json({ id: result.insertId, message: "Salary structure created" });
    }
  } catch (err) {
    next(err);
  }
}

export async function closePayroll(req, res, next) {
  try {
    const { companyId } = req.scope;
    const {
      payroll_id,
      finance_post,
      expense_account_id,
      payable_account_id,
      narration,
    } = req.body;
    const [hdr] = await query(
      `SELECT * FROM hr_payroll WHERE id = :id AND company_id = :companyId`,
      { id: payroll_id, companyId },
    );
    if (!hdr) throw httpError(404, "NOT_FOUND", "Payroll not found");
    await query(
      `UPDATE hr_payroll SET status = 'CLOSED', closed_at = NOW() WHERE id = :id`,
      { id: payroll_id },
    );
    await query(
      `UPDATE hr_payslips ps 
       JOIN hr_payroll_items pi ON pi.employee_id = ps.employee_id AND pi.payroll_id = :payroll_id
       SET ps.status = 'PAID', ps.paid_at = NOW() 
       WHERE ps.period_id = :period_id`,
      { payroll_id, period_id: hdr.period_id },
    );
    try {
      const { notifyWorkflowForward } =
        await import("../services/notifications/workflowNotify.js");
      await notifyWorkflowForward({
        companyId,
        userId: req.user?.id || req.user?.sub || 1,
        workflowInstanceId: null,
        documentId: hdr.id,
        documentType: "Payroll",
        title: "Payroll Closed",
        message: `Payroll for period #${hdr.period_id} has been closed.`,
        action: "INFO",
        senderName: req.user?.name || req.user?.username || "System",
      });
    } catch {}
    if (finance_post && expense_account_id && payable_account_id) {
      const totals = await query(
        `SELECT 
           COALESCE(SUM(basic_salary + allowances),0) AS gross, 
           COALESCE(SUM(deductions),0) AS deductions, 
           COALESCE(SUM(net_salary),0) AS net
         FROM hr_payroll_items WHERE payroll_id = :pid`,
        { pid: payroll_id },
      );
      const gross = Number(totals?.[0]?.gross || 0);
      const deductions = Number(totals?.[0]?.deductions || 0);
      const net = Number(totals?.[0]?.net || 0);
      const fyRows = await query(
        `SELECT id FROM fin_fiscal_years WHERE company_id = :companyId AND status = 'OPEN' ORDER BY start_date DESC LIMIT 1`,
        { companyId },
      );
      const fiscalYearId = fyRows.length ? fyRows[0].id : null;
      const vtRows = await query(
        `SELECT id FROM fin_voucher_types WHERE code = 'JV' LIMIT 1`,
        {},
      );
      const voucherTypeId = vtRows.length ? vtRows[0].id : null;
      const voucherNo = `PR${Date.now()}`;
      const voucherDate = new Date().toISOString().slice(0, 10);
      const createdBy = req.user?.id || req.user?.sub || null;
      const [vIns] = await query(
        `INSERT INTO fin_vouchers
          (company_id, branch_id, fiscal_year_id, voucher_type_id, voucher_no, voucher_date, narration, currency_id, exchange_rate, total_debit, total_credit, status, created_by, approved_by, posted_by)
         VALUES
          (:companyId, :branchId, :fiscalYearId, :voucherTypeId, :voucherNo, :voucherDate, :narration, NULL, 1, :totalDebit, :totalCredit, 'POSTED', :createdBy, :approvedBy, :postedBy)`,
        {
          companyId,
          branchId: req.scope.branchId,
          fiscalYearId: fiscalYearId,
          voucherTypeId,
          voucherNo,
          voucherDate,
          narration:
            narration || `Payroll posting for period #${hdr.period_id}`,
          totalDebit: gross,
          totalCredit: gross,
          createdBy,
          approvedBy: createdBy,
          postedBy: createdBy,
        },
      );
      const voucherId = Number(vIns.insertId || 0);
      let lineNo = 1;
      await query(
        `INSERT INTO fin_voucher_lines
           (company_id, voucher_id, line_no, account_id, description, debit, credit, tax_code_id, cost_center, reference_no)
         VALUES
           (:companyId, :voucherId, :lineNo, :accountId, :description, :debit, :credit, NULL, NULL, NULL)`,
        {
          companyId,
          voucherId,
          lineNo: lineNo++,
          accountId: expense_account_id,
          description: "Payroll expenses",
          debit: gross,
          credit: 0,
        },
      );
      await query(
        `INSERT INTO fin_voucher_lines
           (company_id, voucher_id, line_no, account_id, description, debit, credit, tax_code_id, cost_center, reference_no)
         VALUES
           (:companyId, :voucherId, :lineNo, :accountId, :description, :debit, :credit, NULL, NULL, NULL)`,
        {
          companyId,
          voucherId,
          lineNo: lineNo++,
          accountId: payable_account_id,
          description: "Salaries payable",
          debit: 0,
          credit: gross,
        },
      );
    }
    res.json({ message: "Payroll closed" });
  } catch (err) {
    next(err);
  }
}
/**
/**
 * Onboarding - Assign Checklist to Employee
 */
export async function assignOnboardingChecklist(req, res, next) {
  try {
    const { companyId } = req.scope;
    const userId = req.user?.id || req.user?.sub;
    const { employee_id, checklist_id, assigned_date } = req.body;
    if (!employee_id || !checklist_id)
      throw httpError(
        400,
        "BAD_REQUEST",
        "employee_id and checklist_id required",
      );

    const result = await query(
      `INSERT INTO hr_onboarding_assignments (company_id, employee_id, checklist_id, assigned_date, status, created_by)
       VALUES (:companyId, :employee_id, :checklist_id, :assigned_date, 'PENDING', :userId)`,
      {
        companyId,
        employee_id,
        checklist_id,
        assigned_date: assigned_date || new Date().toISOString().slice(0, 10),
        userId,
      },
    );

    const tasks = await query(
      `SELECT * FROM hr_onboarding_tasks WHERE checklist_id = :checklist_id ORDER BY task_order ASC`,
      { checklist_id },
    ).catch(() => []);
    for (const t of tasks) {
      // eslint-disable-next-line no-await-in-loop
      await query(
        `INSERT INTO hr_onboarding_assignment_tasks (assignment_id, task_order, title, description, completed)
         VALUES (:assignment_id, :task_order, :title, :description, 0)`,
        {
          assignment_id: result.insertId,
          task_order: t.task_order,
          title: t.title,
          description: t.description || null,
        },
      );
    }

    res
      .status(201)
      .json({ id: result.insertId, message: "Onboarding assigned" });
  } catch (err) {
    next(err);
  }
}

export async function updateOnboardingTask(req, res, next) {
  try {
    const { assignment_id, task_id, completed } = req.body;
    if (!assignment_id || !task_id)
      throw httpError(400, "BAD_REQUEST", "assignment_id and task_id required");

    await query(
      `UPDATE hr_onboarding_assignment_tasks 
       SET completed = :completed, completed_at = CASE WHEN :completed = 1 THEN NOW() ELSE NULL END 
       WHERE id = :task_id AND assignment_id = :assignment_id`,
      { completed: completed ? 1 : 0, task_id, assignment_id },
    );

    const pendingCountRows = await query(
      `SELECT COUNT(*) AS c FROM hr_onboarding_assignment_tasks WHERE assignment_id = :assignment_id AND completed = 0`,
      { assignment_id },
    );
    const remaining = Number(pendingCountRows?.[0]?.c || 0);
    await query(
      `UPDATE hr_onboarding_assignments 
       SET status = CASE WHEN :remaining = 0 THEN 'COMPLETED' ELSE 'IN_PROGRESS' END
       WHERE id = :assignment_id`,
      { remaining, assignment_id },
    );
    res.json({ message: "Task updated" });
  } catch (err) {
    next(err);
  }
}

export async function listOnboardingAssignments(req, res, next) {
  try {
    const { employee_id } = req.query;
    const clauses = [];
    const params = {};
    if (employee_id) {
      clauses.push("a.employee_id = :employee_id");
      params.employee_id = employee_id;
    }
    const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
    const items = await query(
      `SELECT a.*, e.first_name, e.last_name, c.name AS checklist_name
       FROM hr_onboarding_assignments a
       LEFT JOIN hr_employees e ON e.id = a.employee_id
       LEFT JOIN hr_onboarding_checklists c ON c.id = a.checklist_id
       ${where}
       ORDER BY a.created_at DESC`,
      params,
    );
    res.json({ items });
  } catch (err) {
    next(err);
  }
}
