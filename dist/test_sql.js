import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
dotenv.config();

/**
 * Test function to execute a SQL query using the DB configuration from environment variables.
 * @returns {Promise<void>}
 */
async function test() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'serianamart'
  });
  
  const sql = `
        SELECT 
          COALESCE(CAST(pt.method AS CHAR), p.payment_method, 'UNKNOWN') AS method,
          COUNT(*) AS count,
          COALESCE(SUM(pt.amount), SUM(p.net_amount), 0) AS total
         FROM pos_sales p
        LEFT JOIN JSON_TABLE(
          p.payments,
          '$[*]' COLUMNS (
            method VARCHAR(20) PATH '$.method',
            amount DECIMAL(18,2) PATH '$.amount'
          )
        ) pt ON 1=1
        GROUP BY COALESCE(CAST(pt.method AS CHAR), p.payment_method, 'UNKNOWN')
  `;
  try {
    const [rows] = await conn.execute(sql);
    console.log("Success:", rows);
  } catch (err) {
    console.error("SQL Error:", err.message);
  }
  await conn.end();
}
test();
