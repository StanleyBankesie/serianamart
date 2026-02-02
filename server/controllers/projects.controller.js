import { query } from "../db/pool.js";
import { httpError } from "../utils/httpError.js";

function toNumber(v, fallback = null) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

export const listProjects = async (req, res, next) => {
  try {
    const { companyId, branchId } = req.scope;
    const items = await query(
      `SELECT id, project_code, project_name, project_status, start_date, end_date, created_at FROM pm_projects 
       WHERE company_id = :companyId AND branch_id = :branchId ORDER BY start_date DESC LIMIT 100`,
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

    const items = await query(
      `SELECT * FROM pm_projects WHERE id = :id AND company_id = :companyId AND branch_id = :branchId LIMIT 1`,
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
    const {
      project_code,
      project_name,
      project_status,
      start_date,
      end_date,
      remarks,
    } = req.body || {};

    if (!project_code || !project_name)
      throw httpError(
        400,
        "VALIDATION_ERROR",
        "project_code and project_name are required",
      );

    const result = await query(
      `INSERT INTO pm_projects (company_id, branch_id, project_code, project_name, project_status, start_date, end_date, remarks)
       VALUES (:companyId, :branchId, :project_code, :project_name, :project_status, :start_date, :end_date, :remarks)`,
      {
        companyId,
        branchId,
        project_code,
        project_name,
        project_status: project_status || "PLANNING",
        start_date: start_date || null,
        end_date: end_date || null,
        remarks: remarks || null,
      },
    );

    res.status(201).json({ id: result.insertId });
  } catch (err) {
    next(err);
  }
};

