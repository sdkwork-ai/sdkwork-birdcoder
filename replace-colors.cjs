const fs = require('fs');
const path = require('path');

const directories = [
  './src',
  './packages'
];

const replacements = [
  { from: /bg-\[#0A0A0A\]/g, to: 'bg-zinc-900' },
  { from: /bg-\[#111111\]/g, to: 'bg-zinc-800' },
  { from: /bg-\[#1A1A1A\]/g, to: 'bg-zinc-800' },
  { from: /bg-\[#444\]/g, to: 'bg-zinc-700' },
  { from: /border-white\/\[0\.08\]/g, to: 'border-white/10' },
  { from: /border-white\/\[0\.1\]/g, to: 'border-white/10' },
  { from: /bg-white\/\[0\.06\]/g, to: 'bg-white/5' },
  { from: /bg-white\/\[0\.04\]/g, to: 'bg-white/5' },
  { from: /bg-white\/\[0\.05\]/g, to: 'bg-white/5' },
  { from: /bg-white\/\[0\.08\]/g, to: 'bg-white/10' },
];

function walkSync(currentDirPath, callback) {
  fs.readdirSync(currentDirPath).forEach(function (name) {
    var filePath = path.join(currentDirPath, name);
    var stat = fs.statSync(filePath);
    if (stat.isFile()) {
      callback(filePath, stat);
    } else if (stat.isDirectory() && name !== 'node_modules' && name !== 'dist') {
      walkSync(filePath, callback);
    }
  });
}

function writeBackupFileSync(filePath, originalContent) {
  const backupPath = `${filePath}.replace-colors.bak`;
  fs.writeFileSync(backupPath, originalContent, 'utf8');
  return backupPath;
}

directories.forEach(dir => {
  if (fs.existsSync(dir)) {
    walkSync(dir, function(filePath) {
      if (filePath.endsWith('.tsx') || filePath.endsWith('.ts') || filePath.endsWith('.css')) {
        let content = fs.readFileSync(filePath, 'utf8');
        let originalContent = content;
        
        replacements.forEach(r => {
          content = content.replace(r.from, r.to);
        });
        
        if (content !== originalContent) {
          const backupPath = writeBackupFileSync(filePath, originalContent);
          fs.writeFileSync(filePath, content, 'utf8');
          console.log(`Updated ${filePath} (backup: ${backupPath})`);
        }
      }
    });
  }
});
