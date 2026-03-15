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
    
    // Fix mismatched quotes: '/api/...` -> `/api/...`
    let newContent = content.replace(/'(\/api\/[^`]+)`/g, "`$1`");
    
    // Fix single quotes that contain ${}: '/api/...${...}...' -> `/api/...${...}...`
    newContent = newContent.replace(/'(\/api\/[^\n']*\$\{[^\n}]+\}[^\n']*)'/g, "`$1`");
    
    // Also, looking at Step 327, somehow: { method: `POST' } happened?
    // Let's fix reversed mismatched quotes if any exist: `POST' -> 'POST'
    newContent = newContent.replace(/`([^`\n]+)'/g, "'$1'");

    if (content !== newContent) {
        fs.writeFileSync(f, newContent);
        changedCount++;
        console.log('Fixed:', f);
    }
});
console.log(`Fixed ${changedCount} files.`);
