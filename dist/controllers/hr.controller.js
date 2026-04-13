import { query, pool } from "../db/pool.js";
import { httpError } from "../utils/httpError.js";
import {
  ensureWorkflowTables,
  toNumber,
  ensureHRTables,
  hasColumn,
  ensureCol,
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
              e.employment_type, e.employment_type_id, e.category_id, e.location_id, e.status, e.base_salary, e.joining_date,
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
    const depts = [
      "IT",
      "Finance",
      "HR",
      "Admin",
      "Library",
      "Department Head",
    ];
    for (const dept of depts) {
      await query(
        `INSERT INTO hr_clearance (exit_id, department, cleared) VALUES (:exitId, :dept, 0)`,
        { exitId, dept },
      );
    }

    res.status(201).json({
      id: exitId,
      message: "Exit submitted and clearance initialized",
    });
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

    const item = rows[0];
    try {
      if (typeof item.tax_mappings === "string") {
        item.tax_mappings = JSON.parse(item.tax_mappings);
      }
      if (typeof item.allowance_mappings === "string") {
        item.allowance_mappings = JSON.parse(item.allowance_mappings);
      }
    } catch {}

    const documents = await query(
      `SELECT * FROM hr_employee_documents WHERE employee_id = :id`,
      { id },
    );

    res.json({ item, documents });
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
      await conn.query(
        `UPDATE hr_employees SET 
          emp_code = ?, first_name = ?, last_name = ?, middle_name = ?,
          gender = ?, dob = ?, joining_date = ?, email = ?, phone = ?, 
          dept_id = ?, pos_id = ?, manager_id = ?, location_id = ?,
          employment_type = ?, employment_type_id = ?, category_id = ?, status = ?, base_salary = ?, address = ?, 
          picture_url = ?, national_id = ?, city = ?, state = ?, country = ?, emergency_contact_name = ?, emergency_contact_phone = ?, bank_name = ?, bank_account_number = ?, ssnit_number = ?,
          tax_mappings = ?, allowance_mappings = ?,
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
          body.location_id || null,
          body.employment_type || "FULL_TIME",
          body.employment_type_id || null,
          body.category_id || null,
          body.status || "PROBATION",
          body.base_salary || 0,
          body.address || null,
          body.picture_url || null,
          body.national_id || null,
          body.city || null,
          body.state || null,
          body.country || null,
          body.emergency_contact_name || null,
          body.emergency_contact_phone || null,
          body.bank_name || null,
          body.bank_account_number || null,
          body.ssnit_number || null,
          JSON.stringify(
            Array.isArray(body.tax_mappings) ? body.tax_mappings : [],
          ),
          JSON.stringify(
            Array.isArray(body.allowance_mappings)
              ? body.allowance_mappings
              : [],
          ),
          userId,
          body.id,
          companyId,
        ],
      );
      // Handle mapping tables
      try {
        await conn.query(
          `DELETE FROM hr_employee_tax_mappings WHERE employee_id = ?`,
          [body.id],
        );
        const taxIds = Array.isArray(body.tax_mappings)
          ? body.tax_mappings
          : [];
        for (const tid of taxIds) {
          await conn.query(
            `INSERT IGNORE INTO hr_employee_tax_mappings (employee_id, tax_config_id) VALUES (?, ?)`,
            [body.id, tid],
          );
        }
        await conn.query(
          `DELETE FROM hr_employee_allowance_mappings WHERE employee_id = ?`,
          [body.id],
        );
        const allowIds = Array.isArray(body.allowance_mappings)
          ? body.allowance_mappings
          : [];
        for (const aid of allowIds) {
          await conn.query(
            `INSERT IGNORE INTO hr_employee_allowance_mappings (employee_id, allowance_id) VALUES (?, ?)`,
            [body.id, aid],
          );
        }
      } catch (err) {
        console.error("Mapping error: ", err);
      }
      await conn.commit();
      res.json({ message: "Employee updated successfully" });
    } else {
      const [result] = await conn.query(
        `INSERT INTO hr_employees (
          company_id, branch_id, emp_code, first_name, last_name, middle_name,
          gender, dob, joining_date, email, phone, dept_id, pos_id, manager_id, location_id,
          employment_type, employment_type_id, category_id, status, base_salary, address, picture_url, national_id, city, state, country, emergency_contact_name, emergency_contact_phone, bank_name, bank_account_number, ssnit_number, tax_mappings, allowance_mappings, created_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
          body.location_id || null,
          body.employment_type || "FULL_TIME",
          body.employment_type_id || null,
          body.category_id || null,
          body.status || "PROBATION",
          body.base_salary || 0,
          body.address || null,
          body.picture_url || null,
          body.national_id || null,
          body.city || null,
          body.state || null,
          body.country || null,
          body.emergency_contact_name || null,
          body.emergency_contact_phone || null,
          body.bank_name || null,
          body.bank_account_number || null,
          body.ssnit_number || null,
          JSON.stringify(
            Array.isArray(body.tax_mappings) ? body.tax_mappings : [],
          ),
          JSON.stringify(
            Array.isArray(body.allowance_mappings)
              ? body.allowance_mappings
              : [],
          ),
          userId,
        ],
      );
      // Handle mapping tables
      try {
        const newId = result.insertId;
        const taxIds = Array.isArray(body.tax_mappings)
          ? body.tax_mappings
          : [];
        for (const tid of taxIds) {
          await conn.query(
            `INSERT IGNORE INTO hr_employee_tax_mappings (employee_id, tax_config_id) VALUES (?, ?)`,
            [newId, tid],
          );
        }
        const allowIds = Array.isArray(body.allowance_mappings)
          ? body.allowance_mappings
          : [];
        for (const aid of allowIds) {
          await conn.query(
            `INSERT IGNORE INTO hr_employee_allowance_mappings (employee_id, allowance_id) VALUES (?, ?)`,
            [newId, aid],
          );
        }
      } catch (err) {
        console.error("Mapping error on insert: ", err);
      }
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

export async function saveEmployeesBulk(req, res, next) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const { companyId, branchId } = req.scope;
    const userId = req.user?.id || req.user?.sub;
    const items = Array.isArray(req.body?.items) ? req.body.items : [];
    let created = 0;
    let updated = 0;
    for (const b of items) {
      const [rows] = await conn.query(
        `SELECT id FROM hr_employees WHERE company_id = ? AND emp_code = ? LIMIT 1`,
        [companyId, b.emp_code],
      );
      if (rows && rows.length) {
        const id = rows[0].id;
        await conn.query(
          `UPDATE hr_employees SET 
            first_name = ?, last_name = ?, middle_name = ?, gender = ?, dob = ?, joining_date = ?, email = ?, phone = ?,
            dept_id = ?, pos_id = ?, manager_id = ?, location_id = ?,
            employment_type = COALESCE(?, employment_type), employment_type_id = ?, category_id = ?, status = ?, base_salary = ?, address = ?, 
            picture_url = ?, national_id = ?, tax_mappings = ?, allowance_mappings = ?, updated_by = ?
           WHERE id = ? AND company_id = ?`,
          [
            b.first_name,
            b.last_name,
            b.middle_name || null,
            b.gender || null,
            b.dob || null,
            b.joining_date,
            b.email || null,
            b.phone || null,
            b.dept_id || null,
            b.pos_id || null,
            b.manager_id || null,
            b.location_id || null,
            b.employment_type || null,
            b.employment_type_id || null,
            b.category_id || null,
            b.status || "PROBATION",
            b.base_salary || 0,
            b.address || null,
            b.picture_url || null,
            b.national_id || null,
            JSON.stringify(Array.isArray(b.tax_mappings) ? b.tax_mappings : []),
            JSON.stringify(
              Array.isArray(b.allowance_mappings) ? b.allowance_mappings : [],
            ),
            userId,
            id,
            companyId,
          ],
        );
        // mappings
        await conn.query(
          `DELETE FROM hr_employee_tax_mappings WHERE employee_id = ?`,
          [id],
        );
        for (const taxId of b.tax_mappings || []) {
          // eslint-disable-next-line no-await-in-loop
          await conn.query(
            `INSERT IGNORE INTO hr_employee_tax_mappings (employee_id, tax_config_id) VALUES (?, ?)`,
            [id, taxId],
          );
        }
        await conn.query(
          `DELETE FROM hr_employee_allowance_mappings WHERE employee_id = ?`,
          [id],
        );
        for (const aId of b.allowance_mappings || []) {
          // eslint-disable-next-line no-await-in-loop
          await conn.query(
            `INSERT IGNORE INTO hr_employee_allowance_mappings (employee_id, allowance_id) VALUES (?, ?)`,
            [id, aId],
          );
        }
        updated++;
      } else {
        const [result] = await conn.query(
          `INSERT INTO hr_employees (
            company_id, branch_id, emp_code, first_name, last_name, middle_name, gender, dob, joining_date, email, phone,
            dept_id, pos_id, manager_id, location_id, employment_type, employment_type_id, category_id, status, base_salary, address, picture_url, national_id, tax_mappings, allowance_mappings, created_by
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            companyId,
            branchId,
            b.emp_code,
            b.first_name,
            b.last_name,
            b.middle_name || null,
            b.gender || null,
            b.dob || null,
            b.joining_date,
            b.email || null,
            b.phone || null,
            b.dept_id || null,
            b.pos_id || null,
            b.manager_id || null,
            b.location_id || null,
            b.employment_type || null,
            b.employment_type_id || null,
            b.category_id || null,
            b.status || "PROBATION",
            b.base_salary || 0,
            b.address || null,
            b.picture_url || null,
            b.national_id || null,
            JSON.stringify(Array.isArray(b.tax_mappings) ? b.tax_mappings : []),
            JSON.stringify(
              Array.isArray(b.allowance_mappings) ? b.allowance_mappings : [],
            ),
            userId,
          ],
        );
        const newId = result.insertId;
        for (const taxId of b.tax_mappings || []) {
          // eslint-disable-next-line no-await-in-loop
          await conn.query(
            `INSERT IGNORE INTO hr_employee_tax_mappings (employee_id, tax_config_id) VALUES (?, ?)`,
            [newId, taxId],
          );
        }
        for (const aId of b.allowance_mappings || []) {
          // eslint-disable-next-line no-await-in-loop
          await conn.query(
            `INSERT IGNORE INTO hr_employee_allowance_mappings (employee_id, allowance_id) VALUES (?, ?)`,
            [newId, aId],
          );
        }
        created++;
      }
    }
    await conn.commit();
    res.json({ message: "Bulk employees processed", created, updated });
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
      res
        .status(201)
        .json({ id: result.insertId, message: "Candidate created" });
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

/**
 * Register (upsert) a salary component into hr_salary_components.
 * Safe to call multiple times — uses INSERT … ON DUPLICATE KEY UPDATE.
 */
async function registerSalaryComponent(
  companyId,
  {
    column_name,
    label,
    component_type = "OTHER",
    display_order = 0,
    is_earning = 0,
    is_fixed = 0,
    source_type = "NONE",
    source_id = null,
  },
) {
  try {
    await query(
      `INSERT INTO hr_salary_components
         (company_id, column_name, label, component_type, display_order, is_earning, is_fixed, source_type, source_id)
       VALUES
         (:companyId, :column_name, :label, :component_type, :display_order, :is_earning, :is_fixed, :source_type, :source_id)
       ON DUPLICATE KEY UPDATE
         label        = VALUES(label),
         component_type = VALUES(component_type),
         display_order  = VALUES(display_order),
         is_earning     = VALUES(is_earning),
         is_fixed       = VALUES(is_fixed),
         source_type    = VALUES(source_type),
         source_id      = VALUES(source_id),
         updated_at     = CURRENT_TIMESTAMP`,
      {
        companyId,
        column_name,
        label,
        component_type,
        display_order,
        is_earning,
        is_fixed,
        source_type,
        source_id,
      },
    );
  } catch {
    // non-fatal
  }
}

/**
 * Ensure the fixed / always-present salary component rows exist for a company.
 */
async function seedFixedSalaryComponents(companyId) {
  const fixed = [
    {
      column_name: "basic_salary",
      label: "Basic Salary",
      component_type: "BASIC",
      display_order: 10,
      is_earning: 1,
    },
    {
      column_name: "allowances",
      label: "Allowances (Total)",
      component_type: "ALLOWANCE",
      display_order: 20,
      is_earning: 1,
    },
    {
      column_name: "subtotal_a",
      label: "Subtotal A (Basic – SSF)",
      component_type: "SUBTOTAL",
      display_order: 30,
      is_earning: 0,
    },
    {
      column_name: "subtotal_b",
      label: "Subtotal B (A + Allowances)",
      component_type: "SUBTOTAL",
      display_order: 40,
      is_earning: 0,
    },
    {
      column_name: "ssf_employee",
      label: "Social Security (Employee)",
      component_type: "SOCIAL_SECURITY",
      display_order: 50,
      is_earning: 0,
    },
    {
      column_name: "tier3_employee",
      label: "Tier 3 Provident (Employee)",
      component_type: "PROVIDENT_FUND",
      display_order: 60,
      is_earning: 0,
    },
    {
      column_name: "income_tax",
      label: "PAYE Income Tax",
      component_type: "INCOME_TAX",
      display_order: 70,
      is_earning: 0,
    },
    {
      column_name: "deductions",
      label: "Total Deductions",
      component_type: "DEDUCTION",
      display_order: 80,
      is_earning: 0,
    },
    {
      column_name: "net_salary",
      label: "Net Salary",
      component_type: "NET_SALARY",
      display_order: 99,
      is_earning: 1,
    },
  ];
  for (const row of fixed) {
    await registerSalaryComponent(companyId, {
      ...row,
      is_fixed: 1,
      source_type: "NONE",
      source_id: null,
    });
  }
}

export async function generatePayroll(req, res, next) {
  try {
    await ensureHRTables();
    const { companyId } = req.scope;
    const { period_id } = req.body;
    if (!period_id) throw httpError(400, "BAD_REQUEST", "period_id required");
    const [period] = await query(
      `SELECT * FROM hr_payroll_periods WHERE id = :id AND company_id = :companyId`,
      { id: period_id, companyId },
    );
    if (!period) throw httpError(404, "NOT_FOUND", "Payroll period not found");

    // Seed / refresh fixed salary component registry for this company
    await seedFixedSalaryComponents(companyId);

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

    const taxConfigs = await query(
      `SELECT id, tax_name, tax_type, min_amount, max_amount, tax_rate, fixed_amount, employee_contribution_rate, employer_contribution_rate, taxable_components
       FROM hr_tax_config
       WHERE company_id = :companyId AND is_active = 1
       ORDER BY min_amount ASC`,
      { companyId },
    );
    const structRows = await query(
      `SELECT components FROM hr_salary_structures WHERE company_id = :companyId AND is_active = 1 ORDER BY id DESC LIMIT 1`,
      { companyId },
    );
    let structComps = {};
    try {
      structComps = JSON.parse(structRows?.[0]?.components || "{}");
    } catch {
      structComps = {};
    }
    const formula = Array.isArray(structComps?.formula)
      ? structComps.formula
      : [];
    const activeTokens = new Set(formula.map((f) => String(f.token || "")));

    const employees = await query(
      `SELECT id, base_salary, has_paye, has_ssnit, has_tier3 FROM hr_employees WHERE company_id = :companyId AND status = 'ACTIVE' AND deleted_at IS NULL`,
      { companyId },
    );

    await ensureCol(
      "hr_payroll_items",
      "tier3_employee",
      "DECIMAL(18,4) NOT NULL DEFAULT 0",
    );
    await ensureCol(
      "hr_payslips",
      "tier3_employee",
      "DECIMAL(18,4) NOT NULL DEFAULT 0",
    );
    await ensureCol(
      "hr_payroll_items",
      "ssf_employee",
      "DECIMAL(18,4) NOT NULL DEFAULT 0",
    );
    await ensureCol(
      "hr_payslips",
      "ssf_employee",
      "DECIMAL(18,4) NOT NULL DEFAULT 0",
    );
    await ensureCol(
      "hr_payroll_items",
      "subtotal_a",
      "DECIMAL(18,4) NOT NULL DEFAULT 0",
    );
    await ensureCol(
      "hr_payroll_items",
      "subtotal_b",
      "DECIMAL(18,4) NOT NULL DEFAULT 0",
    );
    await ensureCol("hr_payroll_items", "paye_bracket_id", "BIGINT NULL");
    await ensureCol("hr_payroll_items", "paye_rate", "DECIMAL(9,4) NULL");
    await ensureCol(
      "hr_payslips",
      "subtotal_a",
      "DECIMAL(18,4) NOT NULL DEFAULT 0",
    );
    await ensureCol(
      "hr_payslips",
      "subtotal_b",
      "DECIMAL(18,4) NOT NULL DEFAULT 0",
    );
    await ensureCol("hr_payslips", "paye_bracket_id", "BIGINT NULL");
    await ensureCol("hr_payslips", "paye_rate", "DECIMAL(9,4) NULL");
    await ensureCol(
      "hr_payslips",
      "income_tax",
      "DECIMAL(18,4) NOT NULL DEFAULT 0",
    );
    try {
      await query(
        `ALTER TABLE hr_loans MODIFY COLUMN status VARCHAR(50) NOT NULL DEFAULT 'PENDING'`,
        {},
      ).catch(() => {});
      await query(
        `CREATE TABLE IF NOT EXISTS hr_loan_repayments (
          id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
          company_id BIGINT UNSIGNED NOT NULL,
          employee_id BIGINT UNSIGNED NOT NULL,
          loan_id BIGINT UNSIGNED NOT NULL,
          amount_paid DECIMAL(18,4) NOT NULL,
          payment_date DATE NOT NULL,
          payroll_id BIGINT UNSIGNED NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          PRIMARY KEY (id),
          KEY idx_loan (loan_id),
          KEY idx_employee (employee_id),
          KEY idx_payroll (payroll_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
        {},
      ).catch(() => {});
    } catch {}

    for (const e of employees) {
      console.log(`Processing employee ${e.id}...`);
      const overrides = await query(
        `SELECT * FROM hr_employee_salaries WHERE employee_id = :eid AND status = 'ACTIVE' ORDER BY effective_from DESC LIMIT 1`,
        { eid: e.id },
      ).catch(() => []);
      const basic = overrides.length
        ? overrides[0].basic_salary
        : e.base_salary;
      let allowances = overrides.length
        ? Number(overrides[0].allowances || 0)
        : 0;
      const alRows = await query(
        `SELECT a.id, a.amount, a.allowance_name
         FROM hr_employee_allowance_mappings m 
         JOIN hr_allowances a ON a.id = m.allowance_id 
         WHERE m.employee_id = :eid AND a.is_active = 1`,
        { eid: e.id },
      ).catch(() => []);

      const allowanceMap = {};
      let filteredAllowancesTotal = 0;
      for (const r of alRows) {
        const aid = String(r.id);
        if (
          !activeTokens.has(`ALLOWANCE:${aid}`) &&
          !activeTokens.has("ALLOWANCES")
        ) {
          continue;
        }
        const amt = Number(r.amount || 0);
        allowanceMap[`ALLOWANCE:${aid}`] = amt;
        filteredAllowancesTotal += amt;
      }
      if (alRows.length) {
        allowances = filteredAllowancesTotal;
      }
      let incomeTax = 0;
      let ssfEmployee = 0;
      let tier3Employee = 0;
      const taxBreakdown = {};

      // ── STEP 1: Compute GROSS = basic + allowances ──
      const gross = Number(basic) + Number(allowances);

      // ── STEP 2: SSF on gross (basic + allowances) ──
      for (const cfg of taxConfigs) {
        const ttype = String(cfg.tax_type || "");
        const tname = String(cfg.tax_name || "").toUpperCase();
        if (
          (ttype === "SOCIAL_SECURITY" ||
            tname.includes("SSF") ||
            tname.includes("SSNIT")) &&
          (activeTokens.has("SSF") || activeTokens.has(`SSF:${cfg.id}`))
        ) {
          const rateEmp = Number(cfg.employee_contribution_rate || 0) / 100;
          if (rateEmp > 0) {
            const amount = gross * rateEmp;
            ssfEmployee += amount;
            taxBreakdown[`SSF:${cfg.id}`] =
              (taxBreakdown[`SSF:${cfg.id}`] || 0) + amount;
          }
        }
      }

      // ── STEP 3: Tier 3 on gross ──
      for (const cfg of taxConfigs) {
        const ttype = String(cfg.tax_type || "");
        const tname = String(cfg.tax_name || "").toUpperCase();
        if (
          (ttype === "PROVIDENT_FUND" ||
            tname.includes("TIER 3") ||
            tname.includes("TIER-3")) &&
          activeTokens.has(`TIER3:${cfg.id}`)
        ) {
          const rateEmp = Number(cfg.employee_contribution_rate || 0) / 100;
          if (e.has_tier3 && rateEmp > 0) {
            const amount = gross * rateEmp;
            tier3Employee += amount;
            taxBreakdown[`TIER3:${cfg.id}`] =
              (taxBreakdown[`TIER3:${cfg.id}`] || 0) + amount;
          }
        }
      }

      // ── STEP 4: Subtotal A = Gross - SSF - Tier3 ──
      const subtotalA = gross - ssfEmployee - tier3Employee;

      // ── STEP 5: PAYE (Graduated Bands) applied on Subtotal A ──
      // Aggregate income tax bracket names
      try {
        const byName = {};
        for (const cfg of taxConfigs) {
          if (String(cfg.tax_type || "") === "INCOME_TAX") {
            const nm = String(cfg.tax_name || "").toUpperCase();
            byName[nm] = byName[nm] || 0;
          }
        }
        for (const nm in byName) {
          taxBreakdown[`INCOME_TAX_BRACKET:${nm}`] = 0;
        }
      } catch {}

      let payeBracketId = null;
      let payeRate = 0;
      const hasAnyIncomeTaxToken = Array.from(activeTokens).some((t) =>
        t.startsWith("INCOME_TAX_BRACKET:"),
      );

      // Sort income tax configs by min_amount to get bands in order
      const payeBands = taxConfigs
        .filter(
          (cfg) =>
            String(cfg.tax_type || "") === "INCOME_TAX" &&
            (activeTokens.has(`INCOME_TAX_BRACKET:${cfg.tax_name}`) ||
              hasAnyIncomeTaxToken),
        )
        .sort((a, b) => Number(a.min_amount || 0) - Number(b.min_amount || 0));

      if (e.has_paye && payeBands.length > 0) {
        let remaining = subtotalA; // taxable income = gross after SSF/Tier3
        for (const cfg of payeBands) {
          if (remaining <= 0) break;
          const bandMin = Number(cfg.min_amount || 0);
          const bandMax =
            cfg.max_amount === null || cfg.max_amount === ""
              ? null
              : Number(cfg.max_amount);
          const bandWidth = bandMax === null ? remaining : bandMax - bandMin;
          const taxableInBand = Math.min(remaining, bandWidth);
          const rate = Number(cfg.tax_rate || 0);
          const bandTax = taxableInBand * (rate / 100);
          incomeTax += bandTax;
          taxBreakdown[`INCOME_TAX:${cfg.id}`] =
            (taxBreakdown[`INCOME_TAX:${cfg.id}`] || 0) + bandTax;
          if (taxableInBand > 0) {
            payeBracketId = cfg.id;
            payeRate = rate;
          }
          remaining -= taxableInBand;
        }
      }

      // Update bracket totals
      try {
        const byName = {};
        for (const cfg of taxConfigs) {
          if (String(cfg.tax_type || "") === "INCOME_TAX") {
            const nm = String(cfg.tax_name || "").toUpperCase();
            const k = `INCOME_TAX:${cfg.id}`;
            const amt = Number(taxBreakdown[k] || 0);
            byName[nm] = (byName[nm] || 0) + amt;
          }
        }
        for (const nm in byName) {
          taxBreakdown[`INCOME_TAX_BRACKET:${nm}`] = byName[nm];
        }
      } catch {}

      // ── STEP 6: Subtotal B = Subtotal A - PAYE ──
      const subtotalB = subtotalA - incomeTax;

      const otherDeductions = overrides.length
        ? Number(overrides[0].deductions || 0)
        : 0;

      // ── STEP 7: Loan Deductions ──
      let totalLoanDeductions = 0;
      const activeLoans = await query(
        `SELECT id, loan_type, monthly_installment, amount_due, status
         FROM hr_loans 
         WHERE employee_id = :eid 
           AND company_id = :companyId
           AND status = 'ACTIVE'
           AND status <> 'COMPLETED'
           AND amount_due > 0 
           AND affect_payslip = 1 
           AND start_date <= CURDATE()`,
        { eid: e.id, companyId },
      );
      const loanCols = {};

      for (const loan of activeLoans) {
        const lid = String(loan.id);
        if (!activeTokens.has(`LOAN:${lid}`) && !activeTokens.has("LOANS")) {
          continue;
        }
        if (String(loan.status || "").toUpperCase() === "COMPLETED") {
          continue;
        }
        try {
          const deduction = Math.min(
            Number(loan.monthly_installment || 0),
            Number(loan.amount_due || 0),
          );
          if (deduction > 0) {
            totalLoanDeductions += deduction;
            const loanCol = `loan_${loan.id}`;
            loanCols[loanCol] = deduction;
            await registerSalaryComponent(companyId, {
              column_name: loanCol,
              label: loan.loan_type
                ? `Loan – ${loan.loan_type}`
                : `Loan ${loan.id}`,
              component_type: "DEDUCTION",
              display_order: 76,
              is_earning: 0,
              is_fixed: 0,
              source_type: "NONE",
              source_id: Number(loan.id) || null,
            });

            // 1. Insert Repayment Record
            await query(
              `INSERT INTO hr_loan_repayments (company_id, employee_id, loan_id, amount_paid, payment_date, payroll_id)
               VALUES (:companyId, :employee_id, :loan_id, :amount_paid, CURDATE(), :payroll_id)`,
              {
                companyId,
                employee_id: e.id,
                loan_id: loan.id,
                amount_paid: deduction,
                payroll_id: payrollId,
              },
            );

            // 2. Update Loan Balance and Status
            const newAmountDue = Math.max(
              0,
              Number(loan.amount_due) - deduction,
            );
            const isDone = newAmountDue <= 0;
            await query(
              `UPDATE hr_loans 
               SET amount_due = :newAmountDue, 
                   status = :status, 
                   end_date = CASE WHEN :isDone = 1 THEN CURDATE() ELSE end_date END
               WHERE id = :id`,
              {
                newAmountDue,
                status: isDone ? "COMPLETED" : "ACTIVE",
                isDone: isDone ? 1 : 0,
                id: loan.id,
              },
            );
          }
        } catch (loanErr) {
          console.error(
            `Failed to process loan ${loan.id} for employee ${e.id}:`,
            loanErr,
          );
          // Continue to next loan so payroll doesn't fail entirely
        }
      }

      const deductions =
        Number(incomeTax) +
        Number(ssfEmployee) +
        Number(tier3Employee) +
        Number(otherDeductions) +
        Number(totalLoanDeductions);
      let net = subtotalB - totalLoanDeductions - Number(otherDeductions);
      const dynamicCols = {
        tier3_employee: tier3Employee || 0,
        loan_deductions_total: totalLoanDeductions || 0,
        subtotal_a: subtotalA || 0,
        subtotal_b: subtotalB || 0,
        paye_bracket_id: payeBracketId || null,
        paye_rate: payeRate || null,
      };
      for (const [k, v] of Object.entries(loanCols)) {
        dynamicCols[k] = v;
      }

      for (const key in allowanceMap) {
        const allowId = String(key).split(":")[1] || String(key);
        const colName = `allowance_${allowId}`;
        dynamicCols[colName] = Number(allowanceMap[key] || 0);
        // Find the matching allowance row for a human-readable label
        const alRow = alRows.find((r) => String(r.id) === String(allowId));
        const alLabel = alRow?.allowance_name || `Allowance ${allowId}`;
        await registerSalaryComponent(companyId, {
          column_name: colName,
          label: alLabel,
          component_type: "ALLOWANCE",
          display_order: 25,
          is_earning: 1,
          is_fixed: 0,
          source_type: "ALLOWANCE",
          source_id: Number(allowId) || null,
        });
      }

      for (const key in taxBreakdown) {
        let cleanName = String(key)
          .replace(/[^a-zA-Z0-9_]/g, "_")
          .toLowerCase();
        if (/^[0-9]/.test(cleanName)) cleanName = `c_${cleanName}`;
        if (cleanName.length > 60) cleanName = cleanName.slice(0, 60);
        dynamicCols[cleanName] = Number(taxBreakdown[key] || 0);
        // Derive metadata for salary component registry
        let ctype = "OTHER";
        let cOrderBase = 55;
        let cEarning = 0;
        let cSourceType = "NONE";
        let cSourceId = null;
        let cLabel = cleanName.replace(/_/g, " ");
        if (key.startsWith("INCOME_TAX:")) {
          const cfgId = String(key).split(":")[1];
          const cfg = taxConfigs.find((t) => String(t.id) === cfgId);
          ctype = "INCOME_TAX";
          cOrderBase = 70;
          cSourceType = "TAX_CONFIG";
          cSourceId = Number(cfgId) || null;
          cLabel = cfg ? `PAYE – ${cfg.tax_name}` : `Income Tax ${cfgId}`;
        } else if (key.startsWith("SSF:")) {
          const cfgId = String(key).split(":")[1];
          const cfg = taxConfigs.find((t) => String(t.id) === cfgId);
          ctype = "SOCIAL_SECURITY";
          cOrderBase = 50;
          cSourceType = "TAX_CONFIG";
          cSourceId = Number(cfgId) || null;
          cLabel = cfg ? `SSF Employee – ${cfg.tax_name}` : `SSF ${cfgId}`;
        } else if (key.startsWith("TIER3:")) {
          const cfgId = String(key).split(":")[1];
          const cfg = taxConfigs.find((t) => String(t.id) === cfgId);
          ctype = "PROVIDENT_FUND";
          cOrderBase = 60;
          cSourceType = "TAX_CONFIG";
          cSourceId = Number(cfgId) || null;
          cLabel = cfg ? `Tier 3 – ${cfg.tax_name}` : `Tier 3 ${cfgId}`;
        } else if (key.startsWith("INCOME_TAX_BRACKET:")) {
          const bracketName = String(key).split(":")[1] || "";
          ctype = "INCOME_TAX";
          cOrderBase = 72;
          cLabel = `PAYE Bracket – ${bracketName}`;
        }
        await registerSalaryComponent(companyId, {
          column_name: cleanName,
          label: cLabel,
          component_type: ctype,
          display_order: cOrderBase,
          is_earning: cEarning,
          is_fixed: 0,
          source_type: cSourceType,
          source_id: cSourceId,
        });
      }
      // Do not register a 'loan_deductions_total' component to avoid duplication on payslips

      // Add dynamic columns if they don't exist
      const colDefs = [];
      const placeholders = [];
      const values = {
        payroll_id: payrollId,
        employee_id: e.id,
        basic_salary: basic || 0,
        allowances: allowances || 0,
        deductions: deductions || 0,
        income_tax: incomeTax || 0,
        ssf_employee: ssfEmployee || 0,
        net_salary: net || 0,
        period_id: period_id,
      };

      for (const [col, val] of Object.entries(dynamicCols)) {
        let ok = false;
        if (col.endsWith("_id")) {
          ok =
            (await ensureCol("hr_payroll_items", col, "BIGINT NULL")) &&
            (await ensureCol("hr_payslips", col, "BIGINT NULL"));
        } else {
          ok =
            (await ensureCol(
              "hr_payroll_items",
              col,
              "DECIMAL(18,4) NOT NULL DEFAULT 0",
            )) &&
            (await ensureCol(
              "hr_payslips",
              col,
              "DECIMAL(18,4) NOT NULL DEFAULT 0",
            ));
        }
        if (ok) {
          colDefs.push(col);
          placeholders.push(`:${col}`);
          values[col] = val;
        }
      }

      // Insert fixed columns first into hr_payroll_items
      await query(
        `INSERT INTO hr_payroll_items 
           (payroll_id, employee_id, basic_salary, allowances, deductions, income_tax, ssf_employee, net_salary)
         VALUES 
           (:payroll_id, :employee_id, :basic_salary, :allowances, :deductions, :income_tax, :ssf_employee, :net_salary)`,
        values,
      );
      // Ensure and update dynamic columns for items
      for (const col of colDefs) {
        const isId = col.endsWith("_id");
        await ensureCol(
          "hr_payroll_items",
          col,
          isId ? "BIGINT NULL" : "DECIMAL(18,4) NOT NULL DEFAULT 0",
        );
        await query(
          `UPDATE hr_payroll_items SET ${col} = :val WHERE payroll_id = :pid AND employee_id = :eid`,
          { val: values[col] ?? 0, pid: payrollId, eid: e.id },
        ).catch(() => {});
      }
      // Insert or update payslip with fixed columns
      await query(
        `INSERT INTO hr_payslips 
           (period_id, employee_id, basic_salary, allowances, deductions, income_tax, ssf_employee, net_salary, status)
         VALUES 
           (:period_id, :employee_id, :basic_salary, :allowances, :deductions, :income_tax, :ssf_employee, :net_salary, 'DRAFT')
         ON DUPLICATE KEY UPDATE 
           basic_salary = VALUES(basic_salary),
           allowances = VALUES(allowances),
           deductions = VALUES(deductions),
           income_tax = VALUES(income_tax),
           ssf_employee = VALUES(ssf_employee),
           net_salary = VALUES(net_salary),
           status = VALUES(status)`,
        values,
      );
      // Ensure and update dynamic columns for payslips
      for (const col of colDefs) {
        const isId = col.endsWith("_id");
        await ensureCol(
          "hr_payslips",
          col,
          isId ? "BIGINT NULL" : "DECIMAL(18,4) NOT NULL DEFAULT 0",
        );
        await query(
          `UPDATE hr_payslips SET ${col} = :val WHERE employee_id = :eid AND period_id = :period_id`,
          { val: values[col] ?? 0, eid: e.id, period_id },
        ).catch(() => {});
      }
    }

    await query(`UPDATE hr_payroll SET status = 'GENERATED' WHERE id = :id`, {
      id: payrollId,
    });

    res.json({ id: payrollId, message: "Payroll generated" });
  } catch (err) {
    next(err);
  }
}

/**
 * Salary Components Registry
 * Returns the full metadata list of salary component columns for hr_payslips.
 */
export async function listSalaryComponents(req, res, next) {
  try {
    const { companyId } = req.scope;
    const items = await query(
      `SELECT id, column_name, label, component_type, display_order,
              is_earning, is_fixed, source_type, source_id, is_active
       FROM hr_salary_components
       WHERE company_id = :companyId AND is_active = 1
       ORDER BY display_order ASC, component_type ASC, column_name ASC`,
      { companyId },
    );
    res.json({ items });
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

    // Dynamic columns for loans
    const loanColRows = await query(
      `SELECT COLUMN_NAME AS name
       FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE()
         AND TABLE_NAME = 'hr_payslips'
         AND COLUMN_NAME LIKE 'loan\\_%' ESCAPE '\\'
       ORDER BY COLUMN_NAME ASC`,
      {},
    ).catch(() => []);
    const loanCols = Array.isArray(loanColRows)
      ? loanColRows.map((r) => String(r.name))
      : [];

    const selectCols = ["p.*"].concat(loanCols.map((c) => `p.${c}`)).join(", ");

    const itemsRaw = await query(
      `SELECT ${selectCols}, e.first_name, e.last_name, e.emp_code, e.email, pr.period_name
       FROM hr_payslips p
       JOIN hr_employees e ON e.id = p.employee_id
       JOIN hr_payroll_periods pr ON pr.id = p.period_id
       ${where}
       ORDER BY pr.start_date DESC`,
      params,
    );

    // Fetch actual repayment items for precise breakdown
    const pids = itemsRaw.map((it) => it.period_id);
    const uniquePids = [...new Set(pids)];

    const repayRows = await query(
      `SELECT lr.employee_id, lr.loan_id, lr.amount_paid, l.loan_type, lr.payroll_id, pr.period_id
       FROM hr_loan_repayments lr 
       LEFT JOIN hr_loans l ON l.id = lr.loan_id
       JOIN hr_payroll pr ON pr.id = lr.payroll_id
       WHERE pr.period_id IN (:uniquePids)`,
      { uniquePids: uniquePids.length ? uniquePids : [0] },
    ).catch(() => []);

    const repayByEmpPeriod = {};
    for (const rr of repayRows || []) {
      const key = `${rr.employee_id}_${rr.period_id}`;
      if (!repayByEmpPeriod[key]) repayByEmpPeriod[key] = [];
      repayByEmpPeriod[key].push({
        loan_id: Number(rr.loan_id),
        loan_type: rr.loan_type || null,
        amount: Number(rr.amount_paid || 0),
      });
    }

    const items = itemsRaw.map((r) => {
      const loans = {};
      const key = `${r.employee_id}_${r.period_id}`;
      if (repayByEmpPeriod[key]) {
        for (const it of repayByEmpPeriod[key]) {
          loans[String(it.loan_id)] = {
            loan_id: it.loan_id,
            loan_type: it.loan_type,
            amount: it.amount,
          };
        }
      } else {
        // Fallback to columns if repayment table fails
        for (const col of loanCols) {
          const val = Number(r[col] || 0);
          if (val !== 0) {
            const lid = col.replace("loan_", "");
            loans[lid] = { loan_id: lid, amount: val };
          }
        }
      }

      return {
        ...r,
        loan_deductions_total: Number(r.loan_deductions_total || 0),
        loan_items: loans,
      };
    });

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

    const htmlBody = `
      <div style="font-family: sans-serif; padding: 20px; border: 1px solid #ddd; max-width: 600px;">
        <h2 style="color: #1d4ed8; margin-top: 0;">Payslip for ${p.period_name}</h2>
        <p>Dear ${p.first_name} ${p.last_name},</p>
        <p>Your payslip for ${p.period_name} has been generated and is now available for your review. Please find the detailed PDF copy attached.</p>
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

    // Two-step PDF generation: 1) fetch rendered HTML, 2) convert to PDF
    let attachments = [];
    try {
      const port = req.socket.localPort || process.env.PORT || 5000;
      const baseUrl = `http://127.0.0.1:${port}`;
      const token = req.headers.authorization;
      const fwdHeaders = {
        "Content-Type": "application/json",
        ...(token ? { Authorization: token } : {}),
        ...((req.headers["x-company-id"]) ? { "x-company-id": req.headers["x-company-id"] } : {}),
        ...((req.headers["x-branch-id"]) ? { "x-branch-id": req.headers["x-branch-id"] } : {}),
      };

      // Step 1: Get the rendered HTML
      const htmlUrl = `${baseUrl}/api/documents/salary-slip/${payslipId}/render`;
      const htmlRes = await fetch(htmlUrl, {
        method: "POST",
        headers: fwdHeaders,
        body: JSON.stringify({ format: "html" }),
      });
      if (!htmlRes.ok) {
        console.warn("[SEND-PAYSLIP] Failed to fetch HTML, status:", htmlRes.status);
        throw new Error("HTML fetch failed");
      }
      const payslipHtml = await htmlRes.text();

      // Step 2: Convert HTML to PDF via the raw-html-to-pdf endpoint
      const pdfUrl = `${baseUrl}/api/documents/raw-html-to-pdf`;
      const pdfRes = await fetch(pdfUrl, {
        method: "POST",
        headers: fwdHeaders,
        body: JSON.stringify({ html: payslipHtml }),
      });
      if (!pdfRes.ok) {
        console.warn("[SEND-PAYSLIP] Failed to generate PDF, status:", pdfRes.status);
        throw new Error("PDF generation failed");
      }
      const arrayBuffer = await pdfRes.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      if (buffer.length > 0) {
        const safeName = `Payslip_${p.period_name.replace(/\s+/g, "_")}_${p.first_name}_${p.last_name}.pdf`;
        attachments.push({
          filename: safeName,
          content: buffer,
          contentType: "application/pdf",
        });
        console.log(`[SEND-PAYSLIP] PDF attached: ${safeName} (${buffer.length} bytes)`);
      }
    } catch (e) {
      console.warn(
        "[SEND-PAYSLIP] Warning: Error generating PDF attachment:",
        e.message,
      );
    }

    await sendMail({
      to: p.email,
      subject: `Your Payslip for ${p.period_name}`,
      html: htmlBody,
      attachments,
    });

    res.json({ message: "Payslip sent to " + p.email });
  } catch (err) {
    next(err);
  }
}

export async function getPayrollBreakdown(req, res, next) {
  try {
    const { companyId } = req.scope;
    const { payroll_id, period_id } = req.query;
    let pid = payroll_id ? Number(payroll_id) : null;
    if (!pid && period_id) {
      const r = await query(
        `SELECT id, period_id FROM hr_payroll WHERE company_id = :companyId AND period_id = :period_id ORDER BY id DESC LIMIT 1`,
        { companyId, period_id },
      );
      if (r.length) pid = Number(r[0].id);
    }
    if (!pid) {
      const r = await query(
        `SELECT id, period_id FROM hr_payroll WHERE company_id = :companyId ORDER BY id DESC LIMIT 1`,
        { companyId },
      );
      if (!r.length) {
        res.json({ payroll_id: null, period_id: null, items: [] });
        return;
      }
      pid = Number(r[0].id);
    }
    const colRows = await query(
      `SELECT COLUMN_NAME AS name
       FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE()
         AND TABLE_NAME = 'hr_payroll_items'
         AND COLUMN_NAME LIKE 'allowance\\_%' ESCAPE '\\'
       ORDER BY COLUMN_NAME ASC`,
      {},
    ).catch(() => []);
    const allowanceCols = Array.isArray(colRows)
      ? colRows.map((r) => String(r.name))
      : [];
    const loanColRows = await query(
      `SELECT COLUMN_NAME AS name
       FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE()
         AND TABLE_NAME = 'hr_payroll_items'
         AND COLUMN_NAME LIKE 'loan\\_%' ESCAPE '\\'
       ORDER BY COLUMN_NAME ASC`,
      {},
    ).catch(() => []);
    const loanCols = Array.isArray(loanColRows)
      ? loanColRows.map((r) => String(r.name))
      : [];
    const fixedCols = [
      "pi.employee_id",
      "pi.basic_salary",
      "pi.allowances",
      "pi.deductions",
      "pi.income_tax",
      "pi.ssf_employee",
      "pi.loan_deductions_total",
      "pi.tier3_employee",
      "pi.net_salary",
      "pi.subtotal_a",
      "pi.subtotal_b",
      "pi.paye_bracket_id",
      "pi.paye_rate",
    ];
    const selectCols = fixedCols
      .concat(allowanceCols.map((c) => `pi.${c}`))
      .concat(loanCols.map((c) => `pi.${c}`))
      .join(", ");
    const rows = await query(
      `SELECT pi.payroll_id, ${selectCols},
              e.first_name, e.last_name, e.emp_code
       FROM hr_payroll_items pi
       JOIN hr_employees e ON e.id = pi.employee_id
       WHERE pi.payroll_id = :pid AND e.company_id = :companyId
       ORDER BY e.emp_code ASC`,
      { pid, companyId },
    );
    // Load actual loan repayments for this payroll to expose real per-loan items
    // and exclude completed/non-active loans from Salary Breakdown display.
    const repayRows = await query(
      `SELECT lr.employee_id, lr.loan_id, lr.amount_paid, l.loan_type, l.status AS loan_status
       FROM hr_loan_repayments lr 
       LEFT JOIN hr_loans l ON l.id = lr.loan_id
       WHERE lr.payroll_id = :pid 
         AND lr.amount_paid > 0
         AND l.status = 'ACTIVE'`,
      { pid },
    ).catch(() => []);
    const repayByEmp = {};
    for (const rr of repayRows || []) {
      const eid = Number(rr.employee_id);
      if (!repayByEmp[eid]) repayByEmp[eid] = [];
      repayByEmp[eid].push({
        loan_id: Number(rr.loan_id),
        loan_type: rr.loan_type || null,
        amount: Number(rr.amount_paid || 0),
      });
    }

    const items = rows.map((r) => {
      const allowances = {};
      for (const col of allowanceCols) {
        const id = col.replace("allowance_", "");
        const val = Number(r[col] || 0);
        if (val !== 0) allowances[id] = val;
      }
      const loans = {};
      for (const col of loanCols) {
        const id = col.replace("loan_", "");
        const val = Number(r[col] || 0);
        if (val !== 0) loans[id] = val;
      }
      const out = {
        employee_id: r.employee_id,
        emp_code: r.emp_code,
        first_name: r.first_name,
        last_name: r.last_name,
        basic_salary: Number(r.basic_salary || 0),
        allowances_total: Number(r.allowances || 0),
        allowances,
        ssf_employee: Number(r.ssf_employee || 0),
        tier3_employee: Number(r.tier3_employee || 0),
        loan_deductions: Number(r.loan_deductions_total || 0),
        income_tax: Number(r.income_tax || 0),
        subtotal_a: Number(r.subtotal_a || 0),
        subtotal_b: Number(r.subtotal_b || 0),
        paye_bracket_id: r.paye_bracket_id || null,
        paye_rate: r.paye_rate !== null ? Number(r.paye_rate) : null,
        deductions: Number(r.deductions || 0),
        net_salary: Number(r.net_salary || 0),
        loan_items: loans,
      };
      // Merge actual repayments for precise per-loan breakdown
      if (repayByEmp[r.employee_id]) {
        const realLoans = {};
        for (const it of repayByEmp[r.employee_id]) {
          realLoans[String(it.loan_id)] = {
            loan_id: it.loan_id,
            loan_type: it.loan_type,
            amount: it.amount,
          };
        }
        // Build map for UI compatibility
        out.loan_items = realLoans;
        // Prefer actual total if columns were absent
        const sum = repayByEmp[r.employee_id].reduce(
          (s, v) => s + Number(v.amount || 0),
          0,
        );
        if (!out.loan_deductions || out.loan_deductions === 0) {
          out.loan_deductions = sum;
        }
      }
      return out;
    });
    res.json({ payroll_id: pid, items });
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
    const {
      id,
      allowance_code,
      allowance_name,
      amount_type,
      amount,
      is_taxable,
      is_active,
    } = req.body;

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
      const newId = Number(result.insertId || 0);
      const gpRows = await query(
        `SELECT id FROM fin_account_groups WHERE company_id = :companyId AND name = 'Employee Allowances' LIMIT 1`,
        { companyId },
      );
      let groupId = Number(gpRows?.[0]?.id || 0);
      if (!groupId) {
        const insGp = await query(
          `INSERT INTO fin_account_groups (company_id, code, name, nature, parent_id, is_active)
           VALUES (:companyId, 'EMP_ALLOWANCES', 'Employee Allowances', 'EXPENSE', NULL, 1)`,
          { companyId },
        );
        groupId = Number(insGp.insertId || 0);
      }
      const curRows = await query(
        `SELECT id FROM fin_currencies WHERE company_id = :companyId AND is_base = 1 LIMIT 1`,
        { companyId },
      );
      const currencyId = Number(curRows?.[0]?.id || 0) || null;
      const accCode = String(allowance_code || `ALW-${newId}`).slice(0, 40);
      const accIns = await query(
        `INSERT INTO fin_accounts (company_id, group_id, code, name, currency_id, is_control_account, is_postable, is_active)
         VALUES (:companyId, :groupId, :code, :name, :currencyId, 0, 1, 1)`,
        {
          companyId,
          groupId,
          code: accCode,
          name: allowance_name,
          currencyId,
        },
      );
      const accId = Number(accIns.insertId || 0) || null;
      if (accId) {
        await query(
          `UPDATE hr_allowances SET account_id = :accId WHERE id = :id`,
          { accId, id: newId },
        );
      }
      res
        .status(201)
        .json({ id: result.insertId, message: "Allowance created" });
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

    // Auto-activate loans reaching their start date
    try {
      await query(
        `UPDATE hr_loans SET status = 'ACTIVE' WHERE company_id = :companyId AND status = 'APPROVED' AND start_date <= CURDATE()`,
        { companyId },
      );
    } catch (updateErr) {
      console.error("Failed to auto-activate loans:", updateErr);
    }

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
    console.error("Error in listLoans:", err);
    next(err);
  }
}

export async function saveLoan(req, res, next) {
  try {
    const { companyId, branchId } = req.scope;
    const userId = toNumber(req.user?.id || req.user?.sub, null);
    const {
      id,
      employee_id,
      loan_type,
      amount,
      interest_rate,
      repayment_period_months,
      monthly_installment,
      start_date,
      status,
    } = req.body;

    // Lookup loan_id from hr_setup_loan_types
    const ltRows = await query(
      "SELECT id FROM hr_setup_loan_types WHERE name = :loan_type AND company_id = :companyId LIMIT 1",
      { loan_type, companyId },
    );
    const loan_id = ltRows?.[0]?.id || null;

    const params = {
      employee_id,
      loan_type,
      loan_id,
      amount: toNumber(amount, 0),
      interest_rate: toNumber(interest_rate, 0),
      repayment_period_months: toNumber(repayment_period_months, 0),
      monthly_installment: toNumber(monthly_installment, 0),
      start_date: start_date || null,
      status: status || "PENDING",
      userId,
      companyId,
    };

    // Use frontend values if provided, otherwise default to current calculation
    // Note: Database triggers will also ensure these are calculated on insert/update
    let endDate = req.body.end_date || null;
    let amountDue =
      req.body.amount_due !== undefined
        ? toNumber(req.body.amount_due, params.amount)
        : params.amount;

    if (!endDate && params.start_date) {
      const start = new Date(params.start_date);
      const end = new Date(start);
      end.setMonth(start.getMonth() + params.repayment_period_months);
      endDate = end.toISOString().split("T")[0];
    }

    const finalParams = { ...params, endDate, amountDue };

    if (id) {
      await query(
        `UPDATE hr_loans SET 
          loan_type = :loan_type, loan_id = :loan_id, amount = :amount, interest_rate = :interest_rate, 
          repayment_period_months = :repayment_period_months, monthly_installment = :monthly_installment, 
          start_date = :start_date, status = :status, end_date = :endDate, amount_due = :amountDue, updated_by = :userId
         WHERE id = :id AND company_id = :companyId`,
        { ...finalParams, id },
      );

      if (params.loan_id) {
        const colName = `loan_${params.loan_id}`;
        await ensureCol(
          "hr_payroll_items",
          colName,
          "DECIMAL(15,2) DEFAULT 0",
        ).catch(() => {});
        await ensureCol(
          "hr_payslips",
          colName,
          "DECIMAL(15,2) DEFAULT 0",
        ).catch(() => {});
      }

      const colName = `loan_${id}`;
      await ensureCol(
        "hr_payroll_items",
        colName,
        "DECIMAL(15,2) DEFAULT 0",
      ).catch(() => {});
      await ensureCol("hr_payslips", colName, "DECIMAL(15,2) DEFAULT 0").catch(
        () => {},
      );

      res.json({ message: "Loan updated" });
    } else {
      const result = await query(
        `INSERT INTO hr_loans (company_id, branch_id, employee_id, loan_type, loan_id, amount, interest_rate, repayment_period_months, monthly_installment, start_date, status, end_date, amount_due, created_by)
         VALUES (:companyId, :branchId, :employee_id, :loan_type, :loan_id, :amount, :interest_rate, :repayment_period_months, :monthly_installment, :start_date, :status, :endDate, :amountDue, :userId)`,
        { ...finalParams, branchId },
      );

      if (params.loan_id) {
        const colName = `loan_${params.loan_id}`;
        await ensureCol(
          "hr_payroll_items",
          colName,
          "DECIMAL(15,2) DEFAULT 0",
        ).catch(() => {});
        await ensureCol(
          "hr_payslips",
          colName,
          "DECIMAL(15,2) DEFAULT 0",
        ).catch(() => {});
      }

      const lref = result.insertId;
      if (lref) {
        const colName = `loan_${lref}`;
        await ensureCol(
          "hr_payroll_items",
          colName,
          "DECIMAL(15,2) DEFAULT 0",
        ).catch(() => {});
        await ensureCol(
          "hr_payslips",
          colName,
          "DECIMAL(15,2) DEFAULT 0",
        ).catch(() => {});
      }

      res.status(201).json({ id: result.insertId, message: "Loan created" });
    }
  } catch (err) {
    next(err);
  }
}

export async function listLoanTypes(req, res, next) {
  try {
    const { companyId } = req.scope;
    await query(
      `CREATE TABLE IF NOT EXISTS hr_setup_loan_types (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        company_id BIGINT UNSIGNED NOT NULL,
        name VARCHAR(100) NOT NULL,
        account_id BIGINT UNSIGNED NULL,
        is_active TINYINT(1) NOT NULL DEFAULT 1,
        PRIMARY KEY (id),
        KEY idx_company (company_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
      {},
    ).catch(() => {});
    const items = await query(
      `SELECT id, name, is_active FROM hr_setup_loan_types WHERE company_id = :companyId AND is_active = 1 ORDER BY name ASC`,
      { companyId },
    );
    res.json({ items });
  } catch (err) {
    next(err);
  }
}

export async function saveLoanType(req, res, next) {
  try {
    const { companyId } = req.scope;
    await query(
      `CREATE TABLE IF NOT EXISTS hr_setup_loan_types (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        company_id BIGINT UNSIGNED NOT NULL,
        name VARCHAR(100) NOT NULL,
        account_id BIGINT UNSIGNED NULL,
        is_active TINYINT(1) NOT NULL DEFAULT 1,
        PRIMARY KEY (id),
        KEY idx_company (company_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
      {},
    ).catch(() => {});
    const { id, name, is_active } = req.body;
    let targetId = id;
    if (id) {
      await query(
        `UPDATE hr_setup_loan_types SET name = :name, is_active = :is_active WHERE id = :id AND company_id = :companyId`,
        { id, name, is_active: is_active ? 1 : 0, companyId },
      );
    } else {
      const r = await query(
        `INSERT INTO hr_setup_loan_types (company_id, name, is_active) VALUES (:companyId, :name, :is_active)`,
        { companyId, name, is_active: is_active ? 1 : 0 },
      );
      targetId = r.insertId;
    }

    // FINANCE SYNC
    const loanTypeRows = await query(
      "SELECT id, name, is_active, account_id FROM hr_setup_loan_types WHERE id = :id AND company_id = :companyId",
      { id: targetId, companyId },
    );
    const lt = loanTypeRows?.[0];
    if (lt) {
      const gpRows = await query(
        "SELECT id FROM fin_account_groups WHERE company_id = :companyId AND name = 'Employee Loan Repayments Payable' LIMIT 1",
        { companyId },
      );
      let groupId = gpRows?.[0]?.id;
      if (!groupId) {
        const insGp = await query(
          "INSERT INTO fin_account_groups (company_id, code, name, nature, is_active) VALUES (:companyId, 'EMP_LOAN_PAYABLE', 'Employee Loan Repayments Payable', 'LIABILITY', 1)",
          { companyId },
        );
        groupId = insGp.insertId;
      }

      const curRows = await query(
        "SELECT id FROM fin_currencies WHERE company_id = :companyId AND is_base = 1 LIMIT 1",
        { companyId },
      );
      const currencyId = curRows?.[0]?.id || null;

      if (lt.account_id) {
        await query(
          "UPDATE fin_accounts SET name = :name, is_active = :is_active WHERE id = :accountId AND company_id = :companyId",
          {
            name: lt.name,
            is_active: lt.is_active,
            accountId: lt.account_id,
            companyId,
          },
        );
      } else {
        const accCode = `LOAN-${targetId}`;
        const insAcc = await query(
          `INSERT INTO fin_accounts (company_id, group_id, code, name, currency_id, is_control_account, is_postable, is_active)
           VALUES (:companyId, :groupId, :code, :name, :currencyId, 0, 1, :is_active)`,
          {
            companyId,
            groupId,
            code: accCode,
            name: lt.name,
            currencyId,
            is_active: lt.is_active,
          },
        );
        await query(
          "UPDATE hr_setup_loan_types SET account_id = :accountId WHERE id = :id",
          { accountId: insAcc.insertId, id: targetId },
        );
      }
    }
    res.status(id ? 200 : 201).json({
      id: targetId,
      message: id ? "Loan type updated" : "Loan type created",
    });
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
    await ensureHRTables();
    await query(
      `CREATE TABLE IF NOT EXISTS hr_tax_config (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        company_id BIGINT UNSIGNED NOT NULL,
        tax_name VARCHAR(100) NOT NULL,
        tax_type VARCHAR(40) NOT NULL,
        min_amount DECIMAL(18,4) NULL,
        max_amount DECIMAL(18,4) NULL,
        tax_rate DECIMAL(9,4) NULL,
        fixed_amount DECIMAL(18,4) NULL,
        employee_contribution_rate DECIMAL(9,4) NULL,
        employer_contribution_rate DECIMAL(9,4) NULL,
        taxable_components TEXT NULL,
        is_active TINYINT(1) NOT NULL DEFAULT 1,
        PRIMARY KEY (id),
        KEY idx_company (company_id),
        KEY idx_type (tax_type)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
      {},
    ).catch(() => []);
    await query(
      `ALTER TABLE hr_tax_config MODIFY COLUMN tax_type VARCHAR(50) NOT NULL`,
      {},
    ).catch(() => []);
    if (Array.isArray(req.body?.configs)) {
      const { configs = [], idsToDelete = [] } = req.body;
      for (const cfg of configs) {
        const id = toNumber(cfg.id, null);
        const tax_name = cfg.tax_name;
        let tax_type = cfg.tax_type;
        if (String(tax_type || "").toUpperCase() === "PROVIDENCE_FUND") {
          tax_type = "PROVIDENT_FUND";
        }
        const min_amount = toNumber(cfg.min_amount, 0);
        const max_amount = toNumber(cfg.max_amount, null);
        const tax_rate = toNumber(cfg.tax_rate, 0);
        const fixed_amount = toNumber(cfg.fixed_amount, 0);
        const employee_contribution_rate = toNumber(
          cfg.employee_contribution_rate,
          0,
        );
        const employer_contribution_rate = toNumber(
          cfg.employer_contribution_rate,
          0,
        );
        const is_active = cfg.is_active ? 1 : 0;
        let compsJson = null;
        try {
          if (Array.isArray(cfg.taxable_components)) {
            compsJson = JSON.stringify(cfg.taxable_components);
          } else if (
            typeof cfg.taxable_components === "string" &&
            cfg.taxable_components.trim()
          ) {
            compsJson = cfg.taxable_components;
          }
        } catch {}
        if (id) {
          await query(
            `UPDATE hr_tax_config SET 
              tax_name = :tax_name, tax_type = :tax_type, min_amount = :min_amount, 
              max_amount = :max_amount, tax_rate = :tax_rate, fixed_amount = :fixed_amount,
              employee_contribution_rate = :employee_contribution_rate,
              employer_contribution_rate = :employer_contribution_rate,
              is_active = :is_active, taxable_components = :taxable_components
             WHERE id = :id AND company_id = :companyId`,
            {
              id,
              tax_name,
              tax_type,
              min_amount,
              max_amount,
              tax_rate,
              fixed_amount,
              employee_contribution_rate,
              employer_contribution_rate,
              is_active,
              taxable_components: compsJson,
              companyId,
            },
          );
        } else {
          await query(
            `INSERT INTO hr_tax_config (company_id, tax_name, tax_type, min_amount, max_amount, tax_rate, fixed_amount, employee_contribution_rate, employer_contribution_rate, is_active, taxable_components)
             VALUES (:companyId, :tax_name, :tax_type, :min_amount, :max_amount, :tax_rate, :fixed_amount, :employee_contribution_rate, :employer_contribution_rate, :is_active, :taxable_components)`,
            {
              tax_name,
              tax_type,
              min_amount,
              max_amount,
              tax_rate,
              fixed_amount,
              employee_contribution_rate,
              employer_contribution_rate,
              is_active,
              taxable_components: compsJson,
              companyId,
            },
          );
        }
      }
      if (Array.isArray(idsToDelete) && idsToDelete.length) {
        for (const delId of idsToDelete) {
          await query(
            `DELETE FROM hr_tax_config WHERE id = :id AND company_id = :companyId`,
            { id: delId, companyId },
          );
        }
      }
      res.json({ message: "Statutory configurations saved" });
      return;
    }
    const {
      id,
      tax_name,
      tax_type,
      min_amount,
      max_amount,
      tax_rate,
      fixed_amount,
      is_active,
      taxable_components,
    } = req.body;

    const params = {
      tax_name,
      tax_type:
        String(tax_type || "").toUpperCase() === "PROVIDENCE_FUND"
          ? "PROVIDENT_FUND"
          : tax_type,
      min_amount: toNumber(min_amount, 0),
      max_amount: toNumber(max_amount, null),
      tax_rate: toNumber(tax_rate, 0),
      fixed_amount: toNumber(fixed_amount, 0),
      is_active: is_active ? 1 : 0,
      companyId,
    };
    let compsJson = null;
    try {
      if (Array.isArray(taxable_components)) {
        compsJson = JSON.stringify(taxable_components);
      } else if (
        typeof taxable_components === "string" &&
        taxable_components.trim()
      ) {
        compsJson = taxable_components;
      }
    } catch {}

    if (id) {
      await query(
        `UPDATE hr_tax_config SET 
          tax_name = :tax_name, tax_type = :tax_type, min_amount = :min_amount, 
          max_amount = :max_amount, tax_rate = :tax_rate, fixed_amount = :fixed_amount, is_active = :is_active, taxable_components = :taxable_components
         WHERE id = :id AND company_id = :companyId`,
        { ...params, id, taxable_components: compsJson },
      );
      res.json({ message: "Tax config updated" });
    } else {
      const result = await query(
        `INSERT INTO hr_tax_config (company_id, tax_name, tax_type, min_amount, max_amount, tax_rate, fixed_amount, is_active, taxable_components)
         VALUES (:companyId, :tax_name, :tax_type, :min_amount, :max_amount, :tax_rate, :fixed_amount, :is_active, :taxable_components)`,
        { ...params, taxable_components: compsJson },
      );
      res
        .status(201)
        .json({ id: result.insertId, message: "Tax config created" });
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
    const { id, name, description, is_active, components } = req.body;

    const params = {
      name,
      description,
      is_active: is_active ? 1 : 0,
      companyId,
    };
    let compsJson = null;
    try {
      if (components && typeof components === "object") {
        compsJson = JSON.stringify(components);
      } else if (typeof components === "string" && components.trim()) {
        compsJson = components;
      }
    } catch {}

    if (id) {
      await query(
        `UPDATE hr_salary_structures SET name = :name, description = :description, is_active = :is_active, components = :components
         WHERE id = :id AND company_id = :companyId`,
        { ...params, id, components: compsJson },
      );
      res.json({ message: "Salary structure updated" });
    } else {
      await query(
        `DELETE FROM hr_salary_structures WHERE company_id = :companyId`,
        { companyId },
      ).catch(() => []);
      const result = await query(
        `INSERT INTO hr_salary_structures (company_id, name, description, is_active, components)
         VALUES (:companyId, :name, :description, :is_active, :components)`,
        { ...params, components: compsJson },
      );
      res
        .status(201)
        .json({ id: result.insertId, message: "Salary structure created" });
    }
  } catch (err) {
    next(err);
  }
}

export async function getActiveSalaryStructure(req, res, next) {
  try {
    const { companyId } = req.scope;
    const rows = await query(
      `SELECT id, name, description, is_active, components 
       FROM hr_salary_structures 
       WHERE company_id = :companyId AND is_active = 1 
       ORDER BY id DESC LIMIT 1`,
      { companyId },
    );
    const item = rows[0] || null;
    res.json({ item });
  } catch (err) {
    next(err);
  }
}

export async function listBaseSalaries(req, res, next) {
  try {
    await ensureHRTables();
    const { companyId } = req.scope;

    // Get the latest base salary per employee using a more robust join
    const items = await query(
      `SELECT e.id as employee_id, e.emp_code, e.first_name, e.last_name, 
              COALESCE(bs.base_salary, e.base_salary, 0) as base_salary,
              bs.effective_date
       FROM hr_employees e
       LEFT JOIN (
         SELECT t1.employee_id, t1.base_salary, t1.effective_date
         FROM hr_employee_base_salaries t1
         INNER JOIN (
           SELECT employee_id, MAX(id) as max_id
           FROM hr_employee_base_salaries
           WHERE company_id = :companyId
           GROUP BY employee_id
         ) t2 ON t1.id = t2.max_id
       ) bs ON bs.employee_id = e.id
       WHERE e.company_id = :companyId 
         AND e.status = 'ACTIVE' 
         AND e.deleted_at IS NULL
       ORDER BY e.first_name ASC`,
      { companyId },
    );

    res.json({ items });
  } catch (err) {
    console.error("DEBUG: listBaseSalaries ERROR:", err);
    next(err);
  }
}

export async function saveBaseSalary(req, res, next) {
  try {
    await ensureHRTables();
    const { companyId } = req.scope;
    const userId = toNumber(req.user?.id || req.user?.sub, null);
    const { employee_id, base_salary } = req.body;
    const effective_date = new Date().toISOString().slice(0, 10);

    // 1. Insert historical record into hr_employee_base_salaries
    await query(
      `INSERT INTO hr_employee_base_salaries (company_id, employee_id, base_salary, effective_date, created_by)
       VALUES (:companyId, :employee_id, :base_salary, :effective_date, :userId)`,
      {
        companyId,
        employee_id,
        base_salary: Number(base_salary || 0),
        effective_date,
        userId,
      },
    );

    // 2. Update the base_salary directly on hr_employees table
    await query(
      `UPDATE hr_employees SET base_salary = :base_salary WHERE id = :employee_id AND company_id = :companyId`,
      { base_salary: Number(base_salary || 0), employee_id, companyId },
    );

    res.json({ message: "Base salary updated successfully" });
  } catch (err) {
    console.error("DEBUG saveBaseSalary ERROR:", err);
    next(err);
  }
}

export async function saveBaseSalariesBulk(req, res, next) {
  try {
    const { companyId } = req.scope;
    const userId = toNumber(req.user?.id || req.user?.sub, null);
    const { rows } = req.body;
    if (!Array.isArray(rows)) {
      return res
        .status(400)
        .json({ message: "Invalid payload: rows must be an array" });
    }

    const effective_date = new Date().toISOString().slice(0, 10);
    let successCount = 0;

    for (const row of rows) {
      if (!row || !row.emp_code || row.base_salary == null) continue;

      const empRes = await query(
        `SELECT id FROM hr_employees WHERE emp_code = :emp_code AND company_id = :companyId AND status = 'ACTIVE'`,
        { emp_code: String(row.emp_code).trim(), companyId },
      );
      if (!empRes.length) continue;

      const employee_id = empRes[0].id;
      const base_salary = Number(row.base_salary || 0);

      await query(
        `INSERT INTO hr_employee_base_salaries (company_id, employee_id, base_salary, effective_date, created_by)
         VALUES (:companyId, :employee_id, :base_salary, :effective_date, :userId)`,
        { companyId, employee_id, base_salary, effective_date, userId },
      );

      await query(
        `UPDATE hr_employees SET base_salary = :base_salary WHERE id = :employee_id AND company_id = :companyId`,
        { base_salary, employee_id, companyId },
      );
      successCount++;
    }

    res.json({
      message: `Successfully updated ${successCount} base salaries.`,
    });
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
           COALESCE(SUM(income_tax),0) AS paye, 
           COALESCE(SUM(ssf_employee),0) AS ssf, 
           COALESCE(SUM(net_salary),0) AS net
         FROM hr_payroll_items WHERE payroll_id = :pid`,
        { pid: payroll_id },
      );
      const gross = Number(totals?.[0]?.gross || 0);
      const paye = Number(totals?.[0]?.paye || 0);
      const ssf = Number(totals?.[0]?.ssf || 0);
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
      const payeAccRows = await query(
        `SELECT id FROM fin_accounts WHERE company_id = :companyId AND name = 'PAYE Payable' LIMIT 1`,
        { companyId },
      );
      if (payeAccRows.length && paye > 0) {
        await query(
          `INSERT INTO fin_voucher_lines
             (company_id, voucher_id, line_no, account_id, description, debit, credit, tax_code_id, cost_center, reference_no)
           VALUES
             (:companyId, :voucherId, :lineNo, :accountId, :description, :debit, :credit, NULL, NULL, NULL)`,
          {
            companyId,
            voucherId,
            lineNo: lineNo++,
            accountId: Number(payeAccRows[0].id),
            description: "PAYE payable",
            debit: 0,
            credit: paye,
          },
        );
      }
      const ssfAccRows = await query(
        `SELECT id FROM fin_accounts WHERE company_id = :companyId AND name = 'SSNIT/Pension Payable' LIMIT 1`,
        { companyId },
      );
      if (ssfAccRows.length && ssf > 0) {
        await query(
          `INSERT INTO fin_voucher_lines
             (company_id, voucher_id, line_no, account_id, description, debit, credit, tax_code_id, cost_center, reference_no)
           VALUES
             (:companyId, :voucherId, :lineNo, :accountId, :description, :debit, :credit, NULL, NULL, NULL)`,
          {
            companyId,
            voucherId,
            lineNo: lineNo++,
            accountId: Number(ssfAccRows[0].id),
            description: "SSNIT/Pension payable",
            debit: 0,
            credit: ssf,
          },
        );
      }
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
          description: "Salaries payable (net)",
          debit: 0,
          credit: net,
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

export async function backfillTier3(req, res, next) {
  try {
    const { companyId } = req.scope;
    const taxRows = await query(
      `SELECT employee_contribution_rate 
       FROM hr_tax_config 
       WHERE company_id = :companyId AND is_active = 1 AND 
             (tax_type = 'PROVIDENT_FUND' OR UPPER(tax_name) LIKE '%TIER 3%' OR UPPER(tax_name) LIKE '%TIER-3%')`,
      { companyId },
    );
    let rate = 0;
    for (const r of taxRows) {
      rate += Number(r.employee_contribution_rate || 0);
    }
    rate = rate / 100;
    const existCol = async (table, col) => {
      const r = await query(
        `SELECT COUNT(*) AS c FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = :t AND COLUMN_NAME = :c`,
        { t: table, c: col },
      ).catch(() => []);
      return Number(r?.[0]?.c || 0) > 0;
    };
    if (!(await existCol("hr_payroll_items", "tier3_employee"))) {
      await query(
        `ALTER TABLE hr_payroll_items ADD COLUMN tier3_employee DECIMAL(18,4) NOT NULL DEFAULT 0`,
        {},
      ).catch(() => {});
    }
    if (!(await existCol("hr_payslips", "tier3_employee"))) {
      await query(
        `ALTER TABLE hr_payslips ADD COLUMN tier3_employee DECIMAL(18,4) NOT NULL DEFAULT 0`,
        {},
      ).catch(() => {});
    }
    const rows = await query(
      `SELECT pi.payroll_id, pi.employee_id, pi.basic_salary, p.period_id
       FROM hr_payroll_items pi
       JOIN hr_payroll p ON p.id = pi.payroll_id
       WHERE p.company_id = :companyId`,
      { companyId },
    );
    let updated = 0;
    for (const r of rows) {
      const amount = Number(r.basic_salary || 0) * rate;
      await query(
        `UPDATE hr_payroll_items SET tier3_employee = :amt WHERE payroll_id = :pid AND employee_id = :eid`,
        { amt: amount, pid: r.payroll_id, eid: r.employee_id },
      ).catch(() => {});
      await query(
        `UPDATE hr_payslips SET tier3_employee = :amt WHERE employee_id = :eid AND period_id = :period_id`,
        { amt: amount, eid: r.employee_id, period_id: r.period_id },
      ).catch(() => {});
      updated++;
    }
    res.json({ message: "Tier 3 backfill completed", updated });
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

/**
 * Setup - Locations
 */
export async function listLocations(req, res, next) {
  try {
    await ensureHRTables();
    const { companyId } = req.scope;
    const items = await query(
      `SELECT * FROM hr_locations WHERE company_id = :companyId AND is_active = 1 ORDER BY location_name ASC`,
      { companyId },
    );
    res.json({ items });
  } catch (err) {
    next(err);
  }
}

export async function saveLocation(req, res, next) {
  try {
    await ensureHRTables();
    const { companyId } = req.scope;
    const branchId = req.scope.branchId || req.user?.branch_id || 1;
    const { id, location_name, address, is_active } = req.body;
    const userId = toNumber(req.user?.id || req.user?.sub, null);
    if (id) {
      await query(
        `UPDATE hr_locations SET location_name = :location_name, address = :address, is_active = :is_active, updated_by = :userId WHERE id = :id AND company_id = :companyId`,
        {
          id,
          companyId,
          location_name,
          address,
          is_active: is_active === false ? 0 : 1,
          userId,
        },
      );
    } else {
      await query(
        `INSERT INTO hr_locations (company_id, branch_id, location_name, address, is_active, created_by) VALUES (:companyId, :branchId, :location_name, :address, :is_active, :userId)`,
        {
          companyId,
          branchId,
          location_name,
          address,
          is_active: is_active === false ? 0 : 1,
          userId,
        },
      );
    }
    res.json({ message: "Location saved" });
  } catch (err) {
    next(err);
  }
}

/**
 * Setup - Parameters
 */
export async function listParameters(req, res, next) {
  try {
    const { companyId } = req.scope;
    const items = await query(
      `SELECT id, param_key, param_value FROM hr_setup_parameters WHERE company_id = :companyId`,
      { companyId },
    );
    res.json({ items });
  } catch (err) {
    next(err);
  }
}

export async function saveParameters(req, res, next) {
  try {
    const { companyId } = req.scope;
    const { parameters } = req.body;
    if (parameters && typeof parameters === "object") {
      for (const [key, value] of Object.entries(parameters)) {
        await query(
          `INSERT INTO hr_setup_parameters (company_id, param_key, param_value) 
           VALUES (:companyId, :key, :value) 
           ON DUPLICATE KEY UPDATE param_value = :value`,
          { companyId, key, value: String(value) },
        );
      }
    }
    res.json({ message: "Parameters saved" });
  } catch (err) {
    next(err);
  }
}

/**
 * HR Reports
 */
export async function reportEmployees(req, res, next) {
  try {
    await ensureHRTables();
    const { companyId } = req.scope;
    const { dept_id, q } = req.query;
    const clauses = ["e.company_id = :companyId", "e.deleted_at IS NULL"];
    const params = { companyId };
    if (dept_id) {
      clauses.push("e.dept_id = :dept_id");
      params.dept_id = dept_id;
    }
    if (q) {
      clauses.push(
        "(e.first_name LIKE :q OR e.last_name LIKE :q OR e.emp_code LIKE :q)",
      );
      params.q = `%${q}%`;
    }
    const where = `WHERE ${clauses.join(" AND ")}`;
    const items = await query(
      `SELECT e.id, e.emp_code, e.first_name, e.last_name, d.dept_name, p.pos_name, e.email, e.phone, e.status
       FROM hr_employees e
       LEFT JOIN hr_departments d ON d.id = e.dept_id
       LEFT JOIN hr_positions p ON p.id = e.pos_id
       ${where}
       ORDER BY e.emp_code ASC`,
      params,
    );
    res.json({ items });
  } catch (err) {
    next(err);
  }
}

export async function reportSSF(req, res, next) {
  try {
    const { companyId } = req.scope;
    const { period_id, from_date, to_date } = req.query;
    const clauses = ["pp.company_id = :companyId"];
    const params = { companyId };
    if (period_id) {
      clauses.push("pp.id = :period_id");
      params.period_id = period_id;
    }
    if (from_date) {
      clauses.push("pp.start_date >= :from_date");
      params.from_date = from_date;
    }
    if (to_date) {
      clauses.push("pp.end_date <= :to_date");
      params.to_date = to_date;
    }
    const where = `WHERE ${clauses.join(" AND ")}`;
    const items = await query(
      `SELECT e.emp_code, e.first_name, e.last_name, p.period_name, i.basic_salary, i.ssf_employee
       FROM hr_payroll_items i
       JOIN hr_payslips ps ON ps.employee_id = i.employee_id AND ps.period_id = (SELECT period_id FROM hr_payroll WHERE id = (SELECT MAX(id) FROM hr_payroll WHERE company_id = :companyId))
       JOIN hr_employees e ON e.id = i.employee_id
       JOIN hr_payroll pp ON pp.id = (SELECT MAX(id) FROM hr_payroll WHERE company_id = :companyId)
       JOIN hr_payroll_periods p ON p.id = pp.period_id
       ${where}
       ORDER BY e.emp_code ASC`,
      params,
    );
    res.json({ items });
  } catch (err) {
    next(err);
  }
}

export async function reportPAYE(req, res, next) {
  try {
    const { companyId } = req.scope;
    const { period_id, from_date, to_date } = req.query;
    const clauses = ["pp.company_id = :companyId"];
    const params = { companyId };
    if (period_id) {
      clauses.push("pp.id = :period_id");
      params.period_id = period_id;
    }
    if (from_date) {
      clauses.push("pp.start_date >= :from_date");
      params.from_date = from_date;
    }
    if (to_date) {
      clauses.push("pp.end_date <= :to_date");
      params.to_date = to_date;
    }
    const where = `WHERE ${clauses.join(" AND ")}`;
    const items = await query(
      `SELECT e.emp_code, e.first_name, e.last_name, p.period_name, i.basic_salary, i.allowances, i.income_tax
       FROM hr_payroll_items i
       JOIN hr_employees e ON e.id = i.employee_id
       JOIN hr_payroll pp ON pp.company_id = :companyId
       JOIN hr_payroll_periods p ON p.id = pp.period_id
       ${where}
       ORDER BY e.emp_code ASC`,
      params,
    );
    res.json({ items });
  } catch (err) {
    next(err);
  }
}

export async function reportEmployeeLoans(req, res, next) {
  try {
    const { companyId } = req.scope;
    const items = await query(
      `SELECT l.id, e.emp_code, e.first_name, e.last_name, l.loan_type, l.amount, l.monthly_installment, l.start_date, l.status
       FROM hr_loans l
       JOIN hr_employees e ON e.id = l.employee_id
       WHERE l.company_id = :companyId
       ORDER BY l.start_date DESC`,
      { companyId },
    );
    res.json({ items });
  } catch (err) {
    next(err);
  }
}

export async function reportEmployeeAllowances(req, res, next) {
  try {
    const { companyId } = req.scope;
    const items = await query(
      `SELECT e.emp_code, e.first_name, e.last_name, a.allowance_name, a.amount_type, a.amount
       FROM hr_employee_allowance_mappings m
       JOIN hr_employees e ON e.id = m.employee_id
       JOIN hr_allowances a ON a.id = m.allowance_id
       WHERE e.company_id = :companyId
       ORDER BY e.emp_code ASC`,
      { companyId },
    );
    res.json({ items });
  } catch (err) {
    next(err);
  }
}

/**
 * Bulk Payslip Emails
 */
export async function sendEmailBulk(req, res, next) {
  try {
    const { companyId } = req.scope;
    const { payslipIds } = req.body;
    if (!Array.isArray(payslipIds)) {
      throw httpError(400, "BAD_REQUEST", "payslipIds must be an array");
    }

    let count = 0;
    for (const payslipId of payslipIds) {
      const rows = await query(
        `SELECT p.*, e.first_name, e.last_name, e.email, pr.period_name
         FROM hr_payslips p
         JOIN hr_employees e ON e.id = p.employee_id
         JOIN hr_payroll_periods pr ON pr.id = p.period_id
         WHERE p.id = :id AND e.company_id = :companyId`,
        { id: payslipId, companyId },
      );

      if (rows.length > 0 && rows[0].email) {
        const p = rows[0];
        const html = `
          <div style="font-family: sans-serif; padding: 20px; border: 1px solid #ddd; max-width: 600px;">
            <h2 style="color: #1d4ed8; margin-top: 0;">Payslip for ${
              p.period_name
            }</h2>
            <p>Dear ${p.first_name} ${p.last_name},</p>
            <p>Your payslip for ${
              p.period_name
            } has been generated and is now available for your review.</p>
            <div style="background: #f8fafc; padding: 15px; border-radius: 4px; margin: 20px 0;">
              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="padding: 8px 0; border-bottom: 1px solid #e2e8f0;"><strong>Basic Salary</strong></td>
                  <td style="padding: 8px 0; border-bottom: 1px solid #e2e8f0; text-align: right;">${Number(
                    p.basic_salary,
                  ).toFixed(2)}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; border-bottom: 1px solid #e2e8f0;"><strong>Allowances</strong></td>
                  <td style="padding: 8px 0; border-bottom: 1px solid #e2e8f0; text-align: right;">${Number(
                    p.allowances,
                  ).toFixed(2)}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; border-bottom: 1px solid #e2e8f0;"><strong>Deductions</strong></td>
                  <td style="padding: 8px 0; border-bottom: 1px solid #e2e8f0; text-align: right;">${Number(
                    p.deductions,
                  ).toFixed(2)}</td>
                </tr>
                <tr style="font-size: 1.1em;">
                  <td style="padding: 12px 0;"><strong>Net Salary</strong></td>
                  <td style="padding: 12px 0; text-align: right; color: #15803d;"><strong>${Number(
                    p.net_salary,
                  ).toFixed(2)}</strong></td>
                </tr>
              </table>
            </div>
            <p>Regards,<br/>Human Resources Department</p>
          </div>
        `;

        let attachments = [];
        try {
          const port = req.socket.localPort || process.env.PORT || 5000;
          const baseUrl = `http://127.0.0.1:${port}`;
          const token = req.headers.authorization;
          const fwdHeaders = {
            "Content-Type": "application/json",
            ...(token ? { Authorization: token } : {}),
            ...((req.headers["x-company-id"]) ? { "x-company-id": req.headers["x-company-id"] } : {}),
            ...((req.headers["x-branch-id"]) ? { "x-branch-id": req.headers["x-branch-id"] } : {}),
          };

          // Step 1: Get the rendered HTML
          const htmlUrl = `${baseUrl}/api/documents/salary-slip/${payslipId}/render`;
          const htmlRes = await fetch(htmlUrl, {
            method: "POST",
            headers: fwdHeaders,
            body: JSON.stringify({ format: "html" }),
          });
          if (!htmlRes.ok) {
            console.warn("[SEND-PAYSLIP-BULK] Failed to fetch HTML, status:", htmlRes.status);
            throw new Error("HTML fetch failed");
          }
          const payslipHtml = await htmlRes.text();

          // Step 2: Convert HTML to PDF
          const pdfUrl = `${baseUrl}/api/documents/raw-html-to-pdf`;
          const pdfRes = await fetch(pdfUrl, {
            method: "POST",
            headers: fwdHeaders,
            body: JSON.stringify({ html: payslipHtml }),
          });
          if (!pdfRes.ok) {
            console.warn("[SEND-PAYSLIP-BULK] Failed to generate PDF, status:", pdfRes.status);
            throw new Error("PDF generation failed");
          }
          const arrayBuffer = await pdfRes.arrayBuffer();
          const buffer = Buffer.from(arrayBuffer);
          if (buffer.length > 0) {
            const safeName = `Payslip_${p.period_name.replace(/\s+/g, "_")}_${p.first_name}_${p.last_name}.pdf`;
            attachments.push({
              filename: safeName,
              content: buffer,
              contentType: "application/pdf",
            });
            console.log(`[SEND-PAYSLIP-BULK] PDF attached: ${safeName} (${buffer.length} bytes)`);
          }
        } catch (e) {
          console.warn(
            "[SEND-PAYSLIP-BULK] Warning: Error generating PDF attachment:",
            e.message,
          );
        }

        await sendMail({
          to: p.email,
          subject: `Your Payslip for ${p.period_name}`,
          html,
          attachments,
        });
        count++;
      }
    }

    res.json({ message: `${count} payslip(s) sent successfully` });
  } catch (err) {
    next(err);
  }
}

/**
 * Setup - Employment Types
 */
export async function listEmploymentTypes(req, res, next) {
  try {
    await ensureHRTables();
    const { companyId } = req.scope;
    const items = await query(
      `SELECT * FROM hr_setup_employment_types WHERE company_id = :companyId ORDER BY name ASC`,
      { companyId },
    );
    res.json({ items });
  } catch (err) {
    next(err);
  }
}

export async function saveEmploymentType(req, res, next) {
  try {
    await ensureHRTables();
    const { companyId } = req.scope;
    const { id, name } = req.body;
    if (id) {
      await query(
        `UPDATE hr_setup_employment_types SET name = :name WHERE id = :id AND company_id = :companyId`,
        { id, name, companyId },
      );
    } else {
      await query(
        `INSERT INTO hr_setup_employment_types (company_id, name) VALUES (:companyId, :name)`,
        { companyId, name },
      );
    }
    res.json({ message: "Employment type saved" });
  } catch (err) {
    next(err);
  }
}

/**
 * Setup - Employee Categories
 */
export async function listEmployeeCategories(req, res, next) {
  try {
    await ensureHRTables();
    const { companyId } = req.scope;
    const items = await query(
      `SELECT * FROM hr_setup_employee_categories WHERE company_id = :companyId ORDER BY name ASC`,
      { companyId },
    );
    res.json({ items });
  } catch (err) {
    next(err);
  }
}

export async function saveEmployeeCategory(req, res, next) {
  try {
    await ensureHRTables();
    const { companyId } = req.scope;
    const { id, name } = req.body;
    if (id) {
      await query(
        `UPDATE hr_setup_employee_categories SET name = :name WHERE id = :id AND company_id = :companyId`,
        { id, name, companyId },
      );
    } else {
      await query(
        `INSERT INTO hr_setup_employee_categories (company_id, name) VALUES (:companyId, :name)`,
        { companyId, name },
      );
    }
    res.json({ message: "Employee category saved" });
  } catch (err) {
    next(err);
  }
}

/**
 * Setup - Allowance Types
 */
export async function listAllowanceTypes(req, res, next) {
  try {
    await ensureHRTables();
    const { companyId } = req.scope;
    const items = await query(
      `SELECT * FROM hr_setup_allowance_types WHERE company_id = :companyId ORDER BY name ASC`,
      { companyId },
    );
    res.json({ items });
  } catch (err) {
    next(err);
  }
}

export async function saveAllowanceType(req, res, next) {
  try {
    await ensureHRTables();
    const { companyId } = req.scope;
    const { id, name } = req.body;
    if (id) {
      await query(
        `UPDATE hr_setup_allowance_types SET name = :name WHERE id = :id AND company_id = :companyId`,
        { id, name, companyId },
      );
    } else {
      await query(
        `INSERT INTO hr_setup_allowance_types (company_id, name) VALUES (:companyId, :name)`,
        { companyId, name },
      );
    }
    res.json({ message: "Allowance type saved" });
  } catch (err) {
    next(err);
  }
}

/**
 * Work Schedules — link employees to shifts and off days
 */
async function ensureWorkSchedulesTable() {
  await query(
    `CREATE TABLE IF NOT EXISTS hr_work_schedules (
      id INT AUTO_INCREMENT PRIMARY KEY,
      company_id INT NOT NULL,
      employee_id INT NOT NULL,
      shift_id INT,
      off_days JSON,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uq_emp_schedule (company_id, employee_id)
    )`,
    {},
  );
}

export async function listWorkSchedules(req, res, next) {
  try {
    await ensureWorkSchedulesTable();
    const { companyId } = req.scope;
    const items = await query(
      `SELECT ws.*, 
              e.emp_code, e.first_name, e.last_name, e.status as emp_status,
              s.code as shift_code, s.name as shift_name, s.start_time, s.end_time, s.break_minutes
       FROM hr_work_schedules ws
       JOIN hr_employees e ON e.id = ws.employee_id AND e.deleted_at IS NULL
       LEFT JOIN hr_shifts s ON s.id = ws.shift_id
       WHERE ws.company_id = :companyId
       ORDER BY e.first_name ASC, e.last_name ASC`,
      { companyId },
    );
    res.json({ items });
  } catch (err) {
    next(err);
  }
}

export async function saveWorkSchedule(req, res, next) {
  try {
    await ensureWorkSchedulesTable();
    const { companyId } = req.scope;
    const { id, employee_id, shift_id, off_days, is_active } = req.body;

    if (id) {
      await query(
        `UPDATE hr_work_schedules 
         SET shift_id = :shift_id, off_days = :off_days, is_active = :is_active
         WHERE id = :id AND company_id = :companyId`,
        {
          id,
          shift_id: shift_id || null,
          off_days: JSON.stringify(off_days || []),
          is_active: is_active !== false ? 1 : 0,
          companyId,
        },
      );
      res.json({ message: "Work schedule updated" });
    } else {
      await query(
        `INSERT INTO hr_work_schedules (company_id, employee_id, shift_id, off_days, is_active)
         VALUES (:companyId, :employee_id, :shift_id, :off_days, 1)
         ON DUPLICATE KEY UPDATE shift_id = VALUES(shift_id), off_days = VALUES(off_days), is_active = VALUES(is_active)`,
        {
          companyId,
          employee_id,
          shift_id: shift_id || null,
          off_days: JSON.stringify(off_days || []),
        },
      );
      res.json({ message: "Work schedule saved" });
    }
  } catch (err) {
    next(err);
  }
}

// ============================================================
//  LEAVE MANAGEMENT ERP – Enterprise Leave System
//  Priority: APPLICATION > SCHEDULE > ROSTER
// ============================================================

async function ensureLeaveTables() {
  // Leave Types (e.g. Annual, Sick, Maternity)
  await query(
    `CREATE TABLE IF NOT EXISTS hr_leave_types (
      id              INT AUTO_INCREMENT PRIMARY KEY,
      company_id      INT NOT NULL,
      type_name       VARCHAR(100) NOT NULL,
      max_days        INT DEFAULT 0,
      is_paid         TINYINT(1) DEFAULT 1,
      is_active       TINYINT(1) DEFAULT 1,
      created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uq_type (company_id, type_name)
    )`,
    {},
  );
  try {
    const hasIsActive = await hasColumn("hr_leave_types", "is_active");
    if (!hasIsActive) {
      await query(
        "ALTER TABLE hr_leave_types ADD COLUMN is_active TINYINT(1) DEFAULT 1 AFTER is_paid",
        {},
      );
    }
    const hasMaxDays = await hasColumn("hr_leave_types", "max_days");
    if (!hasMaxDays) {
      await query(
        "ALTER TABLE hr_leave_types ADD COLUMN max_days INT DEFAULT 0 AFTER type_name",
        {},
      );
    }
  } catch {}

  // Leave Records – master audit log
  await query(
    `CREATE TABLE IF NOT EXISTS hr_leave_records (
      id              INT AUTO_INCREMENT PRIMARY KEY,
      company_id      INT NOT NULL,
      employee_id     INT NOT NULL,
      leave_type_id   INT,
      start_date      DATE NOT NULL,
      end_date        DATE NOT NULL,
      total_days      DECIMAL(5,1) DEFAULT 0,
      source          ENUM('APPLICATION','SCHEDULE','ROSTER') NOT NULL DEFAULT 'APPLICATION',
      status          ENUM('ACTIVE','OVERRIDDEN','CANCELLED') NOT NULL DEFAULT 'ACTIVE',
      reason          TEXT,
      remarks         TEXT,
      created_by      INT,
      created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_emp_dates (employee_id, start_date, end_date),
      INDEX idx_company_status (company_id, status),
      INDEX idx_source (source)
    )`,
    {},
  );

  // Leave Balances – allocation per employee per year per leave type
  await query(
    `CREATE TABLE IF NOT EXISTS hr_leave_balances (
      id              INT AUTO_INCREMENT PRIMARY KEY,
      company_id      INT NOT NULL,
      employee_id     INT NOT NULL,
      leave_type_id   INT NOT NULL,
      year            INT NOT NULL,
      allocated_days  DECIMAL(5,1) DEFAULT 0,
      created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uq_emp_type_year (company_id, employee_id, leave_type_id, year)
    )`,
    {},
  );
}

// ── Leave Types ──────────────────────────────────────────────
export async function listLeaveTypes(req, res, next) {
  try {
    await ensureLeaveTables();
    const { companyId } = req.scope;
    const items = await query(
      `SELECT * FROM hr_leave_types WHERE company_id = :companyId AND is_active = 1 ORDER BY type_name ASC`,
      { companyId },
    );
    res.json({ items });
  } catch (err) {
    next(err);
  }
}

export async function getLeaveType(req, res, next) {
  try {
    const { companyId } = req.scope;
    const { id } = req.params;
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
    await ensureLeaveTables();
    const { companyId } = req.scope;
    const { id, type_name, max_days, is_paid, is_active } = req.body;
    if (id) {
      await query(
        `UPDATE hr_leave_types SET type_name=:type_name, max_days=:max_days, is_paid=:is_paid, is_active=:is_active
         WHERE id=:id AND company_id=:companyId`,
        {
          id,
          type_name,
          max_days: toNumber(max_days, 0),
          is_paid: is_paid ? 1 : 0,
          is_active: is_active ? 1 : 0,
          companyId,
        },
      );
      res.json({ message: "Leave type updated" });
    } else {
      const r = await query(
        `INSERT INTO hr_leave_types (company_id, type_name, max_days, is_paid, is_active)
         VALUES (:companyId, :type_name, :max_days, :is_paid, 1)`,
        {
          companyId,
          type_name,
          max_days: toNumber(max_days, 0),
          is_paid: is_paid !== false ? 1 : 0,
        },
      );
      res.status(201).json({ id: r.insertId, message: "Leave type created" });
    }
  } catch (err) {
    next(err);
  }
}

// ── Dashboard ────────────────────────────────────────────────
export async function getLeaveDashboard(req, res, next) {
  try {
    await ensureLeaveTables();
    const { companyId } = req.scope;
    const today = new Date().toISOString().slice(0, 10);
    const currentYear = new Date().getFullYear();
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 14);
    const futureIso = futureDate.toISOString().slice(0, 10);

    const [onLeaveRows, upcomingRows, totalRows] = await Promise.all([
      query(
        `SELECT COUNT(DISTINCT employee_id) AS cnt
         FROM hr_leave_records
         WHERE company_id = :companyId AND status = 'ACTIVE'
           AND start_date <= :today AND end_date >= :today`,
        { companyId, today },
      ),
      query(
        `SELECT COUNT(DISTINCT employee_id) AS cnt
         FROM hr_leave_records
         WHERE company_id = :companyId AND status = 'ACTIVE'
           AND start_date > :today AND start_date <= :futureIso`,
        { companyId, today, futureIso },
      ),
      query(
        `SELECT COALESCE(SUM(total_days), 0) AS total
         FROM hr_leave_records
         WHERE company_id = :companyId AND status = 'ACTIVE'
           AND YEAR(start_date) = :currentYear`,
        { companyId, currentYear },
      ),
    ]);

    res.json({
      onLeaveToday: Number(onLeaveRows[0]?.cnt || 0),
      upcomingLeave: Number(upcomingRows[0]?.cnt || 0),
      totalUsedThisYear: Number(totalRows[0]?.total || 0),
    });
  } catch (err) {
    next(err);
  }
}

// ── Apply Leave (APPLICATION – highest priority) ─────────────
export async function applyLeave(req, res, next) {
  const conn = await pool.getConnection();
  try {
    await ensureLeaveTables();
    await conn.beginTransaction();
    const { companyId } = req.scope;
    const { employee_id, leave_type_id, start_date, end_date, reason } =
      req.body;

    if (!employee_id || !leave_type_id || !start_date || !end_date) {
      throw httpError(
        400,
        "VALIDATION",
        "employee_id, leave_type_id, start_date and end_date are required",
      );
    }

    const totalDays =
      (new Date(end_date).getTime() - new Date(start_date).getTime()) /
        (1000 * 3600 * 24) +
      1;

    // Mark overlapping ACTIVE records as OVERRIDDEN
    await conn.query(
      `UPDATE hr_leave_records
       SET status = 'OVERRIDDEN', updated_at = NOW()
       WHERE company_id = ? AND employee_id = ? AND status = 'ACTIVE'
         AND source IN ('SCHEDULE','ROSTER')
         AND start_date <= ? AND end_date >= ?`,
      [companyId, employee_id, end_date, start_date],
    );

    // Insert new APPLICATION record
    const [result] = await conn.query(
      `INSERT INTO hr_leave_records
         (company_id, employee_id, leave_type_id, start_date, end_date, total_days, source, status, reason, created_by)
       VALUES (?, ?, ?, ?, ?, ?, 'APPLICATION', 'ACTIVE', ?, ?)`,
      [
        companyId,
        employee_id,
        leave_type_id,
        start_date,
        end_date,
        totalDays,
        reason || null,
        req.user?.id || null,
      ],
    );

    await conn.commit();

    // Email HR notification (fire-and-forget)
    try {
      const [empRow] = await conn.query(
        `SELECT e.first_name, e.last_name, e.emp_code, lt.type_name
         FROM hr_employees e
         LEFT JOIN hr_leave_types lt ON lt.id = ?
         WHERE e.id = ? LIMIT 1`,
        [leave_type_id, employee_id],
      );
      const emp = empRow;
      if (emp) {
        sendMail({
          to: "hr@company.com",
          subject: `Leave Application – ${emp.first_name} ${emp.last_name} (${emp.emp_code})`,
          html: `<p><strong>${emp.first_name} ${emp.last_name}</strong> has applied for <strong>${emp.type_name}</strong> leave from <strong>${start_date}</strong> to <strong>${end_date}</strong> (${totalDays} day(s)).</p>${reason ? `<p>Reason: ${reason}</p>` : ""}`,
        }).catch(() => {});
      }
    } catch {}

    res.status(201).json({
      id: result.insertId,
      message: "Leave application submitted",
      totalDays,
    });
  } catch (err) {
    await conn.rollback();
    next(err);
  } finally {
    conn.release();
  }
}

// ── Schedule Leave (HR assigns, SCHEDULE priority) ───────────
export async function scheduleLeave(req, res, next) {
  try {
    await ensureLeaveTables();
    const { companyId } = req.scope;
    const { employee_ids, leave_type_id, start_date, end_date, remarks } =
      req.body;

    if (!Array.isArray(employee_ids) || !employee_ids.length) {
      throw httpError(
        400,
        "VALIDATION",
        "employee_ids must be a non-empty array",
      );
    }
    if (!leave_type_id || !start_date || !end_date) {
      throw httpError(
        400,
        "VALIDATION",
        "leave_type_id, start_date and end_date are required",
      );
    }

    const totalDays =
      (new Date(end_date).getTime() - new Date(start_date).getTime()) /
        (1000 * 3600 * 24) +
      1;

    let scheduled = 0;
    const employeeDetails = [];

    for (const empId of employee_ids) {
      // Skip if APPLICATION already covers this period (APPLICATION wins)
      const existing = await query(
        `SELECT id FROM hr_leave_records
         WHERE company_id = :companyId AND employee_id = :empId
           AND status = 'ACTIVE' AND source = 'APPLICATION'
           AND start_date <= :end_date AND end_date >= :start_date
         LIMIT 1`,
        { companyId, empId, start_date, end_date },
      );
      if (existing.length) continue; // APPLICATION has priority, skip

      await query(
        `INSERT INTO hr_leave_records
           (company_id, employee_id, leave_type_id, start_date, end_date, total_days, source, status, remarks, created_by)
         VALUES (:companyId, :empId, :leave_type_id, :start_date, :end_date, :totalDays, 'SCHEDULE', 'ACTIVE', :remarks, :createdBy)`,
        {
          companyId,
          empId,
          leave_type_id,
          start_date,
          end_date,
          totalDays,
          remarks: remarks || null,
          createdBy: req.user?.id || null,
        },
      );
      scheduled++;
      employeeDetails.push(empId);
    }

    // Notify employees (fire-and-forget)
    try {
      const empRows = await query(
        `SELECT e.first_name, e.last_name, e.email, lt.type_name
         FROM hr_employees e
         LEFT JOIN hr_leave_types lt ON lt.id = :leave_type_id
         WHERE e.id IN (${employeeDetails.map(() => "?").join(",")}) AND e.email IS NOT NULL`,
        {
          leave_type_id,
          ...Object.fromEntries(employeeDetails.map((id, i) => [i, id])),
        },
      );
      for (const emp of empRows || []) {
        if (emp.email) {
          sendMail({
            to: emp.email,
            subject: `Leave Scheduled: ${emp.type_name} (${start_date} – ${end_date})`,
            html: `<p>Dear ${emp.first_name},</p><p>HR has scheduled <strong>${emp.type_name}</strong> leave for you from <strong>${start_date}</strong> to <strong>${end_date}</strong> (${totalDays} day(s)).</p>`,
          }).catch(() => {});
        }
      }
    } catch {}

    res.json({ scheduled, message: `${scheduled} leave record(s) scheduled` });
  } catch (err) {
    next(err);
  }
}

// ── Roster Leave (annual plan, lowest priority) ───────────────
export async function saveLeaveRoster(req, res, next) {
  try {
    await ensureLeaveTables();
    const { companyId } = req.scope;
    const { year, items } = req.body;

    if (!Array.isArray(items) || !items.length) {
      throw httpError(400, "VALIDATION", "items must be a non-empty array");
    }

    let rostered = 0;
    for (const item of items) {
      const { employee_id, leave_type_id, start_date, end_date } = item;
      if (!employee_id || !start_date || !end_date) continue;

      const totalDays =
        (new Date(end_date).getTime() - new Date(start_date).getTime()) /
          (1000 * 3600 * 24) +
        1;

      // Only insert if no APPLICATION or SCHEDULE covering same period
      const existing = await query(
        `SELECT id FROM hr_leave_records
         WHERE company_id = :companyId AND employee_id = :employee_id
           AND status = 'ACTIVE' AND source IN ('APPLICATION','SCHEDULE')
           AND start_date <= :end_date AND end_date >= :start_date
         LIMIT 1`,
        { companyId, employee_id, start_date, end_date },
      );
      if (existing.length) continue;

      await query(
        `INSERT INTO hr_leave_records
           (company_id, employee_id, leave_type_id, start_date, end_date, total_days, source, status, remarks, created_by)
         VALUES (:companyId, :employee_id, :leave_type_id, :start_date, :end_date, :totalDays, 'ROSTER', 'ACTIVE', :remarks, :createdBy)`,
        {
          companyId,
          employee_id,
          leave_type_id: leave_type_id || null,
          start_date,
          end_date,
          totalDays,
          remarks: year ? `Roster ${year}` : null,
          createdBy: req.user?.id || null,
        },
      );
      rostered++;
    }

    res.json({ rostered, message: `${rostered} roster record(s) saved` });
  } catch (err) {
    next(err);
  }
}

// ── List Leave Records (full audit trail) ────────────────────
export async function listLeaveRecords(req, res, next) {
  try {
    await ensureLeaveTables();
    const { companyId } = req.scope;
    const { employee_id, source, status, start_date, end_date, dept_id, q } =
      req.query;

    const clauses = ["lr.company_id = :companyId"];
    const params = { companyId };

    if (employee_id) {
      clauses.push("lr.employee_id = :employee_id");
      params.employee_id = toNumber(employee_id, null);
    }
    if (source && source !== "ALL") {
      clauses.push("lr.source = :source");
      params.source = source;
    }
    if (status && status !== "ALL") {
      clauses.push("lr.status = :status");
      params.status = status;
    }
    if (start_date) {
      clauses.push("lr.end_date >= :start_date");
      params.start_date = start_date;
    }
    if (end_date) {
      clauses.push("lr.start_date <= :end_date");
      params.end_date = end_date;
    }
    if (dept_id && dept_id !== "ALL") {
      clauses.push("e.dept_id = :dept_id");
      params.dept_id = toNumber(dept_id, null);
    }
    if (q) {
      clauses.push(
        "(e.first_name LIKE :q OR e.last_name LIKE :q OR e.emp_code LIKE :q)",
      );
      params.q = `%${q}%`;
    }

    const where = `WHERE ${clauses.join(" AND ")}`;

    const items = await query(
      `SELECT lr.id, lr.employee_id, lr.leave_type_id, lr.start_date, lr.end_date, lr.total_days,
              lr.source, lr.status, lr.reason, lr.remarks, lr.created_at, lr.updated_at,
              e.first_name, e.last_name, e.emp_code,
              d.dept_name,
              lt.type_name
       FROM hr_leave_records lr
       JOIN hr_employees e ON e.id = lr.employee_id AND e.deleted_at IS NULL
       LEFT JOIN hr_departments d ON d.id = e.dept_id
       LEFT JOIN hr_leave_types lt ON lt.id = lr.leave_type_id
       ${where}
       ORDER BY lr.created_at DESC`,
      params,
    );

    res.json({ items });
  } catch (err) {
    next(err);
  }
}

// ── Delete Leave Record ──────────────────────────────────────
export async function deleteLeaveRecord(req, res, next) {
  try {
    const { companyId } = req.scope;
    const { id } = req.params;
    const rows = await query(
      `SELECT id FROM hr_leave_records WHERE id = :id AND company_id = :companyId LIMIT 1`,
      { id, companyId },
    );
    if (!rows.length) throw httpError(404, "NOT_FOUND", "Record not found");
    await query(`DELETE FROM hr_leave_records WHERE id = :id`, { id });
    res.json({ message: "Leave record deleted" });
  } catch (err) {
    next(err);
  }
}

// ── Update Leave Record ──────────────────────────────────────
export async function updateLeave(req, res, next) {
  try {
    const { companyId } = req.scope;
    const { id } = req.params;
    const { start_date, end_date, status, remarks, leave_type_id } = req.body;

    const rows = await query(
      `SELECT id FROM hr_leave_records WHERE id = :id AND company_id = :companyId LIMIT 1`,
      { id, companyId },
    );
    if (!rows.length) throw httpError(404, "NOT_FOUND", "Record not found");

    let totalDays = null;
    if (start_date && end_date) {
      totalDays =
        (new Date(end_date).getTime() - new Date(start_date).getTime()) /
          (1000 * 3600 * 24) +
        1;
    }

    await query(
      `UPDATE hr_leave_records
       SET start_date   = COALESCE(:start_date, start_date),
           end_date     = COALESCE(:end_date, end_date),
           total_days   = COALESCE(:total_days, total_days),
           status       = COALESCE(:status, status),
           remarks      = COALESCE(:remarks, remarks),
           leave_type_id = COALESCE(:leave_type_id, leave_type_id)
       WHERE id = :id`,
      {
        id,
        start_date: start_date || null,
        end_date: end_date || null,
        total_days: totalDays,
        status: status || null,
        remarks: remarks || null,
        leave_type_id: leave_type_id || null,
      },
    );
    res.json({ message: "Leave record updated" });
  } catch (err) {
    next(err);
  }
}

// ── Leave Calendar (ACTIVE only, color by source) ────────────
export async function leaveCalendar(req, res, next) {
  try {
    await ensureLeaveTables();
    const { companyId } = req.scope;
    const { year, month } = req.query;

    const clauses = ["lr.company_id = :companyId", "lr.status = 'ACTIVE'"];
    const params = { companyId };

    if (year && month) {
      // Get records that overlap the given month
      const firstDay = `${year}-${String(month).padStart(2, "0")}-01`;
      const lastDay = new Date(Number(year), Number(month), 0)
        .toISOString()
        .slice(0, 10); // last day of month
      clauses.push("lr.start_date <= :lastDay AND lr.end_date >= :firstDay");
      params.firstDay = firstDay;
      params.lastDay = lastDay;
    } else if (year) {
      clauses.push("YEAR(lr.start_date) = :year");
      params.year = year;
    }

    const where = `WHERE ${clauses.join(" AND ")}`;

    const events = await query(
      `SELECT lr.id, lr.employee_id, lr.start_date, lr.end_date, lr.total_days, lr.source, lr.status,
              e.first_name, e.last_name, e.emp_code,
              lt.type_name
       FROM hr_leave_records lr
       JOIN hr_employees e ON e.id = lr.employee_id AND e.deleted_at IS NULL
       LEFT JOIN hr_leave_types lt ON lt.id = lr.leave_type_id
       ${where}
       ORDER BY lr.start_date ASC`,
      params,
    );

    res.json({ events });
  } catch (err) {
    next(err);
  }
}

// ── Leave Balances (dynamic: allocated vs used) ──────────────
export async function listLeaveBalances(req, res, next) {
  try {
    await ensureLeaveTables();
    const { companyId } = req.scope;
    const { year, dept_id, employee_id } = req.query;
    const currentYear = year ? Number(year) : new Date().getFullYear();

    const clauses = [
      "e.company_id = :companyId",
      "e.deleted_at IS NULL",
      "e.status = 'ACTIVE'",
    ];
    const params = { companyId, currentYear };

    if (dept_id && dept_id !== "ALL") {
      clauses.push("e.dept_id = :dept_id");
      params.dept_id = toNumber(dept_id, null);
    }
    if (employee_id) {
      clauses.push("e.id = :employee_id");
      params.employee_id = toNumber(employee_id, null);
    }

    const where = `WHERE ${clauses.join(" AND ")}`;

    const items = await query(
      `SELECT
         e.id AS employee_id,
         e.emp_code,
         e.first_name,
         e.last_name,
         d.dept_name,
         lt.id AS leave_type_id,
         lt.type_name,
         COALESCE(lb.allocated_days, lt.max_days, 0)    AS allocated_days,
         COALESCE(SUM(CASE WHEN lr.status = 'ACTIVE' AND YEAR(lr.start_date) = :currentYear THEN lr.total_days ELSE 0 END), 0) AS used_days
       FROM hr_employees e
       LEFT JOIN hr_departments d ON d.id = e.dept_id
       CROSS JOIN hr_leave_types lt ON lt.company_id = :companyId AND lt.is_active = 1
       LEFT JOIN hr_leave_balances lb
         ON lb.employee_id = e.id AND lb.leave_type_id = lt.id AND lb.year = :currentYear AND lb.company_id = :companyId
       LEFT JOIN hr_leave_records lr
         ON lr.employee_id = e.id AND lr.leave_type_id = lt.id AND lr.company_id = :companyId
       ${where}
       GROUP BY e.id, lt.id, lb.allocated_days, lt.max_days
       ORDER BY e.first_name ASC, lt.type_name ASC`,
      params,
    );

    res.json({ items, year: currentYear });
  } catch (err) {
    next(err);
  }
}
