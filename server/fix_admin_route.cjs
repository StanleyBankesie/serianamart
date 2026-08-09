const fs = require('fs');
const path = require('path');

const targetPath = path.resolve('routes/admin.route.js');
let content = fs.readFileSync(targetPath, 'utf8');

const target = `    const companyId = Number(roleResult?.[0]?.company_id || 0);
    let licensedModules = null;
    if (companyId) {
      const licenseQuery = await query(\`SELECT id FROM adm_company_licenses WHERE company_id = :companyId ORDER BY id DESC LIMIT 1\`, { companyId });`;

const replacement = `    const companyId = Number(roleResult?.[0]?.company_id || 0);
    let licensedModules = null;
    if (companyId === 1) {
      licensedModules = new Set(["*"]);
    } else if (companyId) {
      const licenseQuery = await query(\`SELECT id FROM adm_company_licenses WHERE company_id = :companyId ORDER BY id DESC LIMIT 1\`, { companyId });`;

content = content.replace(target, replacement);
fs.writeFileSync(targetPath, content);
console.log('Fixed admin.route.js');
