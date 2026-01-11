const fs = require('fs');
const Scripts = require('./src/scripts');

fs.writeFileSync('dumped_script.js', Scripts.INJECT_UI_SCRIPT);
console.log('Dumped INJECT_UI_SCRIPT to dumped_script.js');
