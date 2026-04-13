import { query } from "../db/pool.js";
import { httpError } from "../utils/httpError.js";

function toNumber(v, fallback = null) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

async function ensureTables(companyId, branchId) {
  await query(`CREATE TABLE IF NOT EXISTS maint_requests (
    id INT AUTO_INCREMENT PRIMARY KEY,
    company_id INT NOT NULL, branch_id INT NOT NULL,
    request_no VARCHAR(50), request_date DATE,
    requester_name VARCHAR(200), department VARCHAR(200),
    asset_id INT, asset_name VARCHAR(200),
    maintenance_type VARCHAR(100), priority VARCHAR(50) DEFAULT 'NORMAL',
    description TEXT, status VARCHAR(50) DEFAULT 'DRAFT',
    notes TEXT, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

  await query(`CREATE TABLE IF NOT EXISTS maint_job_orders (
    id INT AUTO_INCREMENT PRIMARY KEY,
    company_id INT NOT NULL, branch_id INT NOT NULL,
    order_no VARCHAR(50), order_date DATE,
    request_id INT, asset_id INT, asset_name VARCHAR(200),
    order_type VARCHAR(100), assigned_team VARCHAR(200),
    assigned_technician VARCHAR(200), scheduled_date DATE,
    instructions TEXT, status VARCHAR(50) DEFAULT 'DRAFT',
    notes TEXT, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

  await query(`CREATE TABLE IF NOT EXISTS maint_rfqs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    company_id INT NOT NULL, branch_id INT NOT NULL,
    rfq_no VARCHAR(50), rfq_date DATE,
    request_id INT, scope_of_work TEXT,
    response_deadline DATE, status VARCHAR(50) DEFAULT 'DRAFT',
    notes TEXT, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

  await query(`CREATE TABLE IF NOT EXISTS maint_rfq_suppliers (
    id INT AUTO_INCREMENT PRIMARY KEY,
    rfq_id INT NOT NULL, supplier_id INT, supplier_name VARCHAR(200)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

  await query(`CREATE TABLE IF NOT EXISTS maint_supplier_quotations (
    id INT AUTO_INCREMENT PRIMARY KEY,
    company_id INT NOT NULL, branch_id INT NOT NULL,
    quotation_no VARCHAR(50), quotation_date DATE,
    rfq_id INT, supplier_id INT, supplier_name VARCHAR(200),
    subtotal DECIMAL(18,4) DEFAULT 0, tax_amount DECIMAL(18,4) DEFAULT 0,
    total_amount DECIMAL(18,4) DEFAULT 0,
    currency VARCHAR(10) DEFAULT 'GHS', exchange_rate DECIMAL(18,6) DEFAULT 1,
    status VARCHAR(50) DEFAULT 'DRAFT',
    notes TEXT, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

  await query(`CREATE TABLE IF NOT EXISTS maint_quotation_lines (
    id INT AUTO_INCREMENT PRIMARY KEY,
    quotation_id INT NOT NULL,
    description VARCHAR(500), qty DECIMAL(18,4) DEFAULT 1,
    rate DECIMAL(18,4) DEFAULT 0, discount_percent DECIMAL(8,4) DEFAULT 0,
    tax_code_id INT, amount DECIMAL(18,4) DEFAULT 0
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

  await query(`CREATE TABLE IF NOT EXISTS maint_job_executions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    company_id INT NOT NULL, branch_id INT NOT NULL,
    execution_no VARCHAR(50), job_order_id INT,
    start_date DATE, end_date DATE,
    technicians TEXT, work_done TEXT,
    materials_used TEXT, completion_status VARCHAR(50) DEFAULT 'IN_PROGRESS',
    sign_off_by VARCHAR(200), status VARCHAR(50) DEFAULT 'DRAFT',
    notes TEXT, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

  await query(`CREATE TABLE IF NOT EXISTS maint_bills (
    id INT AUTO_INCREMENT PRIMARY KEY,
    company_id INT NOT NULL, branch_id INT NOT NULL,
    bill_no VARCHAR(50), bill_date DATE, due_date DATE,
    execution_id INT, supplier_id INT, supplier_name VARCHAR(200),
    subtotal DECIMAL(18,4) DEFAULT 0, discount_amount DECIMAL(18,4) DEFAULT 0,
    tax_amount DECIMAL(18,4) DEFAULT 0, other_charges DECIMAL(18,4) DEFAULT 0,
    total_amount DECIMAL(18,4) DEFAULT 0,
    currency VARCHAR(10) DEFAULT 'GHS', exchange_rate DECIMAL(18,6) DEFAULT 1,
    payment_terms VARCHAR(100), payment_method VARCHAR(50),
    payment_reference VARCHAR(200), payment_status VARCHAR(50) DEFAULT 'UNPAID',
    status VARCHAR(50) DEFAULT 'DRAFT',
    notes TEXT, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

  await query(`CREATE TABLE IF NOT EXISTS maint_bill_lines (
    id INT AUTO_INCREMENT PRIMARY KEY,
    bill_id INT NOT NULL, description VARCHAR(500),
    category VARCHAR(100), qty DECIMAL(18,4) DEFAULT 1,
    rate DECIMAL(18,4) DEFAULT 0, discount_percent DECIMAL(8,4) DEFAULT 0,
    tax_code_id INT, amount DECIMAL(18,4) DEFAULT 0
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

  await query(`CREATE TABLE IF NOT EXISTS maint_schedules (
    id INT AUTO_INCREMENT PRIMARY KEY,
    company_id INT NOT NULL, branch_id INT NOT NULL,
    schedule_name VARCHAR(200), asset_id INT, asset_name VARCHAR(200),
    frequency VARCHAR(50), next_due_date DATE,
    assigned_to VARCHAR(200), description TEXT,
    status VARCHAR(50) DEFAULT 'ACTIVE',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

  await query(`CREATE TABLE IF NOT EXISTS maint_rosters (
    id INT AUTO_INCREMENT PRIMARY KEY,
    company_id INT NOT NULL, branch_id INT NOT NULL,
    roster_name VARCHAR(200), period_start DATE, period_end DATE,
    team_members TEXT, shift_details TEXT,
    status VARCHAR(50) DEFAULT 'DRAFT',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

  await query(`CREATE TABLE IF NOT EXISTS maint_equipment (
    id INT AUTO_INCREMENT PRIMARY KEY,
    company_id INT NOT NULL, branch_id INT NOT NULL,
    equipment_code VARCHAR(100), equipment_name VARCHAR(200),
    category VARCHAR(100), location VARCHAR(200),
    manufacturer VARCHAR(200), model VARCHAR(200),
    serial_number VARCHAR(200), purchase_date DATE,
    warranty_expiry DATE, status VARCHAR(50) DEFAULT 'ACTIVE',
    notes TEXT, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

  await query(`CREATE TABLE IF NOT EXISTS maint_parameters (
    id INT AUTO_INCREMENT PRIMARY KEY,
    company_id INT NOT NULL, branch_id INT NOT NULL,
    param_key VARCHAR(100), param_value TEXT,
    UNIQUE KEY uq_param (company_id, branch_id, param_key)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

  await query(`CREATE TABLE IF NOT EXISTS maint_contracts (
    id INT AUTO_INCREMENT PRIMARY KEY,
    company_id INT NOT NULL, branch_id INT NOT NULL,
    contract_no VARCHAR(100), supplier_id INT, supplier_name VARCHAR(200),
    start_date DATE, end_date DATE, contract_value DECIMAL(18,4) DEFAULT 0,
    scope TEXT, payment_terms VARCHAR(200),
    renewal_alert_days INT DEFAULT 30,
    status VARCHAR(50) DEFAULT 'ACTIVE',
    notes TEXT, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

  await query(`CREATE TABLE IF NOT EXISTS maint_contract_assets (
    id INT AUTO_INCREMENT PRIMARY KEY,
    contract_id INT NOT NULL, asset_id INT, asset_name VARCHAR(200)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
}

// ===== HELPERS =====
function nextNo(prefix, rows) {
  if (!rows.length) return `${prefix}-000001`;
  const nums = rows.map(r => {
    const m = String(r.no || "").match(/(\d+)$/);
    return m ? Number(m[1]) : 0;
  });
  return `${prefix}-${String(Math.max(...nums) + 1).padStart(6, "0")}`;
}

// ===== WORK ORDERS (legacy kept) =====
export const listWorkOrders = async (req, res, next) => {
  try {
    const { companyId, branchId } = req.scope;
    const items = await query(
      `SELECT id, work_order_no, work_order_date, status, created_at FROM maint_work_orders WHERE company_id = :companyId AND branch_id = :branchId ORDER BY work_order_date DESC LIMIT 100`,
      { companyId, branchId }
    );
    res.json({ items });
  } catch (err) { next(err); }
};

export const getWorkOrderById = async (req, res, next) => {
  try {
    const { companyId, branchId } = req.scope;
    const id = toNumber(req.params.id);
    if (!id) throw httpError(400, "VALIDATION_ERROR", "Invalid id");
    const items = await query(
      `SELECT * FROM maint_work_orders WHERE id = :id AND company_id = :companyId AND branch_id = :branchId LIMIT 1`,
      { id, companyId, branchId }
    );
    if (!items.length) throw httpError(404, "NOT_FOUND", "Work order not found");
    res.json({ item: items[0] });
  } catch (err) { next(err); }
};

export const createWorkOrder = async (req, res, next) => {
  try {
    const { companyId, branchId } = req.scope;
    const { work_order_no, work_order_date, status, remarks } = req.body || {};
    if (!work_order_no || !work_order_date) throw httpError(400, "VALIDATION_ERROR", "work_order_no and work_order_date are required");
    const result = await query(
      `INSERT INTO maint_work_orders (company_id, branch_id, work_order_no, work_order_date, status, remarks) VALUES (:companyId, :branchId, :work_order_no, :work_order_date, :status, :remarks)`,
      { companyId, branchId, work_order_no, work_order_date, status: status || "DRAFT", remarks: remarks || null }
    );
    res.status(201).json({ id: result.insertId });
  } catch (err) { next(err); }
};

// ===== MAINTENANCE REQUESTS =====
export const listRequests = async (req, res, next) => {
  try {
    const { companyId, branchId } = req.scope;
    await ensureTables(companyId, branchId);
    const items = await query(
      `SELECT * FROM maint_requests WHERE company_id=:companyId AND branch_id=:branchId ORDER BY created_at DESC LIMIT 200`,
      { companyId, branchId }
    );
    res.json({ items });
  } catch (err) { next(err); }
};

export const getRequestById = async (req, res, next) => {
  try {
    const { companyId, branchId } = req.scope;
    const id = toNumber(req.params.id);
    await ensureTables(companyId, branchId);
    const rows = await query(`SELECT * FROM maint_requests WHERE id=:id AND company_id=:companyId AND branch_id=:branchId LIMIT 1`, { id, companyId, branchId });
    if (!rows.length) throw httpError(404, "NOT_FOUND", "Not found");
    res.json({ item: rows[0] });
  } catch (err) { next(err); }
};

export const createRequest = async (req, res, next) => {
  try {
    const { companyId, branchId } = req.scope;
    await ensureTables(companyId, branchId);
    const b = req.body || {};
    const existing = await query(`SELECT request_no AS no FROM maint_requests WHERE company_id=:companyId AND branch_id=:branchId`, { companyId, branchId });
    const request_no = b.request_no || nextNo("MRQ", existing);
    const r = await query(
      `INSERT INTO maint_requests (company_id,branch_id,request_no,request_date,requester_name,department,asset_id,asset_name,maintenance_type,priority,description,status,notes) VALUES (:companyId,:branchId,:request_no,:request_date,:requester_name,:department,:asset_id,:asset_name,:maintenance_type,:priority,:description,:status,:notes)`,
      { companyId, branchId, request_no, request_date: b.request_date || null, requester_name: b.requester_name || null, department: b.department || null, asset_id: toNumber(b.asset_id), asset_name: b.asset_name || null, maintenance_type: b.maintenance_type || null, priority: b.priority || "NORMAL", description: b.description || null, status: b.status || "DRAFT", notes: b.notes || null }
    );
    res.status(201).json({ id: r.insertId, request_no });
  } catch (err) { next(err); }
};

export const updateRequest = async (req, res, next) => {
  try {
    const { companyId, branchId } = req.scope;
    const id = toNumber(req.params.id);
    const b = req.body || {};
    await query(
      `UPDATE maint_requests SET request_date=:request_date,requester_name=:requester_name,department=:department,asset_id=:asset_id,asset_name=:asset_name,maintenance_type=:maintenance_type,priority=:priority,description=:description,status=:status,notes=:notes WHERE id=:id AND company_id=:companyId AND branch_id=:branchId`,
      { id, companyId, branchId, request_date: b.request_date || null, requester_name: b.requester_name || null, department: b.department || null, asset_id: toNumber(b.asset_id), asset_name: b.asset_name || null, maintenance_type: b.maintenance_type || null, priority: b.priority || "NORMAL", description: b.description || null, status: b.status || "DRAFT", notes: b.notes || null }
    );
    res.json({ ok: true });
  } catch (err) { next(err); }
};

// ===== JOB ORDERS =====
export const listJobOrders = async (req, res, next) => {
  try {
    const { companyId, branchId } = req.scope;
    await ensureTables(companyId, branchId);
    const items = await query(`SELECT * FROM maint_job_orders WHERE company_id=:companyId AND branch_id=:branchId ORDER BY created_at DESC LIMIT 200`, { companyId, branchId });
    res.json({ items });
  } catch (err) { next(err); }
};

export const getJobOrderById = async (req, res, next) => {
  try {
    const { companyId, branchId } = req.scope;
    const id = toNumber(req.params.id);
    await ensureTables(companyId, branchId);
    const rows = await query(`SELECT * FROM maint_job_orders WHERE id=:id AND company_id=:companyId AND branch_id=:branchId LIMIT 1`, { id, companyId, branchId });
    if (!rows.length) throw httpError(404, "NOT_FOUND", "Not found");
    res.json({ item: rows[0] });
  } catch (err) { next(err); }
};

export const createJobOrder = async (req, res, next) => {
  try {
    const { companyId, branchId } = req.scope;
    await ensureTables(companyId, branchId);
    const b = req.body || {};
    const existing = await query(`SELECT order_no AS no FROM maint_job_orders WHERE company_id=:companyId AND branch_id=:branchId`, { companyId, branchId });
    const order_no = b.order_no || nextNo("MJO", existing);
    const r = await query(
      `INSERT INTO maint_job_orders (company_id,branch_id,order_no,order_date,request_id,asset_id,asset_name,order_type,assigned_team,assigned_technician,scheduled_date,instructions,status,notes) VALUES (:companyId,:branchId,:order_no,:order_date,:request_id,:asset_id,:asset_name,:order_type,:assigned_team,:assigned_technician,:scheduled_date,:instructions,:status,:notes)`,
      { companyId, branchId, order_no, order_date: b.order_date || null, request_id: toNumber(b.request_id), asset_id: toNumber(b.asset_id), asset_name: b.asset_name || null, order_type: b.order_type || null, assigned_team: b.assigned_team || null, assigned_technician: b.assigned_technician || null, scheduled_date: b.scheduled_date || null, instructions: b.instructions || null, status: b.status || "DRAFT", notes: b.notes || null }
    );
    res.status(201).json({ id: r.insertId, order_no });
  } catch (err) { next(err); }
};

export const updateJobOrder = async (req, res, next) => {
  try {
    const { companyId, branchId } = req.scope;
    const id = toNumber(req.params.id);
    const b = req.body || {};
    await query(
      `UPDATE maint_job_orders SET order_date=:order_date,request_id=:request_id,asset_id=:asset_id,asset_name=:asset_name,order_type=:order_type,assigned_team=:assigned_team,assigned_technician=:assigned_technician,scheduled_date=:scheduled_date,instructions=:instructions,status=:status,notes=:notes WHERE id=:id AND company_id=:companyId AND branch_id=:branchId`,
      { id, companyId, branchId, order_date: b.order_date || null, request_id: toNumber(b.request_id), asset_id: toNumber(b.asset_id), asset_name: b.asset_name || null, order_type: b.order_type || null, assigned_team: b.assigned_team || null, assigned_technician: b.assigned_technician || null, scheduled_date: b.scheduled_date || null, instructions: b.instructions || null, status: b.status || "DRAFT", notes: b.notes || null }
    );
    res.json({ ok: true });
  } catch (err) { next(err); }
};

// ===== RFQ =====
export const listRFQs = async (req, res, next) => {
  try {
    const { companyId, branchId } = req.scope;
    await ensureTables(companyId, branchId);
    const items = await query(`SELECT r.*, GROUP_CONCAT(s.supplier_name) AS supplier_names FROM maint_rfqs r LEFT JOIN maint_rfq_suppliers s ON s.rfq_id=r.id WHERE r.company_id=:companyId AND r.branch_id=:branchId GROUP BY r.id ORDER BY r.created_at DESC LIMIT 200`, { companyId, branchId });
    res.json({ items });
  } catch (err) { next(err); }
};

export const getRFQById = async (req, res, next) => {
  try {
    const { companyId, branchId } = req.scope;
    const id = toNumber(req.params.id);
    await ensureTables(companyId, branchId);
    const rows = await query(`SELECT * FROM maint_rfqs WHERE id=:id AND company_id=:companyId AND branch_id=:branchId LIMIT 1`, { id, companyId, branchId });
    if (!rows.length) throw httpError(404, "NOT_FOUND", "Not found");
    const suppliers = await query(`SELECT * FROM maint_rfq_suppliers WHERE rfq_id=:id`, { id });
    res.json({ item: rows[0], suppliers });
  } catch (err) { next(err); }
};

export const createRFQ = async (req, res, next) => {
  try {
    const { companyId, branchId } = req.scope;
    await ensureTables(companyId, branchId);
    const b = req.body || {};
    const existing = await query(`SELECT rfq_no AS no FROM maint_rfqs WHERE company_id=:companyId AND branch_id=:branchId`, { companyId, branchId });
    const rfq_no = b.rfq_no || nextNo("MRFQ", existing);
    const r = await query(
      `INSERT INTO maint_rfqs (company_id,branch_id,rfq_no,rfq_date,request_id,scope_of_work,response_deadline,status,notes) VALUES (:companyId,:branchId,:rfq_no,:rfq_date,:request_id,:scope_of_work,:response_deadline,:status,:notes)`,
      { companyId, branchId, rfq_no, rfq_date: b.rfq_date || null, request_id: toNumber(b.request_id), scope_of_work: b.scope_of_work || null, response_deadline: b.response_deadline || null, status: b.status || "DRAFT", notes: b.notes || null }
    );
    const rfqId = r.insertId;
    if (Array.isArray(b.suppliers)) {
      for (const s of b.suppliers) {
        await query(`INSERT INTO maint_rfq_suppliers (rfq_id,supplier_id,supplier_name) VALUES (:rfqId,:supplier_id,:supplier_name)`, { rfqId, supplier_id: toNumber(s.supplier_id), supplier_name: s.supplier_name || null });
      }
    }
    res.status(201).json({ id: rfqId, rfq_no });
  } catch (err) { next(err); }
};

export const updateRFQ = async (req, res, next) => {
  try {
    const { companyId, branchId } = req.scope;
    const id = toNumber(req.params.id);
    const b = req.body || {};
    await query(`UPDATE maint_rfqs SET rfq_date=:rfq_date,request_id=:request_id,scope_of_work=:scope_of_work,response_deadline=:response_deadline,status=:status,notes=:notes WHERE id=:id AND company_id=:companyId AND branch_id=:branchId`,
      { id, companyId, branchId, rfq_date: b.rfq_date || null, request_id: toNumber(b.request_id), scope_of_work: b.scope_of_work || null, response_deadline: b.response_deadline || null, status: b.status || "DRAFT", notes: b.notes || null });
    if (Array.isArray(b.suppliers)) {
      await query(`DELETE FROM maint_rfq_suppliers WHERE rfq_id=:id`, { id });
      for (const s of b.suppliers) {
        await query(`INSERT INTO maint_rfq_suppliers (rfq_id,supplier_id,supplier_name) VALUES (:id,:supplier_id,:supplier_name)`, { id, supplier_id: toNumber(s.supplier_id), supplier_name: s.supplier_name || null });
      }
    }
    res.json({ ok: true });
  } catch (err) { next(err); }
};

// ===== SUPPLIER QUOTATIONS =====
export const listSupplierQuotations = async (req, res, next) => {
  try {
    const { companyId, branchId } = req.scope;
    await ensureTables(companyId, branchId);
    const items = await query(`SELECT * FROM maint_supplier_quotations WHERE company_id=:companyId AND branch_id=:branchId ORDER BY created_at DESC LIMIT 200`, { companyId, branchId });
    res.json({ items });
  } catch (err) { next(err); }
};

export const getSupplierQuotationById = async (req, res, next) => {
  try {
    const { companyId, branchId } = req.scope;
    const id = toNumber(req.params.id);
    await ensureTables(companyId, branchId);
    const rows = await query(`SELECT * FROM maint_supplier_quotations WHERE id=:id AND company_id=:companyId AND branch_id=:branchId LIMIT 1`, { id, companyId, branchId });
    if (!rows.length) throw httpError(404, "NOT_FOUND", "Not found");
    const lines = await query(`SELECT * FROM maint_quotation_lines WHERE quotation_id=:id`, { id });
    res.json({ item: rows[0], lines });
  } catch (err) { next(err); }
};

export const createSupplierQuotation = async (req, res, next) => {
  try {
    const { companyId, branchId } = req.scope;
    await ensureTables(companyId, branchId);
    const b = req.body || {};
    const existing = await query(`SELECT quotation_no AS no FROM maint_supplier_quotations WHERE company_id=:companyId AND branch_id=:branchId`, { companyId, branchId });
    const quotation_no = b.quotation_no || nextNo("MSQ", existing);
    const r = await query(
      `INSERT INTO maint_supplier_quotations (company_id,branch_id,quotation_no,quotation_date,rfq_id,supplier_id,supplier_name,subtotal,tax_amount,total_amount,currency,exchange_rate,status,notes) VALUES (:companyId,:branchId,:quotation_no,:quotation_date,:rfq_id,:supplier_id,:supplier_name,:subtotal,:tax_amount,:total_amount,:currency,:exchange_rate,:status,:notes)`,
      { companyId, branchId, quotation_no, quotation_date: b.quotation_date || null, rfq_id: toNumber(b.rfq_id), supplier_id: toNumber(b.supplier_id), supplier_name: b.supplier_name || null, subtotal: Number(b.subtotal || 0), tax_amount: Number(b.tax_amount || 0), total_amount: Number(b.total_amount || 0), currency: b.currency || "GHS", exchange_rate: Number(b.exchange_rate || 1), status: b.status || "DRAFT", notes: b.notes || null }
    );
    const qId = r.insertId;
    if (Array.isArray(b.lines)) {
      for (const l of b.lines) {
        await query(`INSERT INTO maint_quotation_lines (quotation_id,description,qty,rate,discount_percent,tax_code_id,amount) VALUES (:qId,:description,:qty,:rate,:discount_percent,:tax_code_id,:amount)`,
          { qId, description: l.description || null, qty: Number(l.qty || 1), rate: Number(l.rate || 0), discount_percent: Number(l.discount_percent || 0), tax_code_id: toNumber(l.tax_code_id), amount: Number(l.amount || 0) });
      }
    }
    res.status(201).json({ id: qId, quotation_no });
  } catch (err) { next(err); }
};

export const updateSupplierQuotation = async (req, res, next) => {
  try {
    const { companyId, branchId } = req.scope;
    const id = toNumber(req.params.id);
    const b = req.body || {};
    await query(`UPDATE maint_supplier_quotations SET quotation_date=:quotation_date,rfq_id=:rfq_id,supplier_id=:supplier_id,supplier_name=:supplier_name,subtotal=:subtotal,tax_amount=:tax_amount,total_amount=:total_amount,currency=:currency,exchange_rate=:exchange_rate,status=:status,notes=:notes WHERE id=:id AND company_id=:companyId AND branch_id=:branchId`,
      { id, companyId, branchId, quotation_date: b.quotation_date || null, rfq_id: toNumber(b.rfq_id), supplier_id: toNumber(b.supplier_id), supplier_name: b.supplier_name || null, subtotal: Number(b.subtotal || 0), tax_amount: Number(b.tax_amount || 0), total_amount: Number(b.total_amount || 0), currency: b.currency || "GHS", exchange_rate: Number(b.exchange_rate || 1), status: b.status || "DRAFT", notes: b.notes || null });
    if (Array.isArray(b.lines)) {
      await query(`DELETE FROM maint_quotation_lines WHERE quotation_id=:id`, { id });
      for (const l of b.lines) {
        await query(`INSERT INTO maint_quotation_lines (quotation_id,description,qty,rate,discount_percent,tax_code_id,amount) VALUES (:id,:description,:qty,:rate,:discount_percent,:tax_code_id,:amount)`,
          { id, description: l.description || null, qty: Number(l.qty || 1), rate: Number(l.rate || 0), discount_percent: Number(l.discount_percent || 0), tax_code_id: toNumber(l.tax_code_id), amount: Number(l.amount || 0) });
      }
    }
    res.json({ ok: true });
  } catch (err) { next(err); }
};

// ===== JOB EXECUTIONS =====
export const listJobExecutions = async (req, res, next) => {
  try {
    const { companyId, branchId } = req.scope;
    await ensureTables(companyId, branchId);
    const items = await query(`SELECT e.*, o.order_no FROM maint_job_executions e LEFT JOIN maint_job_orders o ON o.id=e.job_order_id WHERE e.company_id=:companyId AND e.branch_id=:branchId ORDER BY e.created_at DESC LIMIT 200`, { companyId, branchId });
    res.json({ items });
  } catch (err) { next(err); }
};

export const getJobExecutionById = async (req, res, next) => {
  try {
    const { companyId, branchId } = req.scope;
    const id = toNumber(req.params.id);
    await ensureTables(companyId, branchId);
    const rows = await query(`SELECT * FROM maint_job_executions WHERE id=:id AND company_id=:companyId AND branch_id=:branchId LIMIT 1`, { id, companyId, branchId });
    if (!rows.length) throw httpError(404, "NOT_FOUND", "Not found");
    res.json({ item: rows[0] });
  } catch (err) { next(err); }
};

export const createJobExecution = async (req, res, next) => {
  try {
    const { companyId, branchId } = req.scope;
    await ensureTables(companyId, branchId);
    const b = req.body || {};
    const existing = await query(`SELECT execution_no AS no FROM maint_job_executions WHERE company_id=:companyId AND branch_id=:branchId`, { companyId, branchId });
    const execution_no = b.execution_no || nextNo("MJE", existing);
    const r = await query(
      `INSERT INTO maint_job_executions (company_id,branch_id,execution_no,job_order_id,start_date,end_date,technicians,work_done,materials_used,completion_status,sign_off_by,status,notes) VALUES (:companyId,:branchId,:execution_no,:job_order_id,:start_date,:end_date,:technicians,:work_done,:materials_used,:completion_status,:sign_off_by,:status,:notes)`,
      { companyId, branchId, execution_no, job_order_id: toNumber(b.job_order_id), start_date: b.start_date || null, end_date: b.end_date || null, technicians: b.technicians || null, work_done: b.work_done || null, materials_used: b.materials_used || null, completion_status: b.completion_status || "IN_PROGRESS", sign_off_by: b.sign_off_by || null, status: b.status || "DRAFT", notes: b.notes || null }
    );
    res.status(201).json({ id: r.insertId, execution_no });
  } catch (err) { next(err); }
};

export const updateJobExecution = async (req, res, next) => {
  try {
    const { companyId, branchId } = req.scope;
    const id = toNumber(req.params.id);
    const b = req.body || {};
    await query(`UPDATE maint_job_executions SET job_order_id=:job_order_id,start_date=:start_date,end_date=:end_date,technicians=:technicians,work_done=:work_done,materials_used=:materials_used,completion_status=:completion_status,sign_off_by=:sign_off_by,status=:status,notes=:notes WHERE id=:id AND company_id=:companyId AND branch_id=:branchId`,
      { id, companyId, branchId, job_order_id: toNumber(b.job_order_id), start_date: b.start_date || null, end_date: b.end_date || null, technicians: b.technicians || null, work_done: b.work_done || null, materials_used: b.materials_used || null, completion_status: b.completion_status || "IN_PROGRESS", sign_off_by: b.sign_off_by || null, status: b.status || "DRAFT", notes: b.notes || null });
    res.json({ ok: true });
  } catch (err) { next(err); }
};

// ===== MAINTENANCE BILLS =====
export const listBills = async (req, res, next) => {
  try {
    const { companyId, branchId } = req.scope;
    await ensureTables(companyId, branchId);
    const items = await query(`SELECT * FROM maint_bills WHERE company_id=:companyId AND branch_id=:branchId ORDER BY created_at DESC LIMIT 200`, { companyId, branchId });
    res.json({ items });
  } catch (err) { next(err); }
};

export const getBillById = async (req, res, next) => {
  try {
    const { companyId, branchId } = req.scope;
    const id = toNumber(req.params.id);
    await ensureTables(companyId, branchId);
    const rows = await query(`SELECT * FROM maint_bills WHERE id=:id AND company_id=:companyId AND branch_id=:branchId LIMIT 1`, { id, companyId, branchId });
    if (!rows.length) throw httpError(404, "NOT_FOUND", "Not found");
    const lines = await query(`SELECT * FROM maint_bill_lines WHERE bill_id=:id`, { id });
    res.json({ item: rows[0], lines });
  } catch (err) { next(err); }
};

export const getNextBillNo = async (req, res, next) => {
  try {
    const { companyId, branchId } = req.scope;
    await ensureTables(companyId, branchId);
    const existing = await query(`SELECT bill_no AS no FROM maint_bills WHERE company_id=:companyId AND branch_id=:branchId`, { companyId, branchId });
    res.json({ nextNo: nextNo("MBL", existing) });
  } catch (err) { next(err); }
};

export const createBill = async (req, res, next) => {
  try {
    const { companyId, branchId } = req.scope;
    await ensureTables(companyId, branchId);
    const b = req.body || {};
    const existing = await query(`SELECT bill_no AS no FROM maint_bills WHERE company_id=:companyId AND branch_id=:branchId`, { companyId, branchId });
    const bill_no = b.bill_no || nextNo("MBL", existing);
    const r = await query(
      `INSERT INTO maint_bills (company_id,branch_id,bill_no,bill_date,due_date,execution_id,supplier_id,supplier_name,subtotal,discount_amount,tax_amount,other_charges,total_amount,currency,exchange_rate,payment_terms,payment_method,payment_reference,payment_status,status,notes) VALUES (:companyId,:branchId,:bill_no,:bill_date,:due_date,:execution_id,:supplier_id,:supplier_name,:subtotal,:discount_amount,:tax_amount,:other_charges,:total_amount,:currency,:exchange_rate,:payment_terms,:payment_method,:payment_reference,:payment_status,:status,:notes)`,
      { companyId, branchId, bill_no, bill_date: b.bill_date || null, due_date: b.due_date || null, execution_id: toNumber(b.execution_id), supplier_id: toNumber(b.supplier_id), supplier_name: b.supplier_name || null, subtotal: Number(b.subtotal || 0), discount_amount: Number(b.discount_amount || 0), tax_amount: Number(b.tax_amount || 0), other_charges: Number(b.other_charges || 0), total_amount: Number(b.total_amount || 0), currency: b.currency || "GHS", exchange_rate: Number(b.exchange_rate || 1), payment_terms: b.payment_terms || null, payment_method: b.payment_method || null, payment_reference: b.payment_reference || null, payment_status: b.payment_status || "UNPAID", status: b.status || "DRAFT", notes: b.notes || null }
    );
    const billId = r.insertId;
    if (Array.isArray(b.lines)) {
      for (const l of b.lines) {
        await query(`INSERT INTO maint_bill_lines (bill_id,description,category,qty,rate,discount_percent,tax_code_id,amount) VALUES (:billId,:description,:category,:qty,:rate,:discount_percent,:tax_code_id,:amount)`,
          { billId, description: l.description || null, category: l.category || null, qty: Number(l.qty || 1), rate: Number(l.rate || 0), discount_percent: Number(l.discount_percent || 0), tax_code_id: toNumber(l.tax_code_id), amount: Number(l.amount || 0) });
      }
    }
    res.status(201).json({ id: billId, bill_no });
  } catch (err) { next(err); }
};

export const updateBill = async (req, res, next) => {
  try {
    const { companyId, branchId } = req.scope;
    const id = toNumber(req.params.id);
    const b = req.body || {};
    await query(`UPDATE maint_bills SET bill_date=:bill_date,due_date=:due_date,execution_id=:execution_id,supplier_id=:supplier_id,supplier_name=:supplier_name,subtotal=:subtotal,discount_amount=:discount_amount,tax_amount=:tax_amount,other_charges=:other_charges,total_amount=:total_amount,currency=:currency,exchange_rate=:exchange_rate,payment_terms=:payment_terms,payment_method=:payment_method,payment_reference=:payment_reference,payment_status=:payment_status,status=:status,notes=:notes WHERE id=:id AND company_id=:companyId AND branch_id=:branchId`,
      { id, companyId, branchId, bill_date: b.bill_date || null, due_date: b.due_date || null, execution_id: toNumber(b.execution_id), supplier_id: toNumber(b.supplier_id), supplier_name: b.supplier_name || null, subtotal: Number(b.subtotal || 0), discount_amount: Number(b.discount_amount || 0), tax_amount: Number(b.tax_amount || 0), other_charges: Number(b.other_charges || 0), total_amount: Number(b.total_amount || 0), currency: b.currency || "GHS", exchange_rate: Number(b.exchange_rate || 1), payment_terms: b.payment_terms || null, payment_method: b.payment_method || null, payment_reference: b.payment_reference || null, payment_status: b.payment_status || "UNPAID", status: b.status || "DRAFT", notes: b.notes || null });
    if (Array.isArray(b.lines)) {
      await query(`DELETE FROM maint_bill_lines WHERE bill_id=:id`, { id });
      for (const l of b.lines) {
        await query(`INSERT INTO maint_bill_lines (bill_id,description,category,qty,rate,discount_percent,tax_code_id,amount) VALUES (:id,:description,:category,:qty,:rate,:discount_percent,:tax_code_id,:amount)`,
          { id, description: l.description || null, category: l.category || null, qty: Number(l.qty || 1), rate: Number(l.rate || 0), discount_percent: Number(l.discount_percent || 0), tax_code_id: toNumber(l.tax_code_id), amount: Number(l.amount || 0) });
      }
    }
    res.json({ ok: true });
  } catch (err) { next(err); }
};

// ===== SCHEDULES =====
export const listSchedules = async (req, res, next) => {
  try {
    const { companyId, branchId } = req.scope;
    await ensureTables(companyId, branchId);
    const items = await query(`SELECT * FROM maint_schedules WHERE company_id=:companyId AND branch_id=:branchId ORDER BY next_due_date ASC LIMIT 200`, { companyId, branchId });
    res.json({ items });
  } catch (err) { next(err); }
};

export const getScheduleById = async (req, res, next) => {
  try {
    const { companyId, branchId } = req.scope;
    const id = toNumber(req.params.id);
    await ensureTables(companyId, branchId);
    const rows = await query(`SELECT * FROM maint_schedules WHERE id=:id AND company_id=:companyId AND branch_id=:branchId LIMIT 1`, { id, companyId, branchId });
    if (!rows.length) throw httpError(404, "NOT_FOUND", "Not found");
    res.json({ item: rows[0] });
  } catch (err) { next(err); }
};

export const createSchedule = async (req, res, next) => {
  try {
    const { companyId, branchId } = req.scope;
    await ensureTables(companyId, branchId);
    const b = req.body || {};
    const r = await query(
      `INSERT INTO maint_schedules (company_id,branch_id,schedule_name,asset_id,asset_name,frequency,next_due_date,assigned_to,description,status) VALUES (:companyId,:branchId,:schedule_name,:asset_id,:asset_name,:frequency,:next_due_date,:assigned_to,:description,:status)`,
      { companyId, branchId, schedule_name: b.schedule_name || null, asset_id: toNumber(b.asset_id), asset_name: b.asset_name || null, frequency: b.frequency || null, next_due_date: b.next_due_date || null, assigned_to: b.assigned_to || null, description: b.description || null, status: b.status || "ACTIVE" }
    );
    res.status(201).json({ id: r.insertId });
  } catch (err) { next(err); }
};

export const updateSchedule = async (req, res, next) => {
  try {
    const { companyId, branchId } = req.scope;
    const id = toNumber(req.params.id);
    const b = req.body || {};
    await query(`UPDATE maint_schedules SET schedule_name=:schedule_name,asset_id=:asset_id,asset_name=:asset_name,frequency=:frequency,next_due_date=:next_due_date,assigned_to=:assigned_to,description=:description,status=:status WHERE id=:id AND company_id=:companyId AND branch_id=:branchId`,
      { id, companyId, branchId, schedule_name: b.schedule_name || null, asset_id: toNumber(b.asset_id), asset_name: b.asset_name || null, frequency: b.frequency || null, next_due_date: b.next_due_date || null, assigned_to: b.assigned_to || null, description: b.description || null, status: b.status || "ACTIVE" });
    res.json({ ok: true });
  } catch (err) { next(err); }
};

// ===== ROSTERS =====
export const listRosters = async (req, res, next) => {
  try {
    const { companyId, branchId } = req.scope;
    await ensureTables(companyId, branchId);
    const items = await query(`SELECT * FROM maint_rosters WHERE company_id=:companyId AND branch_id=:branchId ORDER BY period_start DESC LIMIT 200`, { companyId, branchId });
    res.json({ items });
  } catch (err) { next(err); }
};

export const getRosterById = async (req, res, next) => {
  try {
    const { companyId, branchId } = req.scope;
    const id = toNumber(req.params.id);
    await ensureTables(companyId, branchId);
    const rows = await query(`SELECT * FROM maint_rosters WHERE id=:id AND company_id=:companyId AND branch_id=:branchId LIMIT 1`, { id, companyId, branchId });
    if (!rows.length) throw httpError(404, "NOT_FOUND", "Not found");
    res.json({ item: rows[0] });
  } catch (err) { next(err); }
};

export const createRoster = async (req, res, next) => {
  try {
    const { companyId, branchId } = req.scope;
    await ensureTables(companyId, branchId);
    const b = req.body || {};
    const r = await query(
      `INSERT INTO maint_rosters (company_id,branch_id,roster_name,period_start,period_end,team_members,shift_details,status) VALUES (:companyId,:branchId,:roster_name,:period_start,:period_end,:team_members,:shift_details,:status)`,
      { companyId, branchId, roster_name: b.roster_name || null, period_start: b.period_start || null, period_end: b.period_end || null, team_members: b.team_members || null, shift_details: b.shift_details || null, status: b.status || "DRAFT" }
    );
    res.status(201).json({ id: r.insertId });
  } catch (err) { next(err); }
};

export const updateRoster = async (req, res, next) => {
  try {
    const { companyId, branchId } = req.scope;
    const id = toNumber(req.params.id);
    const b = req.body || {};
    await query(`UPDATE maint_rosters SET roster_name=:roster_name,period_start=:period_start,period_end=:period_end,team_members=:team_members,shift_details=:shift_details,status=:status WHERE id=:id AND company_id=:companyId AND branch_id=:branchId`,
      { id, companyId, branchId, roster_name: b.roster_name || null, period_start: b.period_start || null, period_end: b.period_end || null, team_members: b.team_members || null, shift_details: b.shift_details || null, status: b.status || "DRAFT" });
    res.json({ ok: true });
  } catch (err) { next(err); }
};

// ===== EQUIPMENT =====
export const listEquipment = async (req, res, next) => {
  try {
    const { companyId, branchId } = req.scope;
    await ensureTables(companyId, branchId);
    const items = await query(`SELECT * FROM maint_equipment WHERE company_id=:companyId AND branch_id=:branchId ORDER BY equipment_name ASC LIMIT 500`, { companyId, branchId });
    res.json({ items });
  } catch (err) { next(err); }
};

export const getEquipmentById = async (req, res, next) => {
  try {
    const { companyId, branchId } = req.scope;
    const id = toNumber(req.params.id);
    await ensureTables(companyId, branchId);
    const rows = await query(`SELECT * FROM maint_equipment WHERE id=:id AND company_id=:companyId AND branch_id=:branchId LIMIT 1`, { id, companyId, branchId });
    if (!rows.length) throw httpError(404, "NOT_FOUND", "Not found");
    res.json({ item: rows[0] });
  } catch (err) { next(err); }
};

export const createEquipment = async (req, res, next) => {
  try {
    const { companyId, branchId } = req.scope;
    await ensureTables(companyId, branchId);
    const b = req.body || {};
    const r = await query(
      `INSERT INTO maint_equipment (company_id,branch_id,equipment_code,equipment_name,category,location,manufacturer,model,serial_number,purchase_date,warranty_expiry,status,notes) VALUES (:companyId,:branchId,:equipment_code,:equipment_name,:category,:location,:manufacturer,:model,:serial_number,:purchase_date,:warranty_expiry,:status,:notes)`,
      { companyId, branchId, equipment_code: b.equipment_code || null, equipment_name: b.equipment_name || null, category: b.category || null, location: b.location || null, manufacturer: b.manufacturer || null, model: b.model || null, serial_number: b.serial_number || null, purchase_date: b.purchase_date || null, warranty_expiry: b.warranty_expiry || null, status: b.status || "ACTIVE", notes: b.notes || null }
    );
    res.status(201).json({ id: r.insertId });
  } catch (err) { next(err); }
};

export const updateEquipment = async (req, res, next) => {
  try {
    const { companyId, branchId } = req.scope;
    const id = toNumber(req.params.id);
    const b = req.body || {};
    await query(`UPDATE maint_equipment SET equipment_code=:equipment_code,equipment_name=:equipment_name,category=:category,location=:location,manufacturer=:manufacturer,model=:model,serial_number=:serial_number,purchase_date=:purchase_date,warranty_expiry=:warranty_expiry,status=:status,notes=:notes WHERE id=:id AND company_id=:companyId AND branch_id=:branchId`,
      { id, companyId, branchId, equipment_code: b.equipment_code || null, equipment_name: b.equipment_name || null, category: b.category || null, location: b.location || null, manufacturer: b.manufacturer || null, model: b.model || null, serial_number: b.serial_number || null, purchase_date: b.purchase_date || null, warranty_expiry: b.warranty_expiry || null, status: b.status || "ACTIVE", notes: b.notes || null });
    res.json({ ok: true });
  } catch (err) { next(err); }
};

// ===== PARAMETERS/SETUP =====
export const getParameters = async (req, res, next) => {
  try {
    const { companyId, branchId } = req.scope;
    await ensureTables(companyId, branchId);
    const rows = await query(`SELECT param_key, param_value FROM maint_parameters WHERE company_id=:companyId AND branch_id=:branchId`, { companyId, branchId });
    const params = {};
    for (const r of rows) params[r.param_key] = r.param_value;
    res.json({ params });
  } catch (err) { next(err); }
};

export const saveParameters = async (req, res, next) => {
  try {
    const { companyId, branchId } = req.scope;
    await ensureTables(companyId, branchId);
    const { params } = req.body || {};
    if (params && typeof params === "object") {
      for (const [k, v] of Object.entries(params)) {
        await query(`INSERT INTO maint_parameters (company_id,branch_id,param_key,param_value) VALUES (:companyId,:branchId,:k,:v) ON DUPLICATE KEY UPDATE param_value=:v`,
          { companyId, branchId, k, v: v != null ? String(v) : null });
      }
    }
    res.json({ ok: true });
  } catch (err) { next(err); }
};

// ===== CONTRACTS =====
export const listContracts = async (req, res, next) => {
  try {
    const { companyId, branchId } = req.scope;
    await ensureTables(companyId, branchId);
    const items = await query(`SELECT c.*, GROUP_CONCAT(a.asset_name) AS asset_names FROM maint_contracts c LEFT JOIN maint_contract_assets a ON a.contract_id=c.id WHERE c.company_id=:companyId AND c.branch_id=:branchId GROUP BY c.id ORDER BY c.created_at DESC LIMIT 200`, { companyId, branchId });
    res.json({ items });
  } catch (err) { next(err); }
};

export const getContractById = async (req, res, next) => {
  try {
    const { companyId, branchId } = req.scope;
    const id = toNumber(req.params.id);
    await ensureTables(companyId, branchId);
    const rows = await query(`SELECT * FROM maint_contracts WHERE id=:id AND company_id=:companyId AND branch_id=:branchId LIMIT 1`, { id, companyId, branchId });
    if (!rows.length) throw httpError(404, "NOT_FOUND", "Not found");
    const assets = await query(`SELECT * FROM maint_contract_assets WHERE contract_id=:id`, { id });
    res.json({ item: rows[0], assets });
  } catch (err) { next(err); }
};

export const createContract = async (req, res, next) => {
  try {
    const { companyId, branchId } = req.scope;
    await ensureTables(companyId, branchId);
    const b = req.body || {};
    const existing = await query(`SELECT contract_no AS no FROM maint_contracts WHERE company_id=:companyId AND branch_id=:branchId`, { companyId, branchId });
    const contract_no = b.contract_no || nextNo("MCT", existing);
    const r = await query(
      `INSERT INTO maint_contracts (company_id,branch_id,contract_no,supplier_id,supplier_name,start_date,end_date,contract_value,scope,payment_terms,renewal_alert_days,status,notes) VALUES (:companyId,:branchId,:contract_no,:supplier_id,:supplier_name,:start_date,:end_date,:contract_value,:scope,:payment_terms,:renewal_alert_days,:status,:notes)`,
      { companyId, branchId, contract_no, supplier_id: toNumber(b.supplier_id), supplier_name: b.supplier_name || null, start_date: b.start_date || null, end_date: b.end_date || null, contract_value: Number(b.contract_value || 0), scope: b.scope || null, payment_terms: b.payment_terms || null, renewal_alert_days: toNumber(b.renewal_alert_days) || 30, status: b.status || "ACTIVE", notes: b.notes || null }
    );
    const cId = r.insertId;
    if (Array.isArray(b.assets)) {
      for (const a of b.assets) {
        await query(`INSERT INTO maint_contract_assets (contract_id,asset_id,asset_name) VALUES (:cId,:asset_id,:asset_name)`, { cId, asset_id: toNumber(a.asset_id), asset_name: a.asset_name || null });
      }
    }
    res.status(201).json({ id: cId, contract_no });
  } catch (err) { next(err); }
};

export const updateContract = async (req, res, next) => {
  try {
    const { companyId, branchId } = req.scope;
    const id = toNumber(req.params.id);
    const b = req.body || {};
    await query(`UPDATE maint_contracts SET supplier_id=:supplier_id,supplier_name=:supplier_name,start_date=:start_date,end_date=:end_date,contract_value=:contract_value,scope=:scope,payment_terms=:payment_terms,renewal_alert_days=:renewal_alert_days,status=:status,notes=:notes WHERE id=:id AND company_id=:companyId AND branch_id=:branchId`,
      { id, companyId, branchId, supplier_id: toNumber(b.supplier_id), supplier_name: b.supplier_name || null, start_date: b.start_date || null, end_date: b.end_date || null, contract_value: Number(b.contract_value || 0), scope: b.scope || null, payment_terms: b.payment_terms || null, renewal_alert_days: toNumber(b.renewal_alert_days) || 30, status: b.status || "ACTIVE", notes: b.notes || null });
    if (Array.isArray(b.assets)) {
      await query(`DELETE FROM maint_contract_assets WHERE contract_id=:id`, { id });
      for (const a of b.assets) {
        await query(`INSERT INTO maint_contract_assets (contract_id,asset_id,asset_name) VALUES (:id,:asset_id,:asset_name)`, { id, asset_id: toNumber(a.asset_id), asset_name: a.asset_name || null });
      }
    }
    res.json({ ok: true });
  } catch (err) { next(err); }
};
