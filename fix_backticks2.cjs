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
    // Safer regex: do not match across newlines [^\n']
    const newContent = content.replace(/'(\/api\/[^\n']*\$\{[^\n}]+\}[^\n']*)'/g, "`$1`");
    
    if (content !== newContent) {
        fs.writeFileSync(f, newContent);
        changedCount++;
        console.log('Fixed:', f);
    }
});
console.log(`Fixed ${changedCount} files.`);
