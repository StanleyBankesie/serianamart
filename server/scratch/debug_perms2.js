// Diagnostic script - runs inside the server ESM context
import { query } from '../db/pool.js';

async function run() {
  try {
    console.log('\n=== USERS ===');
    const users = await query(`SELECT id, username, role_id FROM adm_users LIMIT 10`);
    users.forEach(u => console.log(`  User ${u.id}: ${u.username}, role_id=${u.role_id}`));

    if (!users.length) { console.log('No users found'); process.exit(0); }

    // Find user with role_id=5 (stan)
    const testUser = users.find(u => u.role_id == 5) || users.find(u => u.role_id) || users[0];
    const userId = testUser.id;
    console.log(`\n>>> Checking user ${userId} (${testUser.username}), role_id=${testUser.role_id}`);

    // 1. What's saved in adm_user_permissions for this user
    console.log('\n=== adm_user_permissions (saved overrides) ===');
    const saved = await query(`
      SELECT up.page_id, up.can_view, up.can_create, up.can_edit, up.can_delete, p.path, p.feature_key
      FROM adm_user_permissions up
      JOIN adm_pages p ON p.id = up.page_id
      WHERE up.user_id = :userId
      LIMIT 30
    `, { userId });
    if (!saved.length) console.log('  NO ROWS - nothing saved for this user!');
    saved.forEach(r => console.log(`  page ${r.page_id} [${r.path}] fk=${r.feature_key} v=${r.can_view} c=${r.can_create} e=${r.can_edit} d=${r.can_delete}`));

    // 2. What the read-back query returns
    console.log('\n=== getUserFeaturePermissionsList read-back ===');
    const readback = await query(`
      SELECT p.feature_key, MAX(up.can_view) AS can_view, MAX(up.can_create) AS can_create,
             MAX(up.can_edit) AS can_edit, MAX(up.can_delete) AS can_delete
      FROM adm_user_permissions up
      JOIN adm_pages p ON p.id = up.page_id
      WHERE up.user_id = :userId
      GROUP BY p.feature_key
    `, { userId });
    if (!readback.length) console.log('  NO ROWS returned!');
    readback.forEach(r => console.log(`  fk=${r.feature_key} v=${r.can_view} c=${r.can_create} e=${r.can_edit} d=${r.can_delete}`));

    // 3. Pages coverage
    console.log('\n=== adm_pages feature_key coverage ===');
    const coverage = await query(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN feature_key IS NOT NULL AND feature_key != '' THEN 1 ELSE 0 END) as has_fk,
        SUM(CASE WHEN feature_key IS NULL OR feature_key = '' THEN 1 ELSE 0 END) as missing_fk
      FROM adm_pages WHERE is_active = 1
    `);
    console.log(`  Total: ${coverage[0].total} | With fk: ${coverage[0].has_fk} | Missing fk: ${coverage[0].missing_fk}`);

    // Sample missing
    const missing = await query(`SELECT id, path FROM adm_pages WHERE (feature_key IS NULL OR feature_key = '') AND is_active = 1 LIMIT 5`);
    if (missing.length) { console.log('  Sample pages WITHOUT feature_key:'); missing.forEach(r => console.log(`    id=${r.id} path=${r.path}`)); }

    // 4. Role features
    if (testUser.role_id) {
      const rf = await query(`SELECT feature_key FROM adm_role_features WHERE role_id = :roleId ORDER BY feature_key LIMIT 20`, { roleId: testUser.role_id });
      console.log(`\n=== adm_role_features: ${rf.length} features for role ${testUser.role_id} ===`);
      rf.forEach(r => console.log(`  ${r.feature_key}`));

      // Check if pages exist for first feature_key
      if (rf.length > 0) {
        const fk = rf[0].feature_key;
        const parts = fk.split(':').filter(Boolean);
        const basePath = parts.length >= 2 ? `/${parts[0]}/${parts[1]}` : '';
        
        const fkPages = await query(`SELECT id, path, feature_key FROM adm_pages WHERE feature_key = :fk AND is_active = 1`, { fk });
        console.log(`\n  Pages with feature_key='${fk}': ${fkPages.length}`);
        
        if (!fkPages.length && basePath) {
          const pathPages = await query(`SELECT id, path, feature_key FROM adm_pages WHERE (path = :base OR path LIKE :prefix) AND is_active = 1 LIMIT 5`, { base: basePath, prefix: basePath + '/%' });
          console.log(`  Pages by path prefix '${basePath}': ${pathPages.length}`);
          pathPages.forEach(r => console.log(`    id=${r.id} path=${r.path} fk=${r.feature_key}`));
        }
      }
    }

    // 5. adm_role_permissions check
    if (testUser.role_id) {
      const rp = await query(`SELECT feature_key, can_view, can_create, can_edit, can_delete FROM adm_role_permissions WHERE role_id = :roleId LIMIT 10`, { roleId: testUser.role_id });
      console.log(`\n=== adm_role_permissions: ${rp.length} rows for role ${testUser.role_id} ===`);
      rp.forEach(r => console.log(`  fk=${r.feature_key} v=${r.can_view} c=${r.can_create} e=${r.can_edit} d=${r.can_delete}`));
      if (!rp.length) console.log('  NO ROWS - role has no permission rows in adm_role_permissions!');
    }

    process.exit(0);
  } catch(err) {
    console.error('ERROR:', err.message);
    process.exit(1);
  }
}

run();
