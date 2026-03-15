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
let changed = 0;
files.forEach(f => {
    let content = fs.readFileSync(f, 'utf8');
    // Replace fetch('/api/...)
    let newContent = content.replace(/fetch\(['"`]\/api\//g, "fetch((import.meta.env.VITE_API_URL || '') + '/api/");
    // Replace fetch(`/api/...)
    newContent = newContent.replace(/fetch\(`\/api\//g, "fetch((import.meta.env.VITE_API_URL || '') + `/api/");
    
    if (content !== newContent) {
        fs.writeFileSync(f, newContent);
        changed++;
        console.log('Updated', f);
    }
});
console.log(`Updated ${changed} files.`);
