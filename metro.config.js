const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');
const fs = require('fs');

// PREVENT temp file errors by patching fs.lstat before Metro loads
const originalLstat = fs.lstat;
const originalLstatSync = fs.lstatSync;

fs.lstat = function(filePath, optionsOrCallback, callback) {
  const pathStr = String(filePath);
  
  // Handle temp files
  if (pathStr.includes('AppData\\Local\\Temp') || 
      pathStr.includes('AppData/Local/Temp') ||
      pathStr.includes('ps-script-') ||
      pathStr.endsWith('.ps1')) {
    const err = new Error('ENOENT: no such file or directory');
    err.code = 'ENOENT';
    err.errno = -2;
    err.syscall = 'lstat';
    err.path = pathStr;
    
    // Determine if callback is provided
    const cb = typeof optionsOrCallback === 'function' ? optionsOrCallback : callback;
    if (typeof cb === 'function') {
      return cb(err);
    }
    throw err;
  }
  
  // Normal case - determine callback
  if (typeof optionsOrCallback === 'function') {
    return originalLstat.call(this, filePath, optionsOrCallback);
  }
  if (typeof callback === 'function') {
    return originalLstat.call(this, filePath, optionsOrCallback, callback);
  }
  return originalLstat.call(this, filePath, optionsOrCallback);
};

fs.lstatSync = function(filePath, options) {
  const pathStr = String(filePath);
  if (pathStr.includes('AppData\\Local\\Temp') || 
      pathStr.includes('AppData/Local/Temp') ||
      pathStr.includes('ps-script-') ||
      pathStr.endsWith('.ps1')) {
    const err = new Error('ENOENT: no such file or directory');
    err.code = 'ENOENT';
    err.errno = -2;
    err.syscall = 'lstat';
    err.path = pathStr;
    throw err;
  }
  return originalLstatSync.call(this, filePath, options);
};

// Also patch promises version
if (fs.promises) {
  const originalLstatPromise = fs.promises.lstat;
  fs.promises.lstat = function(filePath) {
    const pathStr = String(filePath);
    if (pathStr.includes('AppData\\Local\\Temp') || 
        pathStr.includes('AppData/Local/Temp') ||
        pathStr.includes('ps-script-') ||
        pathStr.endsWith('.ps1')) {
      const err = new Error('ENOENT: no such file or directory');
      err.code = 'ENOENT';
      err.errno = -2;
      err.syscall = 'lstat';
      err.path = pathStr;
      return Promise.reject(err);
    }
    return originalLstatPromise.call(this, filePath);
  };
}

const config = getDefaultConfig(__dirname);

// Add resolver configuration
config.resolver = {
  ...config.resolver,
  extraNodeModules: {
    ...config.resolver.extraNodeModules,
  },
};

// Comprehensive block list for temp files - use RegExp that Metro understands
config.blockList = [
  // Block all temp directories with various patterns
  new RegExp('.*[\\\\/]AppData[\\\\/]Local[\\\\/]Temp.*'),
  new RegExp('.*[\\\\/]Temp.*'),
  // Block PowerShell scripts
  /.*ps-script-.*\.ps1$/,
  /.*\.ps1$/,
];

// Force Metro to ONLY watch the project directory - prevent parent directory watching
const projectRoot = path.resolve(__dirname);
config.projectRoot = projectRoot;
config.watchFolders = [projectRoot];

// Add to resolver blockList to prevent temp file access
config.resolver = {
  ...config.resolver,
  blockList: [
    ...(config.resolver.blockList || []),
    /.*[\\/]AppData[\\/]Local[\\/]Temp.*/,
    /.*[\\/]Temp.*/,
    /.*ps-script-.*\.ps1$/,
  ],
};

// Disable watching parent directories
config.server = {
  ...config.server,
  enhanceMiddleware: (middleware) => {
    return middleware;
  },
};

module.exports = config;

