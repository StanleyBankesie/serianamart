## Goal
- Copy Sales Order → "Project Order" + General Requisition → "Purchase Requisition" with full CRUD + workflow.
- Create "Project Income Report" showing receipt vouchers linked to projects.
- Improve GL Account field search (replace `<datalist>` with POS-style rich dropdown).
- Convert all PM list pages to consistent ProjectOrderList design (`card-header bg-brand text-white rounded-t-lg` + `card-body`).

## Constraints & Preferences
- Backend routes inlined in `projects.routes.js`.
- Frontend simplified but functionally complete.
- Purchase Requisition uses prefix `PR-`, tables `pm_purchase_requisitions` / `pm_purchase_requisition_items`.
- Permission keys use feature names from `modulesRegistry.js` / `featuresRegistry.js`.
- Workflow document type `PURCHASE_REQUISITION` (+ synonyms).
- Project Income Report: `project_id` column added to existing `fin_vouchers` table (via `ensureCol`), stored in `createVoucher` from `projectId` payload field (already sent by ReceiptVoucherForm).
- PM list pages: adopt the `card-header bg-brand text-white rounded-t-lg` header + `table` class pattern used by ProjectOrderList.

## Progress
### Done
- **PMPurchaseRequisitionList.jsx**: Created — search/sort/filter, status badges, view/edit/submit/cancel actions.
- **PMPurchaseRequisitionForm.jsx**: Created — line items with inventory item search dropdown, project selector, save/submit workflow, view mode.
- **ProjectManagementHome.jsx**: Imported both purchase requisition pages, added `/purchase-requisitions/*` routes, sidebar entry (Execution section), RBAC feature entry.
- **Build fixed**: Changed `react-hot-toast` → `react-toastify`, fixed `auth/PermissionContext` → relative path, fixed `utils/searchUtils` → relative path, fixed `api/client` → relative path. Build passes.
- **Project Income Report backend**: Added `project_id` to `fin_vouchers` via `ensureCol`; `createVoucher` now stores `projectId`; `listVouchers`/`getVoucherById` return `project_id`; new `GET /reports/project-income` endpoint (`getProjectIncomeReport`) returns receipt vouchers (RV type) by project with summary.
- **Project Income Report frontend** (`ProjectIncomeReport.jsx`): Project selector dropdown, summary cards (count/total), voucher table with CSV export.
- **Project Income Report routes**: Added to `ProjectManagementHome.jsx` (route, sidebar entry under Reporting, RBAC feature entry), added to `ProjectReports.jsx` landing page.
- **GL Account field search**: Replaced `<datalist>` with POS-style search dropdown — `accountSearchResults` useMemo, click-to-select, Enter key support, click-outside close, rich display (name + code columns).
- **ProjectList.jsx**: Converted to `space-y-4` + `card-header bg-brand text-white rounded-t-lg` header + `card`/`card-body` layout with `table` class.
- **TaskList.jsx**: Converted to same ProjectOrderList design pattern; cleaned up unused lucide-react imports.
- **TimesheetList.jsx**: Converted to ProjectOrderList design — `space-y-4`, two-card layout (header card + table card), text-label action buttons, inline modal preserved. Removed unused icons.
- **ExpenseList.jsx**: Converted to ProjectOrderList design — same two-card layout, inline modal preserved, status badges, text-label action buttons.
- **MaterialRequisitionList.jsx (PM)**: Converted to ProjectOrderList design — two-card layout, attach/submit/view/edit action buttons as text labels, fixed `api` import to relative path.
- **MaterialUtilizationList.jsx (PM)**: Converted to ProjectOrderList design — two-card layout, View action button as text label, fixed `api` import to relative path.
- **MaterialReceiptList.jsx (PM)**: Converted to ProjectOrderList design — two-card layout, View action button as text label, fixed `api` import to relative path, preserved pending issues count / refresh button.
- **PMPurchaseRequisitionList.jsx**: Converted to ProjectOrderList design — two-card layout, View/Edit/Submit/Cancel action buttons as styled text labels, removed unused icon imports.

