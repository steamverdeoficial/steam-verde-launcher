const Scripts = require('./src/scripts');
const vm = require('vm');

console.log("Checking INJECT_UI_SCRIPT syntax...");

try {
    const script = new vm.Script(Scripts.INJECT_UI_SCRIPT);
    console.log("INJECT_UI_SCRIPT: OK");
} catch (e) {
    console.error("INJECT_UI_SCRIPT: Syntax Error!");
    console.error(e.message);

    // Tentar mostrar a linha do erro
    if (e.stack) {
        const match = e.stack.match(/evalmachine\.<anonymous>:(\d+)/);
        if (match) {
            const lineNo = parseInt(match[1]);
            const lines = Scripts.INJECT_UI_SCRIPT.split('\n');
            console.log(`Error around line ${lineNo}:`);
            console.log(`${lineNo - 2}: ${lines[lineNo - 3]}`);
            console.log(`${lineNo - 1}: ${lines[lineNo - 2]}`);
            console.log(`${lineNo}: ${lines[lineNo - 1]}  <-- ERROR`);
            console.log(`${lineNo + 1}: ${lines[lineNo]}`);
            console.log(`${lineNo + 2}: ${lines[lineNo + 1]}`);
        }
    }
}
