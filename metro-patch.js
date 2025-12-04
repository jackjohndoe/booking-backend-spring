// Metro Patch - Prevents temp file errors
// This patches the file system watcher before Metro loads

const fs = require('fs');
const originalLstat = fs.lstatSync;
const originalLstatAsync = fs.promises.lstat;

// Patch lstat to ignore temp files
fs.lstatSync = function(path, options) {
  const pathStr = path.toString();
  if (pathStr.includes('AppData\\Local\\Temp') || 
      pathStr.includes('ps-script-') ||
      pathStr.endsWith('.ps1')) {
    throw { code: 'ENOENT', errno: -2, syscall: 'lstat', path: pathStr };
  }
  return originalLstat.call(this, path, options);
};

fs.promises.lstat = function(path) {
  const pathStr = path.toString();
  if (pathStr.includes('AppData\\Local\\Temp') || 
      pathStr.includes('ps-script-') ||
      pathStr.endsWith('.ps1')) {
    return Promise.reject({ code: 'ENOENT', errno: -2, syscall: 'lstat', path: pathStr });
  }
  return originalLstatAsync.call(this, path);
};

// Also patch the async version
const originalLstatCallback = fs.lstat;
fs.lstat = function(path, callback) {
  const pathStr = path.toString();
  if (pathStr.includes('AppData\\Local\\Temp') || 
      pathStr.includes('ps-script-') ||
      pathStr.endsWith('.ps1')) {
    if (callback) {
      callback({ code: 'ENOENT', errno: -2, syscall: 'lstat', path: pathStr });
    }
    return;
  }
  return originalLstatCallback.call(this, path, callback);
};

// Now require Metro config
require('./metro.config.js');

