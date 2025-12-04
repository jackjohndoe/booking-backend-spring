// Wrapper to catch temp file errors before Metro starts
process.on('uncaughtException', (error) => {
  if (error && error.code === 'UNKNOWN' && error.path) {
    const errorPath = error.path.toString();
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

// Also catch unhandled rejections
process.on('unhandledRejection', (reason, promise) => {
  if (reason && reason.code === 'UNKNOWN' && reason.path) {
    const errorPath = reason.path.toString();
    if (errorPath.includes('AppData\\Local\\Temp') || 
        errorPath.includes('ps-script-') ||
        errorPath.endsWith('.ps1')) {
      console.warn(`[Ignored] Temp file watcher rejection: ${errorPath}`);
      return;
    }
  }
  console.error('Unhandled Rejection:', reason);
});

// Import and start Expo CLI
const { spawn } = require('child_process');
const path = require('path');

// Start Expo with error handling
const expoProcess = spawn('npx', ['expo', 'start', '--clear', '--tunnel'], {
  stdio: 'inherit',
  shell: true,
  cwd: __dirname
});

expoProcess.on('error', (error) => {
  if (error && error.code === 'UNKNOWN' && error.path) {
    const errorPath = error.path.toString();
    if (errorPath.includes('AppData\\Local\\Temp') || 
        errorPath.includes('ps-script-') ||
        errorPath.endsWith('.ps1')) {
      console.warn(`[Ignored] Temp file error: ${errorPath}`);
      return;
    }
  }
  console.error('Expo process error:', error);
});

expoProcess.on('exit', (code) => {
  if (code !== 0 && code !== null) {
    console.log(`Expo process exited with code ${code}`);
  }
});

