import { query } from "../db/pool.js";
import { httpError } from "../utils/httpError.js";

function toNumber(v, fallback = null) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

export const listEmployees = async (req, res, next) => {
  try {
    const { companyId, branchId } = req.scope;
    const items = await query(
      `SELECT id, emp_no, full_name, designation, department, email, contact_no, employment_type, date_joined, is_active, created_at
       FROM hr_employees WHERE company_id = :companyId AND branch_id = :branchId ORDER BY full_name ASC`,
      { companyId, branchId },
    );
    res.json({ items });
  } catch (err) {
    next(err);
  }
};

export const getEmployeeById = async (req, res, next) => {
  try {
    const { companyId, branchId } = req.scope;
    const id = toNumber(req.params.id);
    if (!id) throw httpError(400, "VALIDATION_ERROR", "Invalid id");
    const items = await query(
      `SELECT * FROM hr_employees WHERE id = :id AND company_id = :companyId AND branch_id = :branchId LIMIT 1`,
      { id, companyId, branchId },
    );
    if (!items.length)
      throw httpError(404, "NOT_FOUND", "Employee not found");
    res.json({ item: items[0] });
  } catch (err) {
    next(err);
  }
};

export const createEmployee = async (req, res, next) => {
  try {
    const { companyId, branchId } = req.scope;
    const {
      emp_no,
      full_name,
      designation,
      department,
      email,
      contact_no,
      employment_type,
      date_joined,
      is_active,
    } = req.body || {};
    if (!full_name || !emp_no)
      throw httpError(
        400,
        "VALIDATION_ERROR",
        "full_name and emp_no are required",
      );
    const result = await query(
      `INSERT INTO hr_employees (company_id, branch_id, emp_no, full_name, designation, department, email, contact_no, employment_type, date_joined, is_active)
       VALUES (:companyId, :branchId, :emp_no, :full_name, :designation, :department, :email, :contact_no, :employment_type, :date_joined, :is_active)`,
      {
        companyId,
        branchId,
        emp_no,
        full_name,
        designation: designation || null,
        department: department || null,
        email: email || null,
        contact_no: contact_no || null,
        employment_type: employment_type || "PERMANENT",
        date_joined: date_joined || null,
        is_active: is_active === undefined ? 1 : Number(Boolean(is_active)),
      },
    );
    res.status(201).json({ id: result.insertId });
  } catch (err) {
    next(err);
  }
};

export const updateEmployee = async (req, res, next) => {
  try {
    const { companyId, branchId } = req.scope;
    const id = toNumber(req.params.id);
    if (!id) throw httpError(400, "VALIDATION_ERROR", "Invalid id");
    const {
      emp_no,
      full_name,
      designation,
      department,
      email,
      contact_no,
      employment_type,
      date_joined,
      is_active,
    } = req.body || {};
    if (!full_name)
      throw httpError(400, "VALIDATION_ERROR", "full_name is required");
    const result = await query(
      `UPDATE hr_employees SET emp_no = :emp_no, full_name = :full_name, designation = :designation, department = :department, email = :email, contact_no = :contact_no, employment_type = :employment_type, date_joined = :date_joined, is_active = :is_active
       WHERE id = :id AND company_id = :companyId AND branch_id = :branchId`,
      {
        id,
        companyId,
        branchId,
        emp_no,
        full_name,
        designation: designation || null,
        department: department || null,
        email: email || null,
        contact_no: contact_no || null,
        employment_type: employment_type || "PERMANENT",
        date_joined: date_joined || null,
        is_active: is_active === undefined ? 1 : Number(Boolean(is_active)),
      },
    );
    res.json({ affectedRows: result.affectedRows });
  } catch (err) {
    next(err);
  }
};

export const listAttendance = async (req, res, next) => {
  try {
    const { companyId, branchId } = req.scope;
    const items = await query(
      `SELECT ar.*, e.full_name, e.emp_no FROM hr_attendance_records ar
       JOIN hr_employees e ON ar.employee_id = e.id
       WHERE ar.company_id = :companyId AND ar.branch_id = :branchId ORDER BY ar.attendance_date DESC`,
      { companyId, branchId },
    );
    res.json({ items });
  } catch (err) {
    next(err);
  }
};

export const createAttendance = async (req, res, next) => {
  try {
    const { companyId, branchId } = req.scope;
    const { employee_id, attendance_date, status, remarks } = req.body || {};
    if (!employee_id || !attendance_date || !status)
      throw httpError(
        400,
        "VALIDATION_ERROR",
        "employee_id, attendance_date, and status are required",
      );
    const result = await query(
      `INSERT INTO hr_attendance_records (company_id, branch_id, employee_id, attendance_date, status, remarks)
       VALUES (:companyId, :branchId, :employee_id, :attendance_date, :status, :remarks)`,
      {
        companyId,
        branchId,
        employee_id,
        attendance_date,
        status,
        remarks: remarks || null,
      },
    );
    res.status(201).json({ id: result.insertId });
  } catch (err) {
    next(err);
  }
};

export const listLeave = async (req, res, next) => {
  try {
    const { companyId, branchId } = req.scope;
    const items = await query(
      `SELECT la.*, e.full_name, e.emp_no, lt.name as leave_type_name FROM hr_leave_applications la
       JOIN hr_employees e ON la.employee_id = e.id
       JOIN hr_leave_types lt ON la.leave_type_id = lt.id
       WHERE la.company_id = :companyId AND la.branch_id = :branchId ORDER BY la.from_date DESC`,
      { companyId, branchId },
    );
    res.json({ items });
  } catch (err) {
    next(err);
  }
};

export const createLeave = async (req, res, next) => {
  try {
    const { companyId, branchId } = req.scope;
    const { employee_id, leave_type_id, from_date, to_date, reason, status } =
      req.body || {};
    if (!employee_id || !leave_type_id || !from_date || !to_date)
      throw httpError(
        400,
        "VALIDATION_ERROR",
        "employee_id, leave_type_id, from_date, and to_date are required",
      );
    const result = await query(
      `INSERT INTO hr_leave_applications (company_id, branch_id, employee_id, leave_type_id, from_date, to_date, reason, status)
       VALUES (:companyId, :branchId, :employee_id, :leave_type_id, :from_date, :to_date, :reason, :status)`,
      {
        companyId,
        branchId,
        employee_id,
        leave_type_id,
        from_date,
        to_date,
        reason: reason || null,
        status: status || "PENDING",
      },
    );
    res.status(201).json({ id: result.insertId });
  } catch (err) {
    next(err);
  }
};

export const listLeaveTypes = async (req, res, next) => {
  try {
    const { companyId } = req.scope;
    const items = await query(
      `SELECT id, name, code, is_active FROM hr_leave_types WHERE company_id = :companyId ORDER BY name ASC`,
      { companyId },
    );
    res.json({ items });
  } catch (err) {
    next(err);
  }
};
