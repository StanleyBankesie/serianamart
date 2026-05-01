const { pool } = require("../db/pool.js");

async function describeTable() {
  const connection = await pool.getConnection();
  try {
    const [rows] = await connection.execute("DESCRIBE hr_employees");
    console.log("hr_employees table columns:");
    console.log(
      "Field".padEnd(25) +
        "Type".padEnd(20) +
        "Null" +
        " Key" +
        " Default" +
        " Extra",
    );
    rows.forEach((row) => {
      console.log(
        (row.Field || "").padEnd(25) +
          (row.Type || "").padEnd(20) +
          (row.Null || "") +
          " " +
          (row.Key || "") +
          " " +
          (row.Default || "") +
          " " +
          (row.Extra || ""),
      );
    });
  } catch (err) {
    console.error("Error:", err.message);
    if (err.code === "ER_NO_SUCH_TABLE") {
      console.log("Table hr_employees does not exist");
    }
  } finally {
    connection.release();
  }
}

describeTable().catch(console.error);
