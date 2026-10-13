#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const root = path.join(__dirname, '..');

const exists = p => { try { fs.accessSync(p); return true; } catch { return false; } };
const mtime  = p => { try { return fs.statSync(p).mtimeMs; } catch { return 0; } };

// ELF e_machine: 40 = EM_ARM, 62 = EM_X86_64
function elfMachine(p) {
  try {
    const fd = fs.openSync(p, 'r');
    const b = Buffer.alloc(20);
    fs.readSync(fd, b, 0, 20, 0);
    fs.closeSync(fd);
    if (b[0] !== 0x7f || b[1] !== 0x45 || b[2] !== 0x4c || b[3] !== 0x46) return null;
    return b.readUInt16LE(18);
  } catch { return null; }
}

function listFiles(dir, ext) {
  const out = [];
  if (!exists(dir)) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...listFiles(full, ext));
    else if (!ext || e.name.endsWith(ext)) out.push(full);
  }
  return out;
}

function needsNativeRebuild() {
  const can     = path.join(root, 'build/Release/can.node');
  const signals = path.join(root, 'build/Release/can_signals.node');

  if (!exists(can))     return 'can.node missing';
  if (!exists(signals)) return 'can_signals.node missing';
  if (elfMachine(can) !== 40)     return 'can.node not ARM';
  if (elfMachine(signals) !== 40) return 'can_signals.node not ARM';

  const refTime = Math.min(mtime(can), mtime(signals));
  const sources = [
    path.join(root, 'binding.gyp'),
    ...listFiles(path.join(root, 'native')),
  ];
  for (const s of sources) {
    if (mtime(s) > refTime) return `source newer: ${path.relative(root, s)}`;
  }
  return null;
}

function needsTsRebuild() {
  const dist = path.join(root, 'dist/socketcan.js');
  if (!exists(dist)) return 'dist missing';
  for (const s of listFiles(path.join(root, 'src'), '.ts')) {
    if (mtime(s) > mtime(dist)) return `ts newer: ${path.relative(root, s)}`;
  }
  return null;
}

function run(cmd) {
  console.error(`[socketcan] $ ${cmd}`);
  execSync(cmd, {
    stdio: 'inherit',
    cwd: root,
    env: { ...process.env, CPPFLAGS: '' },
  });
}

// ---------------------------------------------------------------------------

const inDev = exists(path.join(root, 'binding.gyp'));

if (!inDev) {
  const can = path.join(root, 'build/Release/can.node');
  if (!exists(can)) {
    console.error('[socketcan] prebuilt binding missing:', can);
    process.exit(1);
  }
  console.error('[socketcan] prebuilt binding present:', can);
  process.exit(0);
}

const force = process.env.SOCKETCAN_FORCE_REBUILD === '1';

let nativeReason = force ? 'forced' : needsNativeRebuild();
let tsReason     = force ? 'forced' : needsTsRebuild();

if (nativeReason) {
  console.error(`[socketcan] native rebuild (${nativeReason})`);
  run("node-gyp rebuild --arch=arm --openssl_fips=''");
} else {
  console.error('[socketcan] native binding up to date');
}

if (tsReason) {
  console.error(`[socketcan] typescript rebuild (${tsReason})`);
  run('npx tsc');
} else {
  console.error('[socketcan] typescript up to date');
}