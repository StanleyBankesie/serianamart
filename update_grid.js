const fs = require('fs');
let content = fs.readFileSync('client/src/pages/modules/administration/users/UserForm.jsx', 'utf8');

// 1. Change grid to 3 columns
content = content.replace(
  '<div className="grid grid-cols-1 md:grid-cols-2 gap-4">',
  '<div className="grid grid-cols-1 md:grid-cols-3 gap-6">'
);

// 2. Remove md:col-span-2 from password field
content = content.replace(
  '<div className="md:col-span-2 border-t pt-4 mt-2">',
  '<div>'
);

// 3. Move Branches Modal Trigger into the grid
const triggerRegex = /\{\/\* Branches - Modal Trigger \*\/\}[\s\S]*?(?=\{\/\* Branch Selection Modal \*\/\}|\<div className="flex justify-end gap-3 mt-6"\>)/;

const match = content.match(triggerRegex);
if (match) {
  const triggerHtml = match[0];
  content = content.replace(triggerHtml, ''); // remove it from its current position
  
  content = content.replace(
    /<\/p>\s*<\/div>\s*<\/div>/,
    `</p>\n              </div>\n\n              ${triggerHtml}\n            </div>`
  );
} else {
  console.log("Could not find trigger html to move");
}

fs.writeFileSync('client/src/pages/modules/administration/users/UserForm.jsx', content);
console.log('Grid layout updated');
