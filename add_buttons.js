const fs = require('fs');
const path = require('path');

const modulesDir = path.join(__dirname, 'client', 'src', 'pages', 'modules');

function traverseAndFix(dir) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const fullPath = path.join(dir, file);
        if (fs.statSync(fullPath).isDirectory()) {
            traverseAndFix(fullPath);
        } else if (file.endsWith('Home.jsx')) {
            let content = fs.readFileSync(fullPath, 'utf8');
            let modified = false;
            
            // Fix actions: [] -> actions: [{label:"View",...}, {label:"New",...}]
            // We use regex to find items that have actions: [] or no actions, but it's tricky.
            // Better to match the block:
            // path: "...",
            // icon: "...",
            // actions: [],
            
            const itemRegex = /path:\s*['"]([^'"]+)['"],[\s\S]*?(?:actions:\s*\[\s*\])?/g;
            // Actually, doing this with regex is hard. Let's just do a string replacement on `actions: []` where we also look back for `path:`
            
            // To do this safely, we will split the file by `actions: [],` or `actions: []`
            // But wait, some don't have actions defined at all.
            // Let's do this:
            
            content = content.replace(/path:\s*(['"])([^'"]+)\1,([\s\S]*?)(actions:\s*\[\])/g, (match, q, itemPath, middle, actionsMatch) => {
                modified = true;
                
                const isReportOrSetup = itemPath.includes('report') || itemPath.includes('setup') || itemPath.includes('analytics') || itemPath.includes('settings') || itemPath.includes('permissions') || itemPath.includes('diagnostics') || itemPath.includes('dashboard');
                
                if (isReportOrSetup) {
                    return `path: ${q}${itemPath}${q},${middle}actions: [\n          { label: "View", path: "${itemPath}", type: "outline" }\n        ]`;
                } else {
                    return `path: ${q}${itemPath}${q},${middle}actions: [\n          { label: "View", path: "${itemPath}", type: "outline" },\n          { label: "New", path: "${itemPath}/new", type: "primary" }\n        ]`;
                }
            });
            
            if (modified) {
                fs.writeFileSync(fullPath, content);
                console.log(`Updated ${file}`);
            }
        }
    }
}

traverseAndFix(modulesDir);
console.log('done');
