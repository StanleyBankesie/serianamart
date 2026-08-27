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

            if (file === 'FinanceHome.jsx' || file === 'ServiceManagementHome.jsx') {
                continue;
            }
            
            // Remove empty actions arrays
            content = content.replace(/actions:\s*\[\s*\],?/g, '');
            
            // Find all `path: "..."` and inject actions
            const parts = content.split(/path:\s*(['"])([^'"]+)\1/);
            if (parts.length > 1) {
                let newContent = parts[0];
                for (let i = 1; i < parts.length; i += 3) {
                    const q = parts[i];
                    const itemPath = parts[i+1];
                    let rest = parts[i+2];
                    
                    // Skip if actions already exists right after
                    let skip = false;
                    const restTrim = rest.trim();
                    if (restTrim.startsWith(',')) {
                        const afterComma = rest.substring(rest.indexOf(',') + 1).trim();
                        if (afterComma.startsWith('actions:')) {
                            skip = true;
                        }
                    } else if (restTrim.startsWith('actions:')) {
                        skip = true;
                    }
                    
                    // If skip or it's just a root path or weird path
                    if (skip || !itemPath.startsWith('/')) {
                        newContent += 'path: ' + q + itemPath + q + rest;
                        continue;
                    }
                    
                    modified = true;
                    const isReportOrSetup = itemPath.includes('report') || itemPath.includes('setup') || itemPath.includes('analytics') || itemPath.includes('settings') || itemPath.includes('permissions') || itemPath.includes('diagnostics') || itemPath.includes('dashboard') || itemPath.includes('organogram') || itemPath.includes('log');
                    
                    let actionsStr = '';
                    if (isReportOrSetup) {
                        actionsStr = `\n        actions: [\n          { label: "View", path: "${itemPath}", type: "outline" }\n        ]`;
                    } else {
                        actionsStr = `\n        actions: [\n          { label: "View", path: "${itemPath}", type: "outline" },\n          { label: "New", path: "${itemPath}/new", type: "primary" }\n        ]`;
                    }
                    
                    if (restTrim.startsWith(',')) {
                        const commaIdx = rest.indexOf(',');
                        newContent += 'path: ' + q + itemPath + q + ',' + actionsStr + ',' + rest.substring(commaIdx + 1);
                    } else {
                        newContent += 'path: ' + q + itemPath + q + ',' + actionsStr + ',' + rest;
                    }
                }
                if (modified) {
                    fs.writeFileSync(fullPath, newContent);
                    console.log(`Updated ${file}`);
                }
            }
        }
    }
}
traverseAndFix(modulesDir);
console.log('done');
