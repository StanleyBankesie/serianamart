import { pool, query } from './db/pool.js';

const normalizeModuleKey = (mk) => String(mk || "").toLowerCase().trim().replace(/[^a-z0-9-]/g, "-");
const normalizeFeatureKey = (fk, mk) => {
  const f = String(fk || "").toLowerCase().trim().replace(/[^a-z0-9-:]/g, "-");
  if (!f) return null;
  if (f.includes(":")) return f;
  if (mk) return `${mk}:${f}`;
  return f;
};

async function run() {
  try {
    const userId = 2; // sales girl
    const roleResult = await query(`SELECT role_id, company_id FROM adm_users WHERE id = ?`, [userId]);
    let roleId = Number(roleResult[0]?.role_id || 0) || 0;
    
    const modules = await query(`SELECT module_key FROM adm_role_modules WHERE role_id = ?`, [roleId]);
    
    const permissions = await query(`SELECT module_key, feature_key, can_view, can_create, can_edit, can_delete FROM adm_role_permissions WHERE role_id = ?`, [roleId]);
    
    const roleFeatures = await query(`SELECT feature_key FROM adm_role_features WHERE role_id = ?`, [roleId]);
    
    const normalizedPermissions = permissions.map((row) => {
      const moduleKey = normalizeModuleKey(row.module_key);
      return {
        ...row,
        module_key: moduleKey,
        feature_key: normalizeFeatureKey(row.feature_key, moduleKey),
      };
    });

    const normalizedRoleFeatures = roleFeatures
      .map((row) => normalizeFeatureKey(row.feature_key))
      .filter(Boolean);

    const explicitModules = new Set(
      modules.map((row) => normalizeModuleKey(row.module_key)).filter(Boolean)
    );

    const exclusivePerms = await query(`SELECT module_key, feature_key FROM adm_admin_page_permissions WHERE user_id = ?`, [userId]);
    for (const ep of exclusivePerms) {
      const mk = normalizeModuleKey(ep.module_key);
      const fk = normalizeFeatureKey(ep.feature_key, mk);
      explicitModules.add(mk);
      normalizedRoleFeatures.push(fk);
    }

    const inferredModules = new Set(explicitModules);

    const companyId = Number(roleResult[0]?.company_id || 0);
    let licensedModules = null;
    if (companyId) {
      const licenseQuery = await query(`SELECT id FROM adm_company_licenses WHERE company_id = ? ORDER BY id DESC LIMIT 1`, [companyId]);
      if (licenseQuery && licenseQuery.length > 0) {
        const licenseId = licenseQuery[0].id;
        const lm = await query(`SELECT module_code FROM adm_license_modules WHERE license_id = ?`, [licenseId]);
        licensedModules = new Set(lm.map(x => x.module_code));
      }
    }

    let finalModules = Array.from(inferredModules);
    let finalPermissions = normalizedPermissions;
    let finalRoleFeatures = normalizedRoleFeatures;

    finalPermissions = finalPermissions.filter(p => explicitModules.has(p.module_key));
    finalRoleFeatures = finalRoleFeatures.filter(f => {
      const [m] = f.split(":");
      return explicitModules.has(m);
    });

    console.log(JSON.stringify({
      modules: finalModules,
      permissions: finalPermissions,
      role_features: finalRoleFeatures,
      licensed_modules: Array.from(licensedModules || []),
    }, null, 2));

  } catch(e) { console.error(e) }
  process.exit(0);
}
run();
