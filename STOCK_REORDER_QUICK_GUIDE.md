# Stock Reorder Management - Quick Implementation Guide

## ✅ What Was Implemented

### 1. **Warehouse-Specific Reorder Points**

- Each warehouse can have different reorder levels for the same item
- Warehouse names are fetched from `inv_warehouses` table
- Stored in `inv_reorder_points` table with warehouse_id

### 2. **Add Reorder Point Modal**

- Clicking "Add Reorder Point" button opens a modal dialog
- Modal form with all required fields
- Modal closes after successful save
- Form validation ensures warehouse_id and item_id are provided

### 3. **Item Data Integration**

- Item field dropdown shows: `{item_code} - {item_name}`
- Item code and name fetched from `inv_items` table
- Item cannot be modified during edit (disabled state)

### 4. **Supplier Integration**

- Preferred Supplier dropdown populated from `pur_suppliers` table
- Shows `supplier_name`
- Creates link in `inv_supplier_items` table when supplier selected
- Optional field - can save without selecting supplier

### 5. **Database Operations on Save**

**When you click "Save" button, the system:**

1. **Updates `inv_reorder_points` table**
   - Inserts warehouse-specific reorder point
   - Links warehouse → item → stock levels

2. **Updates `inv_supplier_items` table** (if supplier selected)
   - Links supplier → item → stock levels
   - Sets preferred = 1

3. **Updates `inv_items` table** (always)
   - `min_stock_level` ← "Min Stock" field value
   - `max_stock_level` ← "Max Stock" field value
   - `reorder_level` ← "Reorder Qty" field value

### 6. **Reorder List View**

- Fetches data from `inv_reorder_points` table
- Shows:
  - Item code and name
  - Warehouse name
  - Current stock (from inv_stock_balances)
  - Min/Max levels
  - Reorder quantity
  - Stock status (Critical/Low/Normal)
- Supports filtering by warehouse and item search

---

## 📊 Data Flow Diagram

```
Frontend Form
    ↓
warehouse_id, item_id, min_stock, max_stock, reorder_qty, lead_time, supplier_id
    ↓
POST /inventory/reorder-points
    ↓
    ├→ INSERT/UPDATE inv_reorder_points (warehouse-specific)
    ├→ INSERT/UPDATE inv_supplier_items (if supplier selected)
    └→ UPDATE inv_items (global levels)
    ↓
GET /inventory/reorder-points
    ↓
    JOIN inv_reorder_points
    JOIN inv_items (get item_code, item_name, uom)
    JOIN inv_warehouses (get warehouse_name)
    LEFT JOIN pur_suppliers (get supplier_name)
    LEFT JOIN inv_stock_balances (get current_stock)
    ↓
Display in Table/List
```

---

## 🗂️ Database Schema

### inv_reorder_points (Warehouse-Specific)

```sql
id                BIGINT AUTO_INCREMENT PRIMARY KEY
company_id        BIGINT (FK to adm_companies)
branch_id         BIGINT (FK to adm_branches)
warehouse_id      BIGINT (FK to inv_warehouses) ✅ NEW
item_id           BIGINT (FK to inv_items)
min_stock         DECIMAL(18,3)
max_stock         DECIMAL(18,3)
reorder_qty       DECIMAL(18,3)
lead_time         INT
supplier_id       BIGINT NULL (FK to pur_suppliers)
is_active         TINYINT(1)
created_at        TIMESTAMP
updated_at        TIMESTAMP

UNIQUE: (company_id, branch_id, warehouse_id, item_id)
```

### inv_supplier_items (Supplier-Item Linking)

```sql
id                BIGINT AUTO_INCREMENT PRIMARY KEY
company_id        BIGINT
branch_id         BIGINT
supplier_id       BIGINT
item_id           BIGINT
min_stock_level   DECIMAL(18,3)
max_stock_level   DECIMAL(18,3)
reorder_level     DECIMAL(18,3)
lead_time         INT
preferred         TINYINT(1)

UNIQUE: (company_id, branch_id, supplier_id, item_id)
```

### inv_items (Global Stock Levels)

```sql
... (existing columns)
min_stock_level   DECIMAL(18,3) ✅ UPDATED
max_stock_level   DECIMAL(18,3) ✅ UPDATED
reorder_level     DECIMAL(18,3) ✅ UPDATED
```

---

## 🔄 API Endpoints

### GET /inventory/reorder-points

**Fetch all reorder points with related data**

```
Query Params:
  - warehouseId: Optional, filter by warehouse
  - search: Optional, search item code or name
  - status: Optional, filter by status (critical/low/normal)

Response:
{
  items: [
    {
      id, warehouse_id, supplier_id, item_id,
      min_stock, max_stock, reorder_qty, lead_time,
      item_code, item_name, uom,
      warehouse_name, supplier_name,
      current_stock
    }
  ]
}
```

### POST /inventory/reorder-points

**Create or update reorder point**

```
Request Body:
{
  warehouse_id: number (required),
  item_id: number (required),
  min_stock: number,
  max_stock: number,
  reorder_qty: number,
  lead_time: number,
  supplier_id: number (optional)
}

Response:
{
  ok: true,
  item_id: number
}
```

### DELETE /inventory/reorder-points/:id

**Delete a reorder point**

```
Response:
{
  ok: true
}
```

---

## 🎯 Key Features

