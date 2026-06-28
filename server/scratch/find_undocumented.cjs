const fs = require('fs');
const path = require('path');

const rootDir = 'c:\\Users\\stanl\\OneDrive\\Documents\\serianamart\\server';
const excludeDirs = ['node_modules', 'tmp', 'backups', 'public', 'uploads', 'scratch', 'data'];

function findFiles(dir, fileList = []) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const fullPath = path.join(dir, file);
        if (fs.statSync(fullPath).isDirectory()) {
            if (!excludeDirs.includes(file)) {
                findFiles(fullPath, fileList);
            }
        } else if (file.endsWith('.js') || file.endsWith('.cjs')) {
            fileList.push(fullPath);
        }
    }
    return fileList;
}

const jsFiles = findFiles(rootDir);
const undocumented = [];

for (const file of jsFiles) {
    const content = fs.readFileSync(file, 'utf-8');
    const firstLines = content.split('\n').slice(0, 50).join('\n');
    
    // Check if it has a file header comment like /** or /*
    // We consider it undocumented if there is no JSDoc or block comment in the first 20 lines.
    const hasHeader = /^\s*\/\*\*?[\s\S]*?\*\//m.test(firstLines) || /^\s*\/\//m.test(firstLines);
    if (!hasHeader) {
        undocumented.push(file);
    }
}

console.log(JSON.stringify(undocumented, null, 2));
