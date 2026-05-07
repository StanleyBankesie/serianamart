import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
dotenv.config();

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'seriana_db',
  namedPlaceholders: true,
});

async function main() {
  const [triggers] = await pool.query('SHOW TRIGGERS');
  console.log('Triggers:', JSON.stringify(triggers, null, 2));
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
