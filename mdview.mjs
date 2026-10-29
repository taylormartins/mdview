// mdview: render a Markdown file to a local HTML page and open it in the default browser.
// Fully offline: every library is vendored and the page's Content-Security-Policy blocks network requests.
import { readFileSync, writeFileSync, existsSync, watchFile } from 'node:fs';
import { resolve, join } from 'node:path';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';
import { spawn, spawnSync } from 'node:child_process';
import { renderTree, outPathFor } from './src/build.mjs';
import { homeDir, packaged, assetText } from './src/assets.mjs';
import { register, unregister } from './src/register.mjs';

const USAGE = `usage: mdview <file.md> [options]
  --theme <id>      castle ember forest lagoon amber night parchment paper gameboy mono system
  --style <id>      pixel document reader terminal compact
  --src             open on the Markdown source view
  --find <text>     open with the find bar searching for <text>
  --open <panel>    open a panel: theme | style | help
  --watch           re-render and reload the page when the file changes (stays running)
  --remote-images   allow https images (off by default: the page is offline)
  --fresh           ignore the remembered scroll position
  --no-open         write the page but do not open a browser
  --register        (Windows) add MdView to Open with / right-click, and make it the default if nothing else is
  --unregister      remove those entries
  --quiet           with --register/--unregister: print instead of showing a message box`;

const args = process.argv.slice(2); const flags = {}; let file;
for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (a === '--help' || a === '-h') { console.log(USAGE); process.exit(0); }
  else if (['--theme', '--style', '--find', '--open'].includes(a)) flags[a.slice(2)] = args[++i];
  else if (a.startsWith('--')) flags[a.slice(2)] = true;
  else file ||= a;
}
// MdView.exe has no console, so tell the user through a message box (lines are joined with a bar: mshta cannot take newlines).
const say = lines => {
  const text = [].concat(lines).join('  |  ');
  if (flags.quiet) { console.log(text); return; }
  if (packaged) spawnSync('mshta', ['vbscript:Execute("MsgBox ""' + text.replace(/"/g, "'") + '"", 64, ""MdView"":close")'], { windowsHide: false });
  else console.log(text);
};
if (flags.register) { try { say(['MdView registered.', ...register()]); } catch (e) { say('Could not register: ' + e.message); process.exit(1); } process.exit(0); }
if (flags.unregister) { unregister(); say('MdView entries removed.'); process.exit(0); }
if (!file && packaged) { // double-clicked with no file: show the built-in tour
  file = join(tmpdir(), 'MdView-welcome.md'); writeFileSync(file, assetText('tests/sample.md'));
  writeFileSync(join(tmpdir(), 'second.md'), assetText('tests/second.md'));
}
if (!file) { console.error(USAGE); process.exit(1); }
const abs = resolve(file);
if (!existsSync(abs)) { console.error('mdview: file not found: ' + abs); process.exit(1); }

let conf = {};
try { conf = JSON.parse(readFileSync(join(homeDir, 'mdview.config.json'), 'utf8')); } catch { /* optional file */ }
const cfg = {
  remoteImages: !!(flags['remote-images'] ?? conf.remoteImages),
  defaults: { ...(conf.theme && { theme: conf.theme }), ...(conf.style && { style: conf.style }) },
  force: { ...(flags.theme && { theme: flags.theme }), ...(flags.style && { style: flags.style }), ...(flags.src && { view: 'src' }) },
  open: flags.open, find: flags.find, fresh: !!flags.fresh,
};

const out = outPathFor(abs);
const stamp = out + '.stamp.js';
const watchUrl = flags.watch ? pathToFileURL(stamp).href : '';
const stampNow = () => writeFileSync(stamp, `window.__mdvStamp=${Date.now()};`);
const r = renderTree(abs, cfg, watchUrl);
if (flags.watch) stampNow();
if (r.skipped) console.error(`mdview: rendered ${r.pages} pages; ${r.skipped} more linked files were not rendered (limit)`);

if (!flags['no-open']) {
  if (process.platform === 'win32') spawn('cmd', ['/c', 'start', '""', `"${out}"`], { detached: true, stdio: 'ignore', windowsVerbatimArguments: true }).unref();
  else spawn(process.platform === 'darwin' ? 'open' : 'xdg-open', [pathToFileURL(out).href], { detached: true, stdio: 'ignore' }).unref();
}
console.log(out);

if (flags.watch) {
  console.log('mdview: watching ' + abs + ' (Ctrl+C to stop; exits after 2 hours)');
  watchFile(abs, { interval: 500 }, () => {
    try { renderTree(abs, { ...cfg, fresh: false }, watchUrl); stampNow(); console.log('mdview: re-rendered'); } catch (e) { console.error('mdview: ' + e.message); }
  });
  setTimeout(() => process.exit(0), 2 * 3600 * 1000);
}
