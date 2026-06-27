import { readFileSync, writeFileSync } from 'fs';
const path = 'server/routes/inventory.routes.js';
let content = readFileSync(path, 'utf8');
// Replace the exact RECEIVED → TRANSFERRED in the transfer acceptance PUT route
const before = "SET status = 'RECEIVED', \r\n                received_date = CURRENT_TIMESTAMP, \r\n                received_by = :userId\r\n          WHERE id = :id`,\r\n        { id: transferId, userId },";
const after = "SET status = 'TRANSFERRED', \r\n                received_date = CURRENT_TIMESTAMP, \r\n                received_by = :userId\r\n          WHERE id = :id`,\r\n        { id: transferId, userId: userId ?? null },";
if (content.includes(before)) {
  content = content.replace(before, after);
  writeFileSync(path, content);
  console.log('SUCCESS: Replaced RECEIVED with TRANSFERRED');
} else {
  console.log('Target string NOT FOUND - checking content around line 9695...');
  const lines = content.split('\n');
  lines.slice(9690, 9705).forEach((l, i) => console.log(9691+i, JSON.stringify(l)));
}
