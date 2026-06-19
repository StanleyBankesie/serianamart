const mysql = require('mysql2/promise');
async function run() {
  const conn = await mysql.createConnection({
    host: 'localhost', port: 3306,
    user: 'admin', password: 'admin',
    database: 'omnisuite'
  });
  const [rows] = await conn.query("SHOW COLUMNS FROM document_templates");
  console.log(JSON.stringify(rows, null, 2));
  await conn.end();
}
run().catch(e => { console.error(e.message); process.exit(1); });
