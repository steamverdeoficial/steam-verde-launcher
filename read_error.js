const fs = require('fs');
try {
    const content = fs.readFileSync('output.txt', 'utf16le');
    const lines = content.split('\n');
    console.log("--- ERROR LOG START ---");
    // Print first 20 lines
    for (let i = 0; i < Math.min(lines.length, 20); i++) {
        console.log(lines[i].trim());
    }
    console.log("--- ERROR LOG END ---");
} catch (e) {
    console.error(e);
}
