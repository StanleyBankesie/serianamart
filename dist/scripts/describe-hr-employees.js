const { pool } = require("../db/pool.js");

async function describeTable() {
  try {
    const [rows] = await pool.execute("DESCRIBE hr_employees");
    console.log("hr_employees table columns:");
    rows.forEach((row) => {
      console.log(
        `${row.Field.padEnd(25)} ${row.Type.padEnd(20)} ${row.Null} ${row.Key} ${row.Default || ""} ${row.Extra}`,
      );
    });
  } catch (err) {
    console.error("Error:", err.message);
  } finally {
    pool.end();
  }
}

describeTable();