### In Progress
- (none)

### Blocked
- (none)

## Key Decisions
- Purchase Requisition uses auto-number prefix `PR-` generated server-side via `nextPMReqNo()`.
- Purchase Requisition gets status `FULFILLED` after post-workflow approval (matching General Requisition pattern).
- Purchase Requisition submit handler supports ad-hoc + standard workflow.
- GL Account field: Used same `relative` input + absolute dropdown pattern as POS barcode search instead of `<datalist>`, for richer display (code + name) and better UX.
- Project Income Report: Added `project_id` to `fin_vouchers` (not a linking table) since the frontend already sends `projectId`; used `ensureCol` for safe schema migration at runtime.
- PM list pages: Adopted `card-header bg-brand text-white rounded-t-lg` header as a separate card + a second card with `card-body` containing search + `table` as the standard layout; action buttons use text labels with subtle background/border styling instead of pure icon buttons for consistency.

## Next Steps
1. Verify all pages in browser if needed.

## Critical Context
- `pool.query()` not available in `projects.routes.js` — all handlers use `query()` from `../db/pool.js` (returns `ResultSetHeader` directly).
- `ensurePMPurchaseRequisitionTables()` called at start of every purchase requisition route handler.
- Workflow document type synonyms: `PURCHASE_REQUISITION`, `Purchase Requisition`, `PM_PURCHASE_REQUISITION`.
- `ensureCol()` from `dbUtils.js` used to add `project_id` column to `fin_vouchers` at runtime if missing.
- GL Account field now uses `accountSearchResults` useMemo (filters groupFilteredAccounts by query, slice 0-20), open on focus, close on outside click.

## Relevant Files
- `client/src/pages/modules/project-management/purchase-requisitions/PMPurchaseRequisitionList.jsx`: Created, later converted to card-header design.
- `client/src/pages/modules/project-management/purchase-requisitions/PMPurchaseRequisitionForm.jsx`: Created — form with items, save/submit workflow.
- `client/src/pages/modules/project-management/reports/ProjectIncomeReport.jsx`: Created — income report with project selector, table, CSV export.
- `server/controllers/finance.controller.js`: Modified `createVoucher` to accept `projectId` and store in `project_id` column; added `v.project_id` to `listVouchers` and `getVoucherById` SELECTs.
- `server/controllers/projects.controller.js`: Added `getProjectIncomeReport` handler; imported `ensureCol` from dbUtils.
- `server/routes/projects.routes.js`: Added `GET /reports/project-income` route.
- `client/src/pages/modules/finance/reports/GeneralLedgerReportPage.jsx`: Replaced `<datalist>` account search with POS-style dropdown (accountSearchResults, handleSelectAccount, click-outside).
- `client/src/pages/modules/project-management/ProjectManagementHome.jsx`: Added purchase requisition routes/sidebar/feature + project income report routes/sidebar/feature.
- `client/src/pages/modules/project-management/reports/ProjectReports.jsx`: Added income report link.
- `client/src/pages/modules/project-management/projects/ProjectList.jsx`: Converted to card-header/card-body design.
- `client/src/pages/modules/project-management/tasks/TaskList.jsx`: Converted to card-header/card-body design.
- `client/src/pages/modules/project-management/timesheets/TimesheetList.jsx`: Converted to card-header design.
- `client/src/pages/modules/project-management/expenses/ExpenseList.jsx`: Converted to card-header design.
- `client/src/pages/modules/project-management/material-requisition/MaterialRequisitionList.jsx`: Converted to card-header design.
- `client/src/pages/modules/project-management/material-utilization/MaterialUtilizationList.jsx`: Converted to card-header design.
- `client/src/pages/modules/project-management/material-receipt/MaterialReceiptList.jsx`: Converted to card-header design.
- `client/src/data/modulesRegistry.js` / `server/data/featuresRegistry.js`: Registry entries for `project-orders` and `purchase-requisition`.
- `server/utils/dbUtils.js`: `ensurePMPurchaseRequisitionTables()` for schema; `ensureCol()` for runtime column additions.