| Feature                           | Status | Details                                                    |
| --------------------------------- | ------ | ---------------------------------------------------------- |
| Warehouse-specific reorder points | ✅     | Each warehouse can have different levels                   |
| Fetch warehouse names             | ✅     | From inv_warehouses table                                  |
| Fetch item details                | ✅     | item_code and item_name from inv_items                     |
| Fetch supplier names              | ✅     | From pur_suppliers table                                   |
| Modal UI                          | ✅     | Add/Edit in modal dialog                                   |
| Multi-table updates               | ✅     | Saves to inv_reorder_points, inv_supplier_items, inv_items |
| Stock level tracking              | ✅     | min_stock_level, max_stock_level, reorder_level            |
| Warehouse filtering               | ✅     | Filter list by warehouse                                   |
| Item search                       | ✅     | Search by code or name                                     |
| Transaction safety                | ✅     | Rollback on error                                          |

---

## 🧪 Testing Guide

### 1. Add New Reorder Point

```
Steps:
1. Click "Add Reorder Point" button
2. Modal opens with empty form
3. Select warehouse from dropdown
4. Select item from dropdown
5. Enter Min Stock value (e.g., 10)
6. Enter Max Stock value (e.g., 50)
7. Enter Reorder Qty value (e.g., 25)
8. (Optional) Select supplier
9. Click "Save" button
10. Modal closes, list refreshes

Verify:
- New row appears in table
- warehouse_name shows correctly
- item_code and item_name show correctly
- min_stock, max_stock, reorder_qty match input
- If supplier selected, supplier_name shows
```

### 2. Edit Reorder Point

```
Steps:
1. Click "Edit" button on existing row
2. Modal opens with data pre-filled
3. Change min_stock value
4. Change max_stock value
5. Change reorder_qty value
6. Change supplier (optional)
7. Click "Save" button (shows as "Update")
8. Modal closes, list refreshes

Verify:
- Verify warehouse_id is disabled (read-only)
- Verify item_id is disabled (read-only)
- Updated values show in table
- inv_items table updated with new levels
```

### 3. Delete Reorder Point

```
Steps:
1. Click "Delete" button on row
2. Confirm deletion
3. Row disappears from list

Verify:
- Row removed from table
- inv_reorder_points record deleted
```

### 4. Filter by Warehouse

```
Steps:
1. Select warehouse from filter dropdown
2. Click "Filter" button
3. List shows only points for selected warehouse

Verify:
- Only selected warehouse_name shows
```

### 5. Search by Item

```
Steps:
1. Enter item code or name in search box
2. Click "Filter" button
3. List shows only matching items

Verify:
- Only matching item_code or item_name shows
```

### 6. Database Verification

```
MySQL Queries to Verify:
1. Check inv_reorder_points:
   SELECT * FROM inv_reorder_points
   WHERE warehouse_id = 1 AND item_id = 1;

2. Check inv_supplier_items:
   SELECT * FROM inv_supplier_items
   WHERE supplier_id = 1 AND item_id = 1;

3. Check inv_items levels:
   SELECT id, item_name, min_stock_level,
          max_stock_level, reorder_level
   FROM inv_items WHERE id = 1;
```

---

## 📝 Form Validation

| Field       | Required | Type   | Rules                                       |
| ----------- | -------- | ------ | ------------------------------------------- |
| Warehouse   | YES      | Select | Must select a warehouse                     |
| Item        | YES      | Select | Must select an item, cannot change on edit  |
| Min Stock   | YES      | Number | Must be >= 0                                |
| Max Stock   | YES      | Number | Must be >= 0                                |
| Reorder Qty | YES      | Number | Must be >= 0                                |
| Lead Time   | NO       | Number | Default 0                                   |
| Supplier    | NO       | Select | Optional, creates supplier link if provided |

---

## 🔧 Troubleshooting

### Issue: "warehouse_id is required" error

**Solution:** Ensure warehouse is selected in dropdown before saving

### Issue: "item_id is required" error

**Solution:** Ensure item is selected in dropdown before saving

### Issue: Modal doesn't open

**Solution:** Verify `showModal` state is properly set, check browser console for errors

### Issue: Warehouse/Item/Supplier names not showing

**Solution:**

- Verify data exists in corresponding tables
- Check API response includes all fields
- Check database JOINs are working correctly

### Issue: Stock levels not updating in inv_items

**Solution:**

- Verify transaction is committing successfully
- Check database foreign key constraints
- Verify item exists in inv_items before saving

---

## 📚 Files Changed

**Backend:**

- `server/routes/inventory.routes.js`
  - Added `ensureReorderPointsTable()` function
  - Updated GET /reorder-points endpoint
  - Updated POST /reorder-points endpoint
  - Updated DELETE /reorder-points/:id endpoint

**Frontend:**

- `client/src/pages/modules/inventory/StockReorderPage.jsx`
  - No changes needed (already fully configured)

**Documentation:**

- `STOCK_REORDER_IMPLEMENTATION.md` (detailed reference)
- `STOCK_REORDER_QUICK_GUIDE.md` (this file)
- `verify_stock_reorder.js` (verification script)

---

## ✨ Implementation Complete

All requirements have been successfully implemented:

- ✅ Warehouse-specific reorder points with warehouse_name fetching
- ✅ Modal dialog for Add/Edit functionality
- ✅ Item dropdown with item_name from inv_items
- ✅ Supplier dropdown with supplier_name from pur_suppliers
- ✅ inv_supplier_items table creation and population
- ✅ Multi-table updates on save (inv_reorder_points, inv_supplier_items, inv_items)
- ✅ Data fetching from inv_reorder_points for list view
- ✅ Transaction-based safety for data integrity

**Status: 🟢 READY FOR DEPLOYMENT**
