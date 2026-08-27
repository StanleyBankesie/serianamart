import { pool } from "./server/db/pool.js";
import { signAccessToken } from "./server/services/token.service.js";

async function run() {
  const connection = await pool.getConnection();
  try {
    const [users] = await connection.execute("SELECT * FROM adm_users WHERE id = 7");
    const user = users[0];
    
    // generate token
    const token = await signAccessToken({ ...user, branch_id: 1, company_id: 1 });
    console.log("Token generated");
    
    // call api
    const res = await fetch("http://localhost:5000/api/social-feed?offset=0&limit=10", {
      headers: {
        Authorization: `Bearer ${token}`,
        "x-user-id": "7",
        "x-branch-id": "1",
        "x-company-id": "1"
      }
    });
    console.log("API Response status:", res.status);
    const data = await res.json();
    console.log("API Response data:", JSON.stringify(data, null, 2));
    
  } catch (err) {
    console.error(err);
  } finally {
    connection.release();
    process.exit(0);
  }
}

run();
