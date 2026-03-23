const fs = require('fs');
const path = require('path');

const baseDir = 'c:/Users/stanl/OneDrive/Documents/serianamart/client/src/pages/modules/human-resources';

function processDirectory(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      processDirectory(fullPath);
    } else if (fullPath.endsWith('.jsx') && fs.statSync(fullPath).isFile()) {
      let content = fs.readFileSync(fullPath, 'utf8');
      let modified = false;

      // Make <tr> styling in <thead> consistent
      const trRegex = /<tr[^>]*className=["'][^"']*bg-slate-\d+[^"']*["'][^>]*>/g;
      content = content.replace(trRegex, (match) => {
        if (!content.substring(content.lastIndexOf('<thead>', content.indexOf(match)), content.indexOf(match)).includes('<thead>')) {
          // crude check if we are in thead
          modified = true;
          return '<tr className="text-left bg-slate-50 dark:bg-slate-900/50">';
        }
        return match;
      });
      // also replace standard text-left combinations
      content = content.replace(/<tr className="bg-slate-50 dark:bg-slate-700[^"]*">/g, '<tr className="text-left bg-slate-50 dark:bg-slate-900/50">');
      content = content.replace(/<tr className="text-left bg-slate-50 dark:bg-slate-700[^"]*">/g, '<tr className="text-left bg-slate-50 dark:bg-slate-900/50">');

      // Make <th> styling consistent
      const thRegex = /<th\s+className=["']([^"']+)["']/g;
      content = content.replace(thRegex, (match, p1) => {
        if (p1.includes('px-4') || p1.includes('py-2') || p1.includes('py-3') || (p1.includes('text') && !p1.includes('text-right') && !p1.includes('text-center'))) {
          // replace typical th class with premium one, keep text-right if it exists
          let newClass = "px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400";
          if (p1.includes('text-right')) newClass += " text-right";
          else if (p1.includes('text-center')) newClass += " text-center";
          
          if (p1 !== newClass) {
            modified = true;
            return `<th className="${newClass}"`;
          }
        }
        return match;
      });

      if (modified) {
        fs.writeFileSync(fullPath, content, 'utf8');
        console.log(`Updated ${fullPath}`);
      }
    }
  }
}

processDirectory(baseDir);
console.log("Done");
