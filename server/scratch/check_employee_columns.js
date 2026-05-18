const fs = require('fs');
const mysql = require('mysql2/promise');

async function check() {
  const config = {
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'serianamart'
  };

  try {
    const conn = await mysql.createConnection(config);
    const [rows] = await conn.query("SHOW COLUMNS FROM hr_employees");
    console.log("hr_employees Columns:");
    rows.forEach(r => console.log(`- ${r.Field} (${r.Type})`));
    
    const [rows2] = await conn.query("SHOW COLUMNS FROM hr_payroll_items");
    console.log("\nhr_payroll_items Columns:");
    rows2.forEach(r => console.log(`- ${r.Field} (${r.Type})`));
    
    await conn.end();
  } catch (err) {
    console.error("Error:", err.message);
  }
}

check();
