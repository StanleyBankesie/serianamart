const fs = require('fs');
let txt = fs.readFileSync('server/routes/documents.routes.js', 'utf8');

txt = txt.replace(/String\((.*?)\)\.slice\(0,\s*10\)/g, '(($1) instanceof Date ? ($1).toISOString().slice(0, 10) : String($1).slice(0, 10))');

fs.writeFileSync('server/routes/documents.routes.js', txt);
console.log('Fixed dates in documents.routes.js');
