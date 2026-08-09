import sys

path = 'server/routes/admin.route.js'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

target = """    const companyId = Number(roleResult?.[0]?.company_id || 0);
    let licensedModules = null;
    if (companyId) {
      const licenseQuery = await query(`SELECT id FROM adm_company_licenses WHERE company_id = :companyId ORDER BY id DESC LIMIT 1`, { companyId });
      if (licenseQuery && licenseQuery.length > 0) {
        const licenseId = licenseQuery[0].id;
        const lm = await query(`SELECT module_code FROM adm_license_modules WHERE license_id = :licenseId`, { licenseId });
        licensedModules = new Set(lm.map(x => x.module_code));
      }
    }"""

replacement = """    const companyId = Number(roleResult?.[0]?.company_id || 0);
    let licensedModules = null;
    if (companyId === 1) {
      licensedModules = new Set(["*"]);
    } else if (companyId) {
      const licenseQuery = await query(`SELECT id FROM adm_company_licenses WHERE company_id = :companyId ORDER BY id DESC LIMIT 1`, { companyId });
      if (licenseQuery && licenseQuery.length > 0) {
        const licenseId = licenseQuery[0].id;
        const lm = await query(`SELECT module_code FROM adm_license_modules WHERE license_id = :licenseId`, { licenseId });
        licensedModules = new Set(lm.map(x => x.module_code));
      }
    }"""

if target in content:
    content = content.replace(target, replacement)
    with open(path, 'w', encoding='utf-8') as f:
        f.write(content)
    print("Fixed admin.route.js")
else:
    print("Target not found!")
