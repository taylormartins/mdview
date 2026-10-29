// Reads bundled files from disk, or from the embedded assets when running as the packaged MdView.exe.
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
let sea = null;
try { const m = require('node:sea'); if (m.isSea()) sea = m; } catch { /* older Node: never packaged */ }

export const packaged = !!sea;
export const root = join(dirname(fileURLToPath(import.meta.url)), '..');
// Folder that holds optional user files (mdview.config.json): next to the EXE, or the repo root.
export const homeDir = sea ? dirname(process.execPath) : root;
export const asset = rel => sea ? Buffer.from(sea.getRawAsset(rel)) : readFileSync(join(root, rel));
export const assetText = rel => asset(rel).toString('utf8');
