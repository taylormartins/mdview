// Builds dist/MdView.exe: a single self-contained Windows executable (Node runtime + app + every library inside).
// Run: npm run build:exe   (needs: npm install). Close any running MdView.exe first or it cannot be overwritten.
// Steps: bundle to one CJS file -> Node single-executable blob with all assets -> copy node.exe -> set icon ->
// inject blob -> flip the PE subsystem to "windows" so no console window flashes when a .md is opened.
import { build } from 'esbuild';
import { inject } from 'postject';
import { rcedit } from 'rcedit';
import { readdirSync, statSync, writeFileSync, copyFileSync, mkdirSync, readFileSync, openSync, readSync, writeSync, closeSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, 'build'); const dist = join(root, 'dist');
mkdirSync(out, { recursive: true }); mkdirSync(dist, { recursive: true });

await build({
  entryPoints: [join(root, 'mdview.mjs')], bundle: true, platform: 'node', format: 'cjs', outfile: join(out, 'mdview.cjs'), logLevel: 'warning',
  banner: { js: "const __importMetaUrl = require('url').pathToFileURL(__filename).href;" }, define: { 'import.meta.url': '__importMetaUrl' },
});

const files = [];
const walk = d => { for (const e of readdirSync(d, { withFileTypes: true })) { const p = join(d, e.name); if (e.isDirectory()) walk(p); else files.push(p); } };
walk(join(root, 'vendor'));
files.push(join(root, 'src', 'viewer.css'), join(root, 'src', 'viewer.js'), join(root, 'assets', 'icon-32.png'), join(root, 'tests', 'sample.md'), join(root, 'tests', 'second.md'));
const assets = Object.fromEntries(files.map(f => [relative(root, f).split('\\').join('/'), f]));
writeFileSync(join(out, 'sea-config.json'), JSON.stringify({ main: join(out, 'mdview.cjs'), output: join(out, 'sea.blob'), disableExperimentalSEAWarning: true, assets }, null, 1));
const r = spawnSync(process.execPath, ['--experimental-sea-config', join(out, 'sea-config.json')], { stdio: 'inherit' });
if (r.status) process.exit(r.status);

const exe = join(dist, 'MdView.exe');
copyFileSync(process.execPath, exe);
await rcedit(exe, { icon: join(root, 'assets', 'mdview.ico'), 'version-string': { ProductName: 'MdView', FileDescription: 'MdView Markdown viewer', OriginalFilename: 'MdView.exe' }, 'product-version': '2.0.0', 'file-version': '2.0.0' });
await inject(exe, 'NODE_SEA_BLOB', readFileSync(join(out, 'sea.blob')), { sentinelFuse: 'NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2' });

// PE optional header: Subsystem is 2 bytes at (e_lfanew + 24 + 68). 3 = console, 2 = windows (no console window).
const fd = openSync(exe, 'r+'); const b4 = Buffer.alloc(4); readSync(fd, b4, 0, 4, 0x3c);
const pos = b4.readUInt32LE(0) + 24 + 68; writeSync(fd, Buffer.from([2, 0]), 0, 2, pos); closeSync(fd);
console.log('built', exe, (statSync(exe).size / 1048576).toFixed(0) + ' MB');
