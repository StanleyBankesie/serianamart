const fs = require('fs');
const file = 'c:\\\\Users\\\\stanl\\\\OneDrive\\\\Documents\\\\serianamart\\\\server\\\\utils\\\\dbUtils.js';
let content = fs.readFileSync(file, 'utf8');

const target = '  }\n}\n\nexport async function ensureRolePagesTable() {';
const targetWin = '  }\r\n}\r\n\r\nexport async function ensureRolePagesTable() {';

const addition = `
  // Ensure every feature in the registry has at least one entry in adm_pages.
  // This guarantees that page-based permission tables can store permissions for features without real pages.
  const existingRows = await query("SELECT feature_key FROM adm_pages WHERE feature_key IS NOT NULL");
  const existingFks = new Set(existingRows.map(r => String(r.feature_key).trim()));

  for (const f of allFeatures) {
    const fk = String(f.feature_key || "").trim();
    if (!fk || existingFks.has(fk)) continue;

    const moduleStr = f.module_key || fk.split(":")[0];
    const code = \`\${moduleStr}_\${f.name || fk.split(":")[1] || "FEATURE"}\`
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "");
    
    await query(
      "INSERT IGNORE INTO adm_pages (module, name, code, path, feature_key) VALUES (:module, :name, :code, :path, :feature_key)",
      {
        module: moduleStr,
        name: f.name || fk,
        code: code,
        path: f.path || \`/\${moduleStr}/synthetic/\${fk.split(":")[1] || "feature"}\`,
        feature_key: fk,
      },
    );
  }
}

export async function ensureRolePagesTable() {`;

if (content.includes(targetWin)) {
  content = content.replace(targetWin, addition.replace(/\n/g, '\r\n'));
  fs.writeFileSync(file, content);
  console.log('Replaced with Windows line endings');
} else if (content.includes(target)) {
  content = content.replace(target, addition);
  fs.writeFileSync(file, content);
  console.log('Replaced with Unix line endings');
} else {
  console.log('Target not found!');
}
