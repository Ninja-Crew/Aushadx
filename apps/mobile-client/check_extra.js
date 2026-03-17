const fs = require('fs');
const appJson = JSON.parse(fs.readFileSync('app.json', 'utf8'));
console.log(JSON.stringify(appJson.expo.extra, null, 2));
