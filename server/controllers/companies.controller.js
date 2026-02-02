import { query } from "../db/pool.js";
import { httpError } from "../utils/httpError.js";
import { hasColumn, toNumber, ensureBranchColumns } from "../utils/dbUtils.js";

export const ensureCompanyColumns = async () => {
  const table = "adm_companies";
  await query(`
    CREATE TABLE IF NOT EXISTS ${table} (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      name VARCHAR(255) NOT NULL,
      code VARCHAR(100) NOT NULL,
      is_active TINYINT(1) DEFAULT 1,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uq_company_code (code)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  if (!(await hasColumn(table, "address"))) {
    await query(`ALTER TABLE ${table} ADD COLUMN address VARCHAR(255) NULL`);
  }
  if (!(await hasColumn(table, "city"))) {
    await query(`ALTER TABLE ${table} ADD COLUMN city VARCHAR(100) NULL`);
  }
  if (!(await hasColumn(table, "state"))) {
    await query(`ALTER TABLE ${table} ADD COLUMN state VARCHAR(100) NULL`);
  }
  if (!(await hasColumn(table, "postal_code"))) {
    await query(`ALTER TABLE ${table} ADD COLUMN postal_code VARCHAR(20) NULL`);
  }
  if (!(await hasColumn(table, "country"))) {
    await query(`ALTER TABLE ${table} ADD COLUMN country VARCHAR(100) NULL`);
  }
  if (!(await hasColumn(table, "telephone"))) {
    await query(`ALTER TABLE ${table} ADD COLUMN telephone VARCHAR(50) NULL`);
  }
  if (!(await hasColumn(table, "email"))) {
    await query(`ALTER TABLE ${table} ADD COLUMN email VARCHAR(255) NULL`);
  }
  if (!(await hasColumn(table, "website"))) {
    await query(`ALTER TABLE ${table} ADD COLUMN website VARCHAR(255) NULL`);
  }
  if (!(await hasColumn(table, "tax_id"))) {
    await query(`ALTER TABLE ${table} ADD COLUMN tax_id VARCHAR(100) NULL`);
  }
  if (!(await hasColumn(table, "registration_no"))) {
    await query(
      `ALTER TABLE ${table} ADD COLUMN registration_no VARCHAR(100) NULL`,
    );
  }
  if (!(await hasColumn(table, "fiscal_year_start_month"))) {
    await query(
      `ALTER TABLE ${table} ADD COLUMN fiscal_year_start_month TINYINT UNSIGNED DEFAULT 1`,
    );
  }
  if (!(await hasColumn(table, "timezone"))) {
    await query(`ALTER TABLE ${table} ADD COLUMN timezone VARCHAR(64) NULL`);
  }
  if (!(await hasColumn(table, "currency_id"))) {
    await query(
      `ALTER TABLE ${table} ADD COLUMN currency_id BIGINT UNSIGNED NULL`,
    );
  }
  if (!(await hasColumn(table, "logo"))) {
    await query(`ALTER TABLE ${table} ADD COLUMN logo LONGBLOB NULL`);
  }
};

export const mangeCompanies = async (req, res, next) => {
  try {
    const { name, code, is_active } = req.body || {};
    if (!name || !code)
      throw httpError(400, "VALIDATION_ERROR", "name and code are required");

    await ensureCompanyColumns();
    const result = await query(
      "INSERT INTO adm_companies (name, code, is_active) VALUES (:name, :code, :is_active)",
      {
        name,
        code,
        is_active: is_active === undefined ? 1 : Number(Boolean(is_active)),
      },
    );
    res.status(201).json({ id: result.insertId });
  } catch (err) {
    next(err);
  }
};

export const updateCompanies = async (req, res, next) => {
  try {
    const id = toNumber(req.params.id);
    if (!id) throw httpError(400, "VALIDATION_ERROR", "Invalid id");

    await ensureCompanyColumns();
    const {
      name,
      code,
      is_active,
      address,
      city,
      state,
      postal_code,
      country,
      telephone,
      email,
      website,
      tax_id,
      registration_no,
      fiscal_year_start_month,
      timezone,
      currency_id,
    } = req.body || {};
    if (!name || !code)
      throw httpError(400, "VALIDATION_ERROR", "name and code are required");

    const baseParams = {
      id,
      name,
      code,
      is_active: is_active === undefined ? 1 : Number(Boolean(is_active)),
    };
    const optional = {
      address,
      city,
      state,
      postal_code,
      country,
      telephone,
      email,
      website,
      tax_id,
      registration_no,
      fiscal_year_start_month:
        fiscal_year_start_month !== undefined
          ? toNumber(fiscal_year_start_month, 1)
          : undefined,
      timezone,
      currency_id:
        currency_id !== undefined ? toNumber(currency_id, null) : undefined,
    };
    const setClauses = [
      "name = :name",
      "code = :code",
      "is_active = :is_active",
    ];
    const params = { ...baseParams };
    for (const [key, val] of Object.entries(optional)) {
      if (val !== undefined) {
        setClauses.push(`${key} = :${key}`);
        params[key] = val;
      }
    }
    const sql = `UPDATE adm_companies SET ${setClauses.join(
      ", ",
    )} WHERE id = :id`;
    const result = await query(sql, params);
    res.json({ affectedRows: result.affectedRows });
  } catch (err) {
    next(err);
  }
};

export const getCompanies = async (req, res, next) => {
  try {
    try {
      await ensureCompanyColumns();
    } catch {}
    const companyIds = Array.isArray(req.user?.companyIds)
      ? req.user.companyIds
          .map((x) => Number(x))
          .filter((n) => Number.isFinite(n))
      : [];
    const { active } = req.query || {};
    const filters = [];
    const params = {};
    if (companyIds.length) {
      const keys = companyIds.map((_, i) => `:cid${i}`);
      filters.push(`id IN (${keys.join(",")})`);
      companyIds.forEach((v, i) => (params[`cid${i}`] = v));
    }
    if (typeof active !== "undefined" && active !== "") {
      filters.push("is_active = :is_active");
      params.is_active = Number(Boolean(active));
    }
    const where = filters.length ? `WHERE ${filters.join(" AND ")}` : "";
    const items = await query(
      `SELECT id, name, code, is_active, created_at FROM adm_companies ${where} ORDER BY name ASC`,
      params,
    );
    res.json({ items });
  } catch (err) {
    next(err);
  }
};

export const getCompanyById = async (req, res, next) => {
  try {
    const id = toNumber(req.params.id);
    if (!id) throw httpError(400, "VALIDATION_ERROR", "Invalid id");

    try {
      await ensureCompanyColumns();
    } catch {}

    let items = [];
    try {
      items = await query(
        `SELECT id, name, code, is_active, created_at,
                address, city, state, postal_code, country,
                telephone, email, website, tax_id, registration_no,
                fiscal_year_start_month, timezone, currency_id,
                CASE WHEN logo IS NULL THEN 0 ELSE 1 END AS has_logo
         FROM adm_companies 
         WHERE id = :id LIMIT 1`,
        { id },
      );
    } catch (err) {
      items = await query(
        `SELECT id, name, code, is_active, created_at,
                address, city, state, postal_code, country,
                telephone, email, website, tax_id, registration_no,
                fiscal_year_start_month, timezone, currency_id
         FROM adm_companies 
         WHERE id = :id LIMIT 1`,
        { id },
      );
      if (items.length) {
        items[0].has_logo = 0;
      }
    }
    if (!items.length) throw httpError(404, "NOT_FOUND", "Company not found");

    res.json({ item: items[0] });
  } catch (err) {
    next(err);
  }
};

export const uploadCompanyLogo = async (req, res, next) => {
  try {
    const id = toNumber(req.params.id);
    if (!id) throw httpError(400, "VALIDATION_ERROR", "Invalid id");
    if (!req.file) throw httpError(400, "VALIDATION_ERROR", "No file uploaded");
    await ensureCompanyColumns();
    await query("UPDATE adm_companies SET logo = :blob WHERE id = :id", {
      blob: req.file.buffer,
      id,
    });
    res.status(204).end();
  } catch (err) {
    next(err);
  }
};

export const getCompanyLogo = async (req, res, next) => {
  try {
    const id = toNumber(req.params.id);
    if (!id) throw httpError(400, "VALIDATION_ERROR", "Invalid id");
    await ensureCompanyColumns();
    const rows = await query(
      "SELECT logo FROM adm_companies WHERE id = :id LIMIT 1",
      { id },
    );
    if (!rows.length || !rows[0].logo) {
      throw httpError(404, "NOT_FOUND", "Company logo not found");
    }
    res.setHeader("Content-Type", "image/*");
    res.send(rows[0].logo);
  } catch (err) {
    next(err);
  }
};

export const getBranches = async (req, res, next) => {
  try {
    await ensureBranchColumns();
    const companyIds = Array.isArray(req.user?.companyIds)
      ? req.user.companyIds
          .map((x) => Number(x))
          .filter((n) => Number.isFinite(n))
      : [];
    const { active } = req.query || {};
    const filters = [];
    const params = {};
    if (companyIds.length) {
      const keys = companyIds.map((_, i) => `:cid${i}`);
      filters.push(`b.company_id IN (${keys.join(",")})`);
      companyIds.forEach((v, i) => (params[`cid${i}`] = v));
    }
    if (typeof active !== "undefined" && active !== "") {
      filters.push("b.is_active = :is_active");
      params.is_active = Number(Boolean(active));
    }
    const where = filters.length ? `WHERE ${filters.join(" AND ")}` : "";

    const items = await query(
      `SELECT b.*, c.name as company_name
         FROM adm_branches b
         JOIN adm_companies c ON b.company_id = c.id
         ${where}
         ORDER BY c.name ASC, b.name ASC`,
      params,
    );
    res.json({ items });
  } catch (err) {
    next(err);
  }
};

export const getBranchById = async (req, res, next) => {
  try {
    await ensureBranchColumns();
    const id = toNumber(req.params.id);
    if (!id) throw httpError(400, "VALIDATION_ERROR", "Invalid id");
    const branchIds = Array.isArray(req.user?.branchIds)
      ? req.user.branchIds
          .map((x) => Number(x))
          .filter((n) => Number.isFinite(n))
      : [];
    if (branchIds.length && !branchIds.includes(id)) {
      throw httpError(403, "FORBIDDEN", "Branch access denied");
    }

    const items = await query(
      "SELECT * FROM adm_branches WHERE id = :id LIMIT 1",
      { id },
    );
    if (!items.length) throw httpError(404, "NOT_FOUND", "Branch not found");

    res.json({ item: items[0] });
  } catch (err) {
    next(err);
  }
};

export const createBranch = async (req, res, next) => {
  try {
    await ensureBranchColumns();
    // const { companyId } = req.scope;
    // We expect company_id in body now for global setup
    const {
      company_id,
      name,
      code,
      is_active,
      address,
      city,
      state,
      postal_code,
      country,
      location,
      telephone,
      email,
      remarks,
    } = req.body || {};

    if (!company_id)
      throw httpError(400, "VALIDATION_ERROR", "company_id is required");
    if (!name || !code)
      throw httpError(400, "VALIDATION_ERROR", "name and code are required");

    const result = await query(
      `INSERT INTO adm_branches (
          company_id, name, code, is_active,
          address, city, state, postal_code, country,
          location, telephone, email, remarks
        ) VALUES (
          :company_id, :name, :code, :is_active,
          :address, :city, :state, :postal_code, :country,
          :location, :telephone, :email, :remarks
        )`,
      {
        company_id,
        name,
        code,
        is_active: is_active === undefined ? 1 : Number(Boolean(is_active)),
        address: address || null,
        city: city || null,
        state: state || null,
        postal_code: postal_code || null,
        country: country || null,
        location: location || null,
        telephone: telephone || null,
        email: email || null,
        remarks: remarks || null,
      },
    );
    res.status(201).json({ id: result.insertId });
  } catch (err) {
    next(err);
  }
};

export const updateBranch = async (req, res, next) => {
  try {
    await ensureBranchColumns();
    // const { companyId } = req.scope;
    const id = toNumber(req.params.id);
    if (!id) throw httpError(400, "VALIDATION_ERROR", "Invalid id");

    const {
      company_id,
      name,
      code,
      is_active,
      address,
      city,
      state,
      postal_code,
      country,
      location,
      telephone,
      email,
      remarks,
    } = req.body || {};

    if (!company_id)
      throw httpError(400, "VALIDATION_ERROR", "company_id is required");
    if (!name || !code)
      throw httpError(400, "VALIDATION_ERROR", "name and code are required");

    const result = await query(
      `UPDATE adm_branches
         SET company_id = :company_id,
             name = :name,
             code = :code,
             is_active = :is_active,
             address = :address,
             city = :city,
             state = :state,
             postal_code = :postal_code,
             country = :country,
             location = :location,
             telephone = :telephone,
             email = :email,
             remarks = :remarks
         WHERE id = :id`,
      {
        id,
        company_id,
        name,
        code,
        is_active: is_active === undefined ? 1 : Number(Boolean(is_active)),
        address: address || null,
        city: city || null,
        state: state || null,
        postal_code: postal_code || null,
        country: country || null,
        location: location || null,
        telephone: telephone || null,
        email: email || null,
        remarks: remarks || null,
      },
    );
    res.json({ affectedRows: result.affectedRows });
  } catch (err) {
    next(err);
  }
};

export const getDepartments = async (req, res, next) => {
  try {
    const { company_id, branch_id } = req.query;
    const userBranchIds = Array.isArray(req.user?.branchIds)
      ? req.user.branchIds
          .map((x) => Number(x))
          .filter((n) => Number.isFinite(n))
      : [];
    let queryStr = `
        SELECT d.id, d.company_id, d.branch_id, d.name, d.code, d.is_active, d.created_at,
               c.name as company_name, b.name as branch_name
        FROM adm_departments d
        JOIN adm_companies c ON d.company_id = c.id
        LEFT JOIN adm_branches b ON d.branch_id = b.id
        WHERE 1=1
      `;
    const params = {};

    const companyId = company_id || req.scope?.companyId;
    if (companyId) {
      queryStr += " AND d.company_id = :companyId";
      params.companyId = companyId;
    }
    const effectiveBranchId = branch_id
      ? Number(branch_id)
      : req.scope?.branchId;
    if (Number.isFinite(effectiveBranchId)) {
      if (userBranchIds.length && !userBranchIds.includes(effectiveBranchId)) {
        throw httpError(403, "FORBIDDEN", "Branch access denied");
      }
      queryStr += " AND (d.branch_id = :branchId OR d.branch_id IS NULL)";
      params.branchId = effectiveBranchId;
    } else if (userBranchIds.length) {
      const keys = userBranchIds.map((_, i) => `:bid${i}`);
      queryStr += ` AND (d.branch_id IN (${keys.join(
        ",",
      )}) OR d.branch_id IS NULL)`;
      userBranchIds.forEach((v, i) => (params[`bid${i}`] = v));
    } else {
      queryStr += " AND d.branch_id IS NULL";
    }

    queryStr += " AND d.is_active = 1";
    queryStr += " ORDER BY c.name ASC, b.name ASC, d.name ASC";

    const items = await query(queryStr, params);
    res.json({ items });
  } catch (err) {
    next(err);
  }
};

export const updateDepartment = async (req, res, next) => {
  try {
    const id = toNumber(req.params.id);
    if (!id) throw httpError(400, "VALIDATION_ERROR", "Invalid id");

    const { company_id, branch_id, name, code, is_active } = req.body || {};

    if (!company_id)
      throw httpError(400, "VALIDATION_ERROR", "company_id is required");
    if (!name || !code)
      throw httpError(400, "VALIDATION_ERROR", "name and code are required");

    const result = await query(
      "UPDATE adm_departments SET company_id = :company_id, branch_id = :branch_id, name = :name, code = :code, is_active = :is_active WHERE id = :id",
      {
        id,
        company_id,
        branch_id: branch_id || null,
        name,
        code,
        is_active: is_active === undefined ? 1 : Number(Boolean(is_active)),
      },
    );
    res.json({ affectedRows: result.affectedRows });
  } catch (err) {
    next(err);
  }
};

export const getDepartmentById = async (req, res, next) => {
  try {
    const id = toNumber(req.params.id);
    if (!id) throw httpError(400, "VALIDATION_ERROR", "Invalid id");
    const items = await query(
      "SELECT * FROM adm_departments WHERE id = :id LIMIT 1",
      { id },
    );
    if (!items.length)
      throw httpError(404, "NOT_FOUND", "Department not found");
    res.json({
      success: true,
      message: "Department fetched",
      data: { item: items[0] },
    });
  } catch (err) {
    next(err);
  }
};

export const createDepartment = async (req, res, next) => {
  try {
    const { company_id, branch_id, name, code, is_active } = req.body || {};
    if (!company_id)
      throw httpError(400, "VALIDATION_ERROR", "company_id is required");
    if (!name || !code)
      throw httpError(400, "VALIDATION_ERROR", "name and code are required");
    const result = await query(
      "INSERT INTO adm_departments (company_id, branch_id, name, code, is_active) VALUES (:company_id, :branch_id, :name, :code, :is_active)",
      {
        company_id,
        branch_id: branch_id || null,
        name,
        code,
        is_active: is_active === undefined ? 1 : Number(Boolean(is_active)),
      },
    );
    res.status(201).json({
      success: true,
      message: "Department created",
      data: { id: result.insertId },
    });
  } catch (err) {
    next(err);
  }
};
