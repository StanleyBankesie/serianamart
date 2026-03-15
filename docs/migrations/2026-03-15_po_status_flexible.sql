-- Ensure purchase order status can accept reverse state without truncation
-- Adjust table names to match your schema before running.

-- Option A: Switch to VARCHAR(32) for flexibility (recommended)
-- ALTER TABLE purchase_orders MODIFY COLUMN status VARCHAR(32) NOT NULL DEFAULT 'DRAFT';
-- ALTER TABLE purchase_orders_import MODIFY COLUMN status VARCHAR(32) NOT NULL DEFAULT 'DRAFT';

-- Option B: Expand ENUM to include RETURNED (and REVERSED if you plan to use it)
-- ALTER TABLE purchase_orders 
--   MODIFY COLUMN status ENUM('DRAFT','PENDING','PENDING_APPROVAL','APPROVED','REJECTED','RETURNED','CANCELLED','CLOSED') 
--   NOT NULL DEFAULT 'DRAFT';
-- ALTER TABLE purchase_orders_import 
--   MODIFY COLUMN status ENUM('DRAFT','PENDING','PENDING_APPROVAL','APPROVED','REJECTED','RETURNED','CANCELLED','CLOSED') 
--   NOT NULL DEFAULT 'DRAFT';

-- Normalize legacy values that include spaces (e.g., 'REVERSE TO APPROVER') to RETURNED
-- UPDATE purchase_orders SET status='RETURNED' WHERE status LIKE 'REVERSE%';
-- UPDATE purchase_orders_import SET status='RETURNED' WHERE status LIKE 'REVERSE%';

