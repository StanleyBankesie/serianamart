import bcrypt from "bcryptjs";
import { query } from "../db/pool.js";

async function main() {
  const username = "admin";
  const newPassword = "admin";
  try {
    const rows = await query(
      `SELECT id, is_active FROM adm_users WHERE username = :username LIMIT 1`,
      { username },
    );
    if (!rows.length) {
      console.error(
        `User '${username}' not found in adm_users. Create the user first, then run this script again.`,
      );
      process.exit(2);
    }
    const user = rows[0];
    const hash = await bcrypt.hash(newPassword, 10);
    await query(
      `UPDATE adm_users SET password_hash = :hash, is_active = 1 WHERE id = :id`,
      { hash, id: user.id },
    );
    console.log(`Password reset for '${username}' completed (bcrypt-hashed).`);
    process.exit(0);
  } catch (err) {
    console.error("Failed to set admin password:", err);
    process.exit(1);
  }
}

main();

