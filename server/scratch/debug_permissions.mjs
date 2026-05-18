import mysql from 'mysql2/promise';

const pool = mysql.createPool({
  host: 'localhost',
  port: 3306,
  user: 'seriana',
  password: 'Origen@tor123',
  database: 'seriana_db',
  namedPlaceholders: true,
  waitForConnections: true,
  connectionLimit: 5,
});

const q = async (sql, params = {}) => {
  const [rows] = await pool.execute(sql, params);
  return rows;
};

async function run() {
  try {
    // 1. Show all users with roles
    console.log('\n=== USERS ===');
    const users = await q(`SELECT id, username, role_id FROM adm_users LIMIT 10`);
    users.forEach(u => console.log(`  User ${u.id}: ${u.username}, role_id=${u.role_id}`));

    if (!users.length) { console.log('No users found'); await pool.end(); return; }
    const testUser = users[1] || users[0]; // pick second user (non-admin)
    const userId = testUser.id;
    console.log(`\n>>> Checking user ${userId} (${testUser.username}), role_id=${testUser.role_id}`);

    // 2. What's saved in adm_user_permissions for this user
    console.log('\n=== adm_user_permissions (saved overrides) ===');
    const saved = await q(`
      SELECT up.page_id, up.can_view, up.can_create, up.can_edit, up.can_delete, p.path, p.feature_key
      FROM adm_user_permissions up
      JOIN adm_pages p ON p.id = up.page_id
      WHERE up.user_id = :userId
      LIMIT 30
    `, { userId });
    if (!saved.length) console.log('  NO ROWS - nothing saved for this user!');
    saved.forEach(r => console.log(`  page ${r.page_id} [${r.path}] fk=${r.feature_key} | v=${r.can_view} c=${r.can_create} e=${r.can_edit} d=${r.can_delete}`));

    // 3. What does getUserFeaturePermissionsList return (the read-back query)
    console.log('\n=== getUserFeaturePermissionsList result ===');
    const readback = await q(`
      SELECT p.feature_key, MAX(up.can_view) AS can_view, MAX(up.can_create) AS can_create,
             MAX(up.can_edit) AS can_edit, MAX(up.can_delete) AS can_delete
      FROM adm_user_permissions up
      JOIN adm_pages p ON p.id = up.page_id
      WHERE up.user_id = :userId
      GROUP BY p.feature_key
    `, { userId });
    if (!readback.length) console.log('  NO ROWS - nothing returned!');
    readback.forEach(r => console.log(`  fk=${r.feature_key} | v=${r.can_view} c=${r.can_create} e=${r.can_edit} d=${r.can_delete}`));

    // 4. Check pages - how many have feature_key set vs NULL
    console.log('\n=== adm_pages feature_key coverage ===');
    const coverage = await q(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN feature_key IS NOT NULL AND feature_key != '' THEN 1 ELSE 0 END) as has_fk,
        SUM(CASE WHEN feature_key IS NULL OR feature_key = '' THEN 1 ELSE 0 END) as missing_fk
      FROM adm_pages WHERE is_active = 1
    `);
    console.log(`  Total active pages: ${coverage[0].total}`);
    console.log(`  Pages with feature_key: ${coverage[0].has_fk}`);
    console.log(`  Pages missing feature_key: ${coverage[0].missing_fk}`);

    // 5. Sample pages without feature_key
    const missing = await q(`SELECT id, path, feature_key FROM adm_pages WHERE (feature_key IS NULL OR feature_key = '') AND is_active = 1 LIMIT 10`);
    if (missing.length) {
      console.log('\n  Sample pages WITHOUT feature_key:');
      missing.forEach(r => console.log(`    id=${r.id} path=${r.path}`));
    }

    // 6. Role features for this user's role
    if (testUser.role_id) {
      console.log('\n=== adm_role_features ===');
      const rf = await q(`SELECT feature_key FROM adm_role_features WHERE role_id = :roleId ORDER BY feature_key`, { roleId: testUser.role_id });
      console.log(`  ${rf.length} features assigned to role ${testUser.role_id}:`);
      rf.slice(0, 20).forEach(r => console.log(`    ${r.feature_key}`));
      if (rf.length > 20) console.log(`    ... and ${rf.length - 20} more`);

      // Check pages for a sample feature_key from this role
      if (rf.length > 0) {
        const sampleFk = rf[0].feature_key;
        console.log(`\n=== Pages for sample feature_key: ${sampleFk} ===`);
        const fkPages = await q(
          `SELECT id, path, feature_key FROM adm_pages WHERE feature_key = :fk AND is_active = 1`,
          { fk: sampleFk }
        );
        if (!fkPages.length) {
          console.log(`  NO PAGES with feature_key='${sampleFk}'!`);
          // Try path prefix
          const parts = sampleFk.split(':').filter(Boolean);
          if (parts.length >= 2) {
            const basePath = `/${parts[0]}/${parts[1]}`;
            const pathPages = await q(
              `SELECT id, path, feature_key FROM adm_pages WHERE path LIKE :prefix AND is_active = 1 LIMIT 5`,
              { prefix: basePath + '%' }
            );
            console.log(`  Pages by path prefix '${basePath}%': ${pathPages.length}`);
            pathPages.forEach(r => console.log(`    id=${r.id} path=${r.path} fk=${r.feature_key}`));
          }
        } else {
          fkPages.forEach(r => console.log(`    id=${r.id} path=${r.path}`));
        }
      }
    }

    // 7. adm_role_permissions
    if (testUser.role_id) {
      console.log('\n=== adm_role_permissions ===');
      const rp = await q(`SELECT feature_key, can_view, can_create, can_edit, can_delete FROM adm_role_permissions WHERE role_id = :roleId LIMIT 10`, { roleId: testUser.role_id });
      console.log(`  ${rp.length} permission rows for role ${testUser.role_id}`);
      rp.forEach(r => console.log(`    fk=${r.feature_key} | v=${r.can_view} c=${r.can_create} e=${r.can_edit} d=${r.can_delete}`));
    }

  } catch(err) {
    console.error('ERROR:', err.message, err.sqlMessage || '');
  } finally {
    await pool.end();
  }
}

run();
