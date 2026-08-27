const fs = require('fs');
const path = require('path');

const dir = 'client/src/pages/modules/service-management/reports';
const files = fs.readdirSync(dir);

for (const file of files) {
  if (file.endsWith('.jsx')) {
    const fullPath = path.join(dir, file);
    let content = fs.readFileSync(fullPath, 'utf8');
    if (content.includes('import { api } from "api/client";')) {
      content = content.replace('import { api } from "api/client";', 'import { api } from "../../../../api/client.js";');
      fs.writeFileSync(fullPath, content);
      console.log('Fixed', file);
    }
  }
}
