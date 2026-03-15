const fs = require('fs');
const path = require('path');

function walk(dir) {
    let results = [];
    const list = fs.readdirSync(dir);
    list.forEach(function(file) {
        file = path.join(dir, file);
        const stat = fs.statSync(file);
        if (stat && stat.isDirectory()) { 
            results = results.concat(walk(file));
        } else if (file.endsWith('.jsx') || file.endsWith('.js')) {
            results.push(file);
        }
    });
    return results;
}

const files = walk('./src');
let changedCount = 0;
files.forEach(f => {
    let content = fs.readFileSync(f, 'utf8');
    
    // Look for lines that have /api/... inside single quotes but contain ${}
    // We can regex replace the single quotes holding these with backticks.
    // e.g., '/api/students/${user.id}' -> `/api/students/${user.id}`
    const newContent = content.replace(/'(\/api\/[^']*\$\{[^}]+\}[^']*)'/g, "`$1`");
    
    if (content !== newContent) {
        fs.writeFileSync(f, newContent);
        changedCount++;
        console.log('Fixed:', f);
    }
});
console.log(`Fixed ${changedCount} files.`);
