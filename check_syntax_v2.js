const fs = require('fs');
const vm = require('vm');

try {
    const scripts = require('./src/scripts.js');
    console.log("src/scripts.js loaded.");
    const uiScript = scripts.INJECT_UI_SCRIPT;
    if (!uiScript) {
        console.error("No INJECT_UI_SCRIPT");
        process.exit(1);
    }
    fs.writeFileSync('dumped_ui.js', uiScript);
    console.log("Dumped UI script to dumped_ui.js");

    // Check syntax
    new vm.Script(uiScript);
    console.log("INJECT_UI_SCRIPT VALID.");
} catch (e) {
    console.error("INVALID:", e.message);
    // Print stack trace line
    const lines = e.stack.split('\n');
    console.error(lines.length > 0 ? lines[0] : "No stack");
    process.exit(1);
}
