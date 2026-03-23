const fs = require('fs');
const path = require('path');

function walk(dir) {
  fs.readdirSync(dir, { withFileTypes: true }).forEach(entry => {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(fullPath);
    } else if (fullPath.endsWith('.jsx')) {
      let content = fs.readFileSync(fullPath, 'utf8');
      let modified = false;

      // Replace <th> classes
      content = content.replace(/<th\s+className=["']([^"']+)["']/g, (match, p1) => {
        if (p1.includes('text-[10px]')) return match; // Already formatted
        let extraClasses = [];
        if (p1.includes('text-right')) extraClasses.push('text-right');
        if (p1.includes('text-center')) extraClasses.push('text-center');
        
        let newClass = 'px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400';
        if (extraClasses.length > 0) {
          newClass += ' ' + extraClasses.join(' ');
        }
        modified = true;
        return `<th className="${newClass}"`;
      });

      // Replace completely unstyled <th>
      content = content.replace(/<th>/g, () => {
        modified = true;
        return '<th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">';
      });
      
      // Replace unstyled <thead>
      content = content.replace(/<thead([^>]*)>/g, (match, p1) => {
        if (p1.includes('bg-slate-50 dark:bg-slate-900/50')) return match;
        // Need to be careful not to overwrite sticky or z-index if they exist
        modified = true;
        if (p1.includes('className=')) {
           // It has classes, replace the background classes if any, add our standard
           return match; // Too complex for simple regex without risking breaking layout modifiers like `sticky`
        }
        return '<thead className="bg-[var(--table-header-bg)] dark:bg-slate-900/50">'; // Wait, just keep to ths since it's safer.
      });

      if (modified) {
        fs.writeFileSync(fullPath, content);
        console.log('Fixed ' + fullPath);
      }
    }
  });
}

walk('c:/Users/stanl/OneDrive/Documents/serianamart/client/src/pages/modules/human-resources');
