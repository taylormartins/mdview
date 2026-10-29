// Smoke test: drives the viewer's own rendered page headless and prints PASS/FAIL per check.
// Setup: npm install (gets puppeteer-core). Browser: set MDVIEW_BROWSER to an Edge/Chrome exe if the default is not found.
import puppeteer from 'puppeteer-core';
import { spawnSync } from 'node:child_process';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { existsSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const browser = [process.env.MDVIEW_BROWSER, 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Google/Chrome/Application/chrome.exe', '/usr/bin/google-chrome', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'].find(p => p && existsSync(p));
if (!browser) { console.error('No Edge/Chrome found: set MDVIEW_BROWSER'); process.exit(1); }
const build = (md, ...f) => spawnSync('node', [join(root, 'mdview.mjs'), md, '--no-open', '--fresh', ...f], { encoding: 'utf8' }).stdout.trim().split('\n')[0];
const b = await puppeteer.launch({ executablePath: browser, headless: 'new' });
const results = []; const chk = (n, ok, extra = '') => { results.push(ok); console.log(ok ? 'PASS' : 'FAIL', n, extra); };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const open = async (md, ...f) => { const p = await b.newPage(); await p.setViewport({ width: 1400, height: 900 }); p.errs = []; p.on('pageerror', e => p.errs.push(e.message)); await p.goto(pathToFileURL(build(md, ...f)).href); await sleep(900); return p; };
const S = join(root, 'tests', 'sample.md');
let p = await open(S);
const ev = (fn, ...a) => p.evaluate(fn, ...a);

// find
await p.keyboard.press('/'); await sleep(100); await p.keyboard.type('pixel'); await sleep(300);
const hits = await ev(() => document.querySelectorAll('mark.hit').length); chk('find highlights', hits >= 3, hits + ' hits');
await p.keyboard.press('Enter'); await sleep(100);
chk('find cur moves', await ev(() => document.querySelector('#fcount').textContent.startsWith('2/')), await ev(() => document.querySelector('#fcount').textContent));
await p.click('#f-close'); chk('find clears', await ev(() => document.querySelectorAll('mark.hit').length === 0 && document.querySelector('#find').hidden));
// find must not destroy text
chk('doc text intact after find', await ev(() => document.querySelector('#doc').innerText.includes('Pixel-themed') || document.querySelector('#doc').innerText.toLowerCase().includes('pixel-themed')));

// table sort
await ev(() => document.querySelector('#doc table th:nth-child(3)').click());
let col = await ev(() => [...document.querySelectorAll('#doc table tbody tr td:nth-child(3)')].map(x => x.textContent));
chk('sort numeric asc', col.join() === '29,38,42,45', col.join());
await ev(() => document.querySelector('#doc table th:nth-child(4)').click()); await ev(() => document.querySelector('#doc table th:nth-child(4)').click());
col = await ev(() => [...document.querySelectorAll('#doc table tbody tr td:nth-child(4)')].map(x => x.textContent));
chk('sort percent desc', col.join() === '72%,61%,55%,48%', col.join());

// theme cycle + persistence
const th0 = await ev(() => document.documentElement.dataset.theme);
await p.keyboard.press(']'); await sleep(100);
const th1 = await ev(() => document.documentElement.dataset.theme); chk('theme cycles with ]', th0 !== th1, th0 + '->' + th1);
await ev(() => document.querySelector('.tcard[data-id=forest]').click() || 1);
// theme panel button path
await p.click('#b-theme'); await p.click('.tcard[data-id=lagoon]'); chk('theme card applies', await ev(() => document.documentElement.dataset.theme === 'lagoon'));
// outside click closes and is consumed
await p.click('#doc h1'); chk('popover closes on outside click', await ev(() => document.querySelector('#p-theme').hidden));

// style preset
await p.click('#b-style'); await p.click('#sty [data-val=reader]');
chk('style preset sets width', await ev(() => document.documentElement.dataset.style === 'reader' && document.documentElement.dataset.width === 'narrow'));
await p.click('#sz-up'); chk('size steps', await ev(() => document.querySelector('#sz').textContent === '24PX'), await ev(() => document.querySelector('#sz').textContent));
await p.click('#doc h1'); // close

// outline anchor click scrolls inside viewer, URL not changed
const url0 = p.url();
await p.click('#toc a:nth-child(4)'); await sleep(200);
chk('toc click scrolls', await ev(() => document.querySelector('#scroll').scrollTop > 100), String(await ev(() => document.querySelector('#scroll').scrollTop)));
chk('toc click keeps url', p.url().split('#')[0] === url0.split('#')[0]);
chk('scrollspy marks active', await ev(() => !!document.querySelector('#toc a.on')));

// source view
await p.keyboard.press('s'); await sleep(200);
chk('source view shows', await ev(() => !document.querySelector('#srcwrap').hidden && document.querySelector('#srcwrap .code') && document.querySelector('#doc').hidden));
await p.keyboard.press('/'); await p.keyboard.type('mermaid'); await sleep(300);
chk('find works in source', await ev(() => document.querySelectorAll('#srcwrap mark.hit').length >= 1), await ev(() => document.querySelectorAll('#srcwrap mark.hit').length));
await p.click('#f-close'); await p.keyboard.press('s'); await sleep(100);

// settings persistence (reload)
await p.reload(); await sleep(800);
chk('settings persist on reload', await ev(() => document.documentElement.dataset.style === 'reader' && document.documentElement.dataset.theme === 'lagoon'));
// reset
await p.click('#b-style'); await p.click('#o-reset'); chk('reset restores defaults', await ev(() => document.documentElement.dataset.theme === 'castle'));

await p.click('#doc h1'); // closes the open Style panel (click is consumed)
// linked page + back
await p.click('#doc a[href$=".html"], #doc a:not(.ext):not(.anchor):not([data-local])'); await sleep(900);
chk('relative md link opens rendered page', await ev(() => document.querySelector('.fname').textContent.toLowerCase() === 'second.md'), await ev(() => document.querySelector('.fname').textContent));
chk('back enabled on linked page', await ev(() => !document.querySelector('#b-back').disabled));
await p.click('#doc a:not(.anchor)'); await sleep(900);
chk('link back with #anchor', await ev(() => document.querySelector('.fname').textContent.toLowerCase() === 'sample.md' && location.hash === '#sortable-table'), await ev(() => location.hash));

// zen
p = await open(S); await p.keyboard.press('z');
chk('zen hides chrome', await ev(() => getComputedStyle(document.querySelector('#top')).display === 'none')); await p.click('#zen-exit');
chk('zen exit', await ev(() => getComputedStyle(document.querySelector('#top')).display !== 'none'));

// XSS: scripts and handlers in markdown must not run
const xss = join(tmpdir(), 'mdview-xss.md');
writeFileSync(xss, '# x\n\n<script>window.__pwn=1</script>\n<img src=x onerror="window.__pwn=2">\n[j](javascript:window.__pwn=3)\n\n</script><script>window.__pwn=4</script>\n');
p = await open(xss);
await p.click('#doc a[href^="javascript"]').catch(() => {}); await sleep(300);
chk('xss neutralised', await ev(() => !window.__pwn), String(await ev(() => window.__pwn)));
chk('no page errors', results.length > 0 && (await Promise.all((await b.pages()).map(x => x.errs || []))).flat().length === 0);
await b.close();
const ok = results.every(Boolean); console.log(ok ? 'ALL PASS' : 'SOME FAILED'); process.exit(ok ? 0 : 1);
