// Wrapper to catch temp file errors before Metro sees them
process.on('uncaughtException', (error) => {
  if (error && error.code === 'UNKNOWN' && error.path) {
    const errorPath = error.path.toString();
    // Ignore temp file errors
    if (errorPath.includes('AppData\\Local\\Temp') || 
        errorPath.includes('ps-script-') ||
        errorPath.endsWith('.ps1')) {
      console.warn(`[Ignored] Temp file watcher error: ${errorPath}`);
      return; // Don't crash
    }
  }
  // Re-throw other errors
  throw error;
});

// Start Expo
require('expo/bin/cli');

