const fs = require('fs');
const path = require('path');

function walk(dir, callback) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const filepath = path.join(dir, file);
        const stats = fs.statSync(filepath);
        if (stats.isDirectory() && file !== 'node_modules' && file !== 'dist') {
            walk(filepath, callback);
        } else if (stats.isFile() && (filepath.endsWith('.ts') || filepath.endsWith('.vue'))) {
            callback(filepath);
        }
    }
}

let totalLines = 0;
let totalComments = 0;
let largeClasses = [];
let longMethods = [];
let nestedCode = [];
let hardcodedSecrets = [];
let o2complexity = [];

const secretRegex = /(password|secret|token|key)\s*[:=]\s*['"][a-zA-Z0-9]{5,}['"]/i;

walk('./src', (filepath) => {
    const content = fs.readFileSync(filepath, 'utf8');
    const lines = content.split('\n');
    totalLines += lines.length;
    
    let classLines = 0;
    let methodLines = 0;
    let className = '';
    let methodName = '';
    
    let nestingLevel = 0;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        
        if (line.trim().startsWith('//') || line.trim().startsWith('/*') || line.trim().startsWith('*')) {
            totalComments++;
        }
        
        if (secretRegex.test(line) && !line.toLowerCase().includes('csrf')) {
            hardcodedSecrets.push({ file: filepath, line: i + 1, content: line.trim() });
        }
        
        // Basic nesting check
        const openBraces = (line.match(/\{/g) || []).length;
        const closeBraces = (line.match(/\}/g) || []).length;
        nestingLevel += openBraces - closeBraces;
        
        if (nestingLevel > 4) {
            nestedCode.push({ file: filepath, line: i + 1, level: nestingLevel });
        }
        
        // Large Class check (simple heuristic)
        if (line.includes('class ')) {
            className = line.trim();
            classLines = 0;
        }
        if (className) classLines++;
        if (className && nestingLevel === 0 && classLines > 300) {
            largeClasses.push({ file: filepath, name: className, lines: classLines });
            className = '';
        }
        
        // O(n^2) check: multiple loops on same line or within a few lines
        if (line.includes('for (') || line.includes('.forEach(')) {
            if (nestingLevel > 2) {
                o2complexity.push({ file: filepath, line: i + 1 });
            }
        }
    }
});

console.log(JSON.stringify({
    totalLines,
    totalComments,
    commentRatio: (totalComments / totalLines * 100).toFixed(2) + '%',
    largeClasses,
    nestedCode: nestedCode.slice(0, 10), // Limit output
    hardcodedSecrets,
    o2complexity: o2complexity.slice(0, 10)
}, null, 2));
