import { query } from "./server/db/pool.js";

const newHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Salary Slip</title>
  <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;600&display=swap" rel="stylesheet" />
  <style>
    :root {
      --text: #111111;
      --text-muted: #555555;
      --border-heavy: 2px solid #111111;
      --border-light: 1px solid #cccccc;
      --border-dashed: 1px dashed #999999;
      --accent: #1a1a1a;
      --bg: #ffffff;
      --row-alt: #f9f9f9;
      --font-body: 'IBM Plex Sans', sans-serif;
      --font-mono: 'IBM Plex Mono', monospace;
    }

    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    html, body {
      width: 21cm;
      height: 29.7cm;
      margin: 0 auto;
      font-family: var(--font-body);
      color: var(--text);
      background: #e8e8e8;
      font-size: 22px;
      line-height: 1.5;
    }

    .page-wrap {
      width: 21cm;
      height: 29.7cm;
      overflow: hidden;
      background: var(--bg);
      box-shadow: 0 4px 32px rgba(0,0,0,0.18);
    }

    .doc {
      width: 21cm;
      height: 29.7cm;
      padding: 10px 10px 10px;
      overflow: hidden;
    }

    /* ── HEADER ── */
    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 28px;
      padding-bottom: 24px;
      border-bottom: var(--border-heavy);
    }

    .logo {
      height: 140px;
      object-fit: contain;
    }

    .company {
      text-align: right;
      max-width: 320px;
    }

    .company .name {
      font-size: 32px;
      font-weight: 700;
      letter-spacing: -0.02em;
      margin-bottom: 6px;
      color: var(--accent);
    }

    .company p {
      font-size: 17px;
      color: var(--text-muted);
      line-height: 1.6;
    }

    /* ── TITLE BAR ── */
    .titlebar {
      display: flex;
      align-items: center;
      gap: 16px;
      margin-bottom: 28px;
    }

    .titlebar .line {
      flex: 1;
      height: 2px;
      background: var(--text);
    }

    .titlebar .title {
      font-size: 20px;
      font-weight: 700;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      white-space: nowrap;
      color: var(--accent);
    }

    /* ── INFO GRID ── */
    .info {
      display: grid;
      grid-template-columns: 1fr 1fr auto;
      gap: 24px;
      margin-bottom: 28px;
      padding: 20px 24px;
      border: var(--border-light);
      background: #fafafa;
    }

    .kv-table {
      display: table;
      width: 100%;
    }

    .kv-row {
      display: table-row;
    }

    .kv-label {
      display: table-cell;
      font-weight: 600;
      font-size: 15px;
      padding: 3px 10px 3px 0;
      white-space: nowrap;
      vertical-align: top;
      color: var(--text);
    }

    .kv-sep {
      display: table-cell;
      padding: 3px 10px 3px 0;
      color: var(--text-muted);
      vertical-align: top;
    }

    .kv-val {
      display: table-cell;
      font-size: 15px;
      vertical-align: top;
      text-transform: uppercase;
      color: var(--text);
      font-weight: 500;
    }

    .info-right {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: flex-start;
    }

    .qr-box {
      width: 80px;
      height: 80px;
    }

    .qr-box img { width: 100%; height: 100%; }

    /* ── EARNINGS / DEDUCTIONS TABLE ── */
    .pay-section {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 0;
      border: var(--border-heavy);
      margin-bottom: 24px;
      font-size: 15px;
    }

    .pay-col {
      display: flex;
      flex-direction: column;
    }

    .pay-col:first-child {
      border-right: var(--border-heavy);
    }

    .pay-col-header {
      padding: 10px 12px;
      font-size: 14px;
      font-weight: 700;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      color: var(--accent);
      border-bottom: var(--border-heavy);
      display: flex;
      justify-content: space-between;
    }

    .pay-row {
      display: flex;
      justify-content: space-between;
      padding: 8px 12px;
      border-bottom: var(--border-dashed);
    }

    .pay-row:nth-child(even) {
      background: var(--row-alt);
    }

    .pay-row .pay-label {
      color: var(--text);
      font-weight: 500;
    }

    .pay-row .pay-val {
      font-family: var(--font-mono);
      font-weight: 600;
    }

    .pay-col-total {
      display: flex;
      justify-content: space-between;
      padding: 10px 12px;
      border-top: var(--border-heavy);
      margin-top: auto;
      font-weight: 700;
      font-size: 15px;
    }

    .pay-col-total .pay-val {
      font-family: var(--font-mono);
    }

    /* ── BOTTOM SECTION ── */
    .bottom-section {
      display: flex;
      justify-content: space-between;
      gap: 32px;
      margin-bottom: 36px;
    }

    .bottom-left {
      flex: 1;
      font-size: 15px;
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    .meta-row {
      display: flex;
      gap: 40px;
      flex-wrap: wrap;
    }

    .meta-item .lbl {
      font-weight: 700;
      font-size: 13px;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      color: var(--text-muted);
      display: block;
      margin-bottom: 2px;
    }

    .meta-item .val {
      font-size: 15px;
      font-weight: 600;
    }

    .amount-words .lbl,
    .remarks .lbl {
      font-weight: 700;
      font-size: 13px;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      color: var(--text-muted);
      display: block;
      margin-bottom: 4px;
    }

    .amount-words .val {
      font-size: 14px;
      font-weight: 600;
      text-transform: uppercase;
      color: var(--accent);
      font-family: var(--font-mono);
    }

    .remarks .val {
      font-size: 14px;
      color: var(--text);
      line-height: 1.6;
    }

    /* ── NET PAY SUMMARY ── */
    .summary {
      width: 260px;
      flex-shrink: 0;
      font-size: 15px;
    }

    .summary-row {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      padding: 8px 0;
      border-bottom: var(--border-dashed);
      gap: 12px;
    }

    .summary-row:last-child {
      border-bottom: var(--border-heavy);
      padding-top: 10px;
      padding-bottom: 10px;
      border-top: var(--border-heavy);
      margin-top: 4px;
    }

    .s-label {
      font-weight: 600;
      color: var(--text);
      font-size: 15px;
    }

    .s-val {
      font-family: var(--font-mono);
      font-weight: 600;
      font-size: 15px;
      white-space: nowrap;
    }

    .summary-row:last-child .s-label,
    .summary-row:last-child .s-val {
      font-size: 18px;
      font-weight: 700;
    }

    /* ── FOOTER ── */
    .footer-prepared {
      display: flex;
      align-items: center;
      gap: 10px;
      padding-top: 16px;
      border-top: var(--border-heavy);
      font-size: 15px;
    }

    .footer-prepared .lbl {
      font-weight: 700;
      font-size: 13px;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: var(--text-muted);
    }

    .footer-prepared .val {
      font-weight: 600;
    }

    .footer-note {
      margin-left: auto;
      font-size: 13px;
      color: var(--text-muted);
      font-style: italic;
    }

    /* ── PRINT ── */
    @media print {
      @page { size: 21cm 29.7cm; margin: 0; }
      html, body { background: #fff; width: 21cm; height: 29.7cm; }
      .page-wrap { box-shadow: none; width: 21cm; height: 29.7cm; }
      * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    }
  </style>
</head>
<body>
<div class="page-wrap">
  <div class="doc">

    <!-- HEADER -->
    <div class="header">
      <img class="logo" src="{{company.logo}}" alt="Logo" />
      <div class="company">
        <div class="name">{{company.name}}</div>
        <p>{{company.address}}</p>
        <p>{{company.address2}}</p>
        <p>Contact No: {{company.phone}}</p>
        <p>Email: {{company.email}}</p>
      </div>
    </div>

    <!-- TITLE BAR -->
    <div class="titlebar">
      <div class="line"></div>
      <div class="title">Salary Slip</div>
      <div class="line"></div>
    </div>

    <!-- EMPLOYEE INFO -->
    <div class="info">
      <div class="info-left">
        <div class="kv-table">
          <div class="kv-row">
            <div class="kv-label">Employee Name</div>
            <div class="kv-sep">:</div>
            <div class="kv-val">{{employee.name}}</div>
          </div>
          <div class="kv-row">
            <div class="kv-label">Employee ID</div>
            <div class="kv-sep">:</div>
            <div class="kv-val">{{employee.id}}</div>
          </div>
          <div class="kv-row">
            <div class="kv-label">Department</div>
            <div class="kv-sep">:</div>
            <div class="kv-val">{{employee.department}}</div>
          </div>
          <div class="kv-row">
            <div class="kv-label">Designation</div>
            <div class="kv-sep">:</div>
            <div class="kv-val">{{employee.designation}}</div>
          </div>
        </div>
      </div>

      <div class="info-mid">
        <div class="kv-table">
          <div class="kv-row">
            <div class="kv-label">Pay Period</div>
            <div class="kv-sep">:</div>
            <div class="kv-val">{{salary_slip.pay_period}}</div>
          </div>
          <div class="kv-row">
            <div class="kv-label">Pay Date</div>
            <div class="kv-sep">:</div>
            <div class="kv-val">{{formatDate salary_slip.pay_date}}</div>
          </div>
          <div class="kv-row">
            <div class="kv-label">Bank Account</div>
            <div class="kv-sep">:</div>
            <div class="kv-val">{{employee.bank_account}}</div>
          </div>
          <div class="kv-row">
            <div class="kv-label">Bank Name</div>
            <div class="kv-sep">:</div>
            <div class="kv-val">{{employee.bank_name}}</div>
          </div>
        </div>
      </div>

      <div class="info-right">
        <div class="qr-box"><img src="{{salary_slip.qr_code}}" alt="QR" /></div>
      </div>
    </div>

    <!-- EARNINGS & DEDUCTIONS -->
    <div class="pay-section">
      <!-- Earnings Column -->
      <div class="pay-col">
        <div class="pay-col-header">
          <span>Earnings</span>
          <span>Amount</span>
        </div>
        {{#each salary_slip.earnings}}
        <div class="pay-row">
          <span class="pay-label">{{name}}</span>
          <span class="pay-val">{{amount}}</span>
        </div>
        {{/each}}
        <div class="pay-col-total">
          <span>Total Earnings</span>
          <span class="pay-val">{{salary_slip.total_earnings}}</span>
        </div>
      </div>

      <!-- Deductions Column -->
      <div class="pay-col">
        <div class="pay-col-header">
          <span>Deductions</span>
          <span>Amount</span>
        </div>
        {{#each salary_slip.deductions}}
        <div class="pay-row">
          <span class="pay-label">{{name}}</span>
          <span class="pay-val">{{amount}}</span>
        </div>
        {{/each}}
        <div class="pay-col-total">
          <span>Total Deductions</span>
          <span class="pay-val">{{salary_slip.total_deductions}}</span>
        </div>
      </div>
    </div>

    <!-- BOTTOM SECTION -->
    <div class="bottom-section">
      <div class="bottom-left">
        <div class="meta-row">
          <div class="meta-item">
            <span class="lbl">Leave Taken</span>
            <span class="val">{{salary_slip.leave_taken}}</span>
          </div>
        </div>
        <div class="amount-words">
          <span class="lbl">Net Pay in Words</span>
          <span class="val">{{salary_slip.net_pay_in_words}}</span>
        </div>
        <div class="remarks">
          <span class="lbl">Remarks</span>
          <span class="val">{{salary_slip.remarks}}</span>
        </div>
      </div>

      <div class="summary">
        <div class="summary-row">
          <span class="s-label">Gross Earnings</span>
          <span class="s-val">{{salary_slip.total_earnings}}</span>
        </div>
        <div class="summary-row">
          <span class="s-label">Total Deductions</span>
          <span class="s-val">{{salary_slip.total_deductions}}</span>
        </div>
        <div class="summary-row">
          <span class="s-label">Net Pay</span>
          <span class="s-val">{{salary_slip.net_pay}}</span>
        </div>
      </div>
    </div>

    <!-- FOOTER -->
    <div class="footer-prepared">
      <span class="lbl">Prepared By :</span>
      <span class="val">{{prepared_by}}</span>
      <span class="footer-note">This is a computer-generated document and does not require a signature.</span>
    </div>

  </div>
</div>
</body>
</html>`;

async function updateTemplate() {
  try {
    // We target name = 'Salary Slip' and document_type = 'salary-slip'
    // First, find the template to get the ID if we don't handle name directly in UPDATE
    const [existing] = await query(
      "SELECT id FROM document_templates WHERE name = 'Salary Slip' OR name = 'salary slip' LIMIT 1"
    );

    if (existing) {
      const result = await query(
        "UPDATE document_templates SET html_content = :newHtml, updated_at = NOW() WHERE id = :id",
        { newHtml, id: existing.id }
      );
      console.log("Template updated successfully for ID:", existing.id);
      console.log("Update result:", JSON.stringify(result, null, 2));
    } else {
      console.log("No template found with name 'Salary Slip'. Please ensure it exists in the Document Templates section.");
    }
  } catch (e) {
    console.error("Failed to update template:", e);
  } finally {
    process.exit(0);
  }
}

updateTemplate();
