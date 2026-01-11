const fs = require('fs');
const path = require('path');
const vm = require('vm');

try {
    const scripts = require('./src/scripts.js');
    console.log("src/scripts.js loaded successfully.");

    const uiScript = scripts.INJECT_UI_SCRIPT;
    if (!uiScript) {
        console.error("INJECT_UI_SCRIPT not found!");
        process.exit(1);
    }

    try {
        new vm.Script(uiScript);
        console.log("INJECT_UI_SCRIPT is VALID.");
    } catch (e) {
        console.error("INJECT_UI_SCRIPT INVALID:", e.message);
        const stack = e.stack.split('\n');
        console.error(stack[0]);
        process.exit(1);
    }

    try {
        const titleScript = scripts.INJECT_TITLEBAR_SCRIPT("User", "Icon", "1.0");
        new vm.Script(titleScript);
        console.log("INJECT_TITLEBAR_SCRIPT is VALID.");
    } catch (e) {
        console.error("INJECT_TITLEBAR_SCRIPT INVALID:", e.message);
        process.exit(1);
    }

} catch (e) {
    console.error("Failed to load scripts.js:", e.message);
    process.exit(1);
}
