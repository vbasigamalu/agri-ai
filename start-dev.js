/**
 * start-dev.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Cross-platform runner to concurrently start both Agri-AI Backend and 
 * React Frontend with unified terminal output and clean process termination.
 * ─────────────────────────────────────────────────────────────────────────────
 */

const { spawn } = require('child_process');
const path = require('path');

const isWin = process.platform === 'win32';
const npmCmd = isWin ? 'npm.cmd' : 'npm';

console.log('\x1b[32m%s\x1b[0m', '===================================================');
console.log('\x1b[32m%s\x1b[0m', '        AGRI-AI SMART CROP HEALTH ADVISOR          ');
console.log('\x1b[32m%s\x1b[0m', '      Starting Backend (5000) & React UI (5173)    ');
console.log('\x1b[32m%s\x1b[0m', '===================================================\n');

// 1. Spawn Backend (Express on port 5000)
const backend = spawn(npmCmd, ['start'], {
  cwd: path.join(__dirname, 'backend'),
  stdio: 'pipe',
  shell: isWin
});

backend.stdout.on('data', (data) => {
  const lines = data.toString().trim().split('\n');
  lines.forEach(l => {
    if (l.trim()) console.log('\x1b[34m[Backend]\x1b[0m ' + l);
  });
});

backend.stderr.on('data', (data) => {
  const lines = data.toString().trim().split('\n');
  lines.forEach(l => {
    if (l.trim()) console.error('\x1b[31m[Backend Error]\x1b[0m ' + l);
  });
});

// 2. Spawn Frontend (Vite on port 5173)
const client = spawn(npmCmd, ['run', 'dev'], {
  cwd: path.join(__dirname, 'client'),
  stdio: 'pipe',
  shell: isWin
});

client.stdout.on('data', (data) => {
  const lines = data.toString().trim().split('\n');
  lines.forEach(l => {
    if (l.trim()) console.log('\x1b[36m[Frontend]\x1b[0m ' + l);
  });
});

client.stderr.on('data', (data) => {
  const lines = data.toString().trim().split('\n');
  lines.forEach(l => {
    if (l.trim()) console.error('\x1b[33m[Frontend Warn]\x1b[0m ' + l);
  });
});

function shutdown() {
  console.log('\n\x1b[33m[Agri-AI] Shutting down backend and frontend dev servers...\x1b[0m');
  try { backend.kill(); } catch (e) {}
  try { client.kill(); } catch (e) {}
  process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
