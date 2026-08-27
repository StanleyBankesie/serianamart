import { pool } from "./server/db/pool.js";

async function testGetPosts() {
  const userId = 7;
  const branchId = 2; // Assuming user 7 is in branch 2
  const limit = 20;
  const offset = 0;
  
  const connection = await pool.getConnection();
  try {
    const [posts] = await connection.query(
        `
        SELECT DISTINCT 
          p.id,
          p.user_id,
          p.content,
          p.visibility_type,
          COALESCE(p.branch_id, p.warehouse_id) AS branch_id
        FROM posts p
        JOIN adm_users u ON p.user_id = u.id
        WHERE 
          (p.user_id = ?)
          OR
          (p.visibility_type = 'company')
          OR
          (p.visibility_type IN ('branch', 'warehouse') AND COALESCE(p.branch_id, p.warehouse_id) = ?)
        ORDER BY p.created_at DESC
        LIMIT ? OFFSET ?
        `,
        [userId, branchId, limit, offset],
      );
      console.log("Posts for User 7, Branch 2:", posts);
      
      const [posts2] = await connection.query(
        `
        SELECT DISTINCT 
          p.id,
          p.user_id,
          p.content,
          p.visibility_type,
          COALESCE(p.branch_id, p.warehouse_id) AS branch_id
        FROM posts p
        JOIN adm_users u ON p.user_id = u.id
        WHERE 
          (p.user_id = ?)
          OR
          (p.visibility_type = 'company')
          OR
          (p.visibility_type IN ('branch', 'warehouse') AND COALESCE(p.branch_id, p.warehouse_id) = ?)
        ORDER BY p.created_at DESC
        LIMIT ? OFFSET ?
        `,
        [userId, null, limit, offset],
      );
      console.log("Posts for User 7, Branch NULL:", posts2);
      
  } catch (err) {
      console.error(err);
  } finally {
      connection.release();
      process.exit(0);
  }
}
testGetPosts();
