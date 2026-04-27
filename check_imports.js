const fs = require('fs');
const path = require('path');
const file = path.join(__dirname, 'client/src/pages/modules/finance/FinanceRoutes.jsx');
const content = fs.readFileSync(file, 'utf8');
const lines = content.split('\n');
let missing = false;
for (const line of lines) {
  const match = line.match(/import\s+.*from\s+['"](\..*)['"]/);
  if (match) {
    const importPath = match[1];
    let resolvedPath = path.resolve(path.dirname(file), importPath);
    // Add .jsx if not present and no extension
    if (!fs.existsSync(resolvedPath)) {
      if (fs.existsSync(resolvedPath + '.jsx')) {
         resolvedPath += '.jsx';
      } else if (fs.existsSync(resolvedPath + '.js')) {
         resolvedPath += '.js';
      }
    }
    if (!fs.existsSync(resolvedPath)) {
      console.log('Missing: ' + resolvedPath);
      missing = true;
    }
  }
}
if (!missing) console.log('All imported files exist.');
