/**
 * @fileoverview Utility script to check database connectivity with hardcoded credentials.
 * @module check_db2
 */

import mysql from 'mysql2/promise';

/**
 * Connects to the database using hardcoded credentials and fetches sample service orders.
 *
 * @async
 * @returns {Promise<void>}
 */
// Utility function to test database connectivity using hardcoded fallback credentials
async function check() {
  // Initialize connection with hardcoded credentials for quick testing
  const conn = await mysql.createConnection({
    host: 'localhost',
    user: 'seriana',
    password: 'Origen@tor123',
    database: 'seriana_db',
    port: 3306,
  });

  // Fetch the latest 5 purchase service orders to confirm working SELECT queries
  const [rows] = await conn.execute(`SELECT id, created_by, created_at FROM pur_service_orders ORDER BY id DESC LIMIT 5`);
  // Output the query results
  console.log(rows);
  // Close the database connection to avoid hanging process
  conn.end();
}
// Execute the check and log errors if it fails
check().catch(console.error);
