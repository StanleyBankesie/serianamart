const fs = require('fs');

const fullPath = 'client/src/pages/modules/transport/TransportLayout.jsx';
let content = fs.readFileSync(fullPath, 'utf8');
let modified = false;

// Remove empty actions arrays
content = content.replace(/actions:\s*\[\s*\],?/g, '');

const parts = content.split(/path:\s*(['"])([^'"]+)\1/);
if (parts.length > 1) {
    let newContent = parts[0];
    for (let i = 1; i < parts.length; i += 3) {
        const q = parts[i];
        const itemPath = parts[i+1];
        let rest = parts[i+2];
        
        let skip = false;
        const restTrim = rest.trim();
        if (restTrim.startsWith(',')) {
            const afterComma = rest.substring(rest.indexOf(',') + 1).trim();
            if (afterComma.startsWith('actions:')) skip = true;
        } else if (restTrim.startsWith('actions:')) {
            skip = true;
        }
        
        if (skip || !itemPath.startsWith('/')) {
            newContent += 'path: ' + q + itemPath + q + rest;
            continue;
        }
        
        modified = true;
        const isReportOrSetup = itemPath.includes('report') || itemPath.includes('setup') || itemPath.includes('analytics') || itemPath.includes('settings') || itemPath.includes('dashboard') || itemPath.includes('log');
        
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
        console.log('Updated TransportLayout.jsx');
    }
}
