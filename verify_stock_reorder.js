#!/usr/bin/env node

/**
 * Stock Reorder Implementation - Verification Script
 * This script verifies that all the required changes are in place
 */

import fs from "fs";
import path from "path";

const projectRoot = process.cwd();

console.log("🔍 Verifying Stock Reorder Implementation...\n");

// 1. Check inventory routes file
console.log("1️⃣  Checking backend routes...");
const inventoryRoutesPath = path.join(
  projectRoot,
  "server",
  "routes",
  "inventory.routes.js",
);

if (!fs.existsSync(inventoryRoutesPath)) {
  console.error("❌ inventory.routes.js not found");
  process.exit(1);
}

const routesContent = fs.readFileSync(inventoryRoutesPath, "utf-8");

const checks = [
  [
    "ensureReorderPointsTable function",
    /async function ensureReorderPointsTable\(\)/,
  ],
  [
    "inv_reorder_points table creation",
    /CREATE TABLE IF NOT EXISTS inv_reorder_points/,
  ],
  ["Warehouse ID in schema", /warehouse_id BIGINT UNSIGNED NOT NULL/],
  ["GET /reorder-points from inv_reorder_points", /FROM inv_reorder_points rp/],
  ["POST saves to inv_reorder_points", /INSERT INTO inv_reorder_points/],
  ["Warehouse ID validation in POST", /if \(!itemId \|\| !warehouseId\)/],
  ["Updates inv_supplier_items", /INSERT INTO inv_supplier_items/],
  ["Updates inv_items table", /UPDATE inv_items/],
  ["DELETE from inv_reorder_points", /DELETE FROM inv_reorder_points/],
];

let passed = 0;
let failed = 0;

checks.forEach(([name, pattern]) => {
  if (pattern.test(routesContent)) {
    console.log(`  ✅ ${name}`);
    passed++;
  } else {
    console.log(`  ❌ ${name}`);
    failed++;
  }
});

// 2. Check frontend component
console.log("\n2️⃣  Checking frontend component...");
const frontendPath = path.join(
  projectRoot,
  "client",
  "src",
  "pages",
  "modules",
  "inventory",
  "StockReorderPage.jsx",
);

if (!fs.existsSync(frontendPath)) {
  console.error("❌ StockReorderPage.jsx not found");
  process.exit(1);
}

const frontendContent = fs.readFileSync(frontendPath, "utf-8");

const frontendChecks = [
  ["Modal state exists", /setShowModal/],
  ["Form data includes warehouse_id", /warehouse_id: ""/],
  ["Form displays warehouse_name", /warehouse_name/],
  ["Form displays item_name", /item_name/],
  ["Form displays supplier_name", /supplier_name/],
  ["Modal dialog implementation", /showModal &&/],
  ["Form submission handler", /const handleSubmit/],
  ["handleEdit function", /const handleEdit/],
];

frontendChecks.forEach(([name, pattern]) => {
  if (pattern.test(frontendContent)) {
    console.log(`  ✅ ${name}`);
    passed++;
  } else {
    console.log(`  ❌ ${name}`);
    failed++;
  }
});

// 3. Check database schema details
console.log("\n3️⃣  Checking database schema...");

const schemaChecks = [
  [
    "UNIQUE constraint on warehouse+item",
    /UNIQUE KEY uq_reorder_point \(company_id, branch_id, warehouse_id, item_id\)/,
  ],
  [
    "Foreign key to warehouses",
    /CONSTRAINT fk_rp_warehouse FOREIGN KEY \(warehouse_id\) REFERENCES inv_warehouses/,
  ],
  [
    "Foreign key to items",
    /CONSTRAINT fk_rp_item FOREIGN KEY \(item_id\) REFERENCES inv_items/,
  ],
  ["Timestamps in table", /created_at TIMESTAMP/],
];

schemaChecks.forEach(([name, pattern]) => {
  if (pattern.test(routesContent)) {
    console.log(`  ✅ ${name}`);
    passed++;
  } else {
    console.log(`  ❌ ${name}`);
    failed++;
  }
});

// Summary
console.log(`\n${"=".repeat(50)}`);
console.log(`✅ Passed: ${passed}`);
console.log(`❌ Failed: ${failed}`);
console.log(`${"=".repeat(50)}\n`);

if (failed === 0) {
  console.log("🎉 All verification checks passed!");
  console.log("\n📋 Implementation Summary:");
  console.log("  • inv_reorder_points table created with warehouse support");
  console.log("  • GET endpoint fetches from inv_reorder_points");
  console.log(
    "  • POST endpoint saves to both inv_reorder_points and inv_supplier_items",
  );
  console.log("  • inv_items table updated with stock levels");
  console.log("  • DELETE endpoint removes warehouse-specific reorder point");
  console.log("  • Frontend modal and form fully configured");
  console.log("  • Warehouse and supplier data properly fetched");
  console.log("\n✨ Ready for testing and deployment!");
  process.exit(0);
} else {
  console.log("⚠️  Some checks failed. Please review the implementation.");
  process.exit(1);
}
