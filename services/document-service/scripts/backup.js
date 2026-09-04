const { createBackup } = require('../backup');
createBackup('manual').then((destination) => console.log(`备份完成：${destination}`)).catch((error) => { console.error(error); process.exit(1); });
