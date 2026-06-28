const fs = require('fs');
const path = require('path');
const babel = require('C:/Users/stanl/AppData/Roaming/npm/node_modules/@babel/standalone');

const file = path.join(__dirname, 'client/src/pages/modules/service-management/service-confirmations/ServiceConfirmationForm.jsx');
const content = fs.readFileSync(file, 'utf8');

const transformed = babel.transform(content, {
  presets: ['env', 'react']
});

const outPath = path.join(__dirname, 'compiled-form.js');
fs.writeFileSync(outPath, transformed.code);
console.log("Compiled successfully!");
