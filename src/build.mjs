// Builds one self-contained HTML page for a Markdown file. Nothing here touches the network.
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, basename, resolve, join } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { THEMES, themeCss } from './themes.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const rd = p => readFileSync(join(root, p), 'utf8');
const b64 = p => readFileSync(join(root, p)).toString('base64');
export const OUT_DIR = join(tmpdir(), 'mdview');
const MD_EXT = /\.(md|markdown|mdown|mkd)$/i;
const MAX_LINKED = 30;

const cache = {};
const lib = p => (cache[p] ||= rd(p));
const safeScript = s => s.replace(/<\/script/gi, '<\\/script');
const hashOf = s => createHash('sha1').update(s.toLowerCase()).digest('hex').slice(0, 10);

const hasMath = md => /\$\$[\s\S]+?\$\$/.test(md) || /(?<![\\$\w])\$(?![\s$])[^$\n]+?(?<![\s\\])\$(?![\w$])/.test(md);
const hasMermaid = md => /^ {0,3}(`{3,}|~{3,})\s*mermaid\b/m.test(md);

function katexCss() {
  return lib('vendor/katex/katex.min.css')
    .replace(/,\s*url\(fonts\/[^)]+\.(?:woff|ttf)\) format\("[^"]+"\)/g, '')
    .replace(/url\(fonts\/([^)]+\.woff2)\)/g, (m, f) => `url(data:font/woff2;base64,${b64('vendor/katex/fonts/' + f)})`);
}

export function outPathFor(abs) {
  return join(OUT_DIR, basename(abs).replace(/[^\w.-]/g, '_') + '-' + hashOf(abs) + '.html');
}

// Linked Markdown files are rendered too (breadth-first, capped), so relative .md links open in the viewer instead of as raw text.
function findMdLinks(md, abs) {
  const dir = dirname(abs); const found = new Set();
  const re = /\]\(\s*<?([^)\s>]+)>?(?:\s+["'][^)]*["'])?\s*\)|^\s*\[[^\]]+\]:\s*(\S+)|href=["']([^"']+)["']/gm; let m;
  while ((m = re.exec(md))) {
    let t = m[1] || m[2] || m[3];
    if (!t || /^([a-z][a-z0-9+.-]*:|#|\/\/)/i.test(t)) continue;
    t = t.split('#')[0].split('?')[0];
    if (!MD_EXT.test(t)) continue;
    try { t = decodeURIComponent(t); } catch { /* use as written */ }
    const p = resolve(dir, t);
    if (existsSync(p)) found.add(p);
  }
  return [...found];
}

export function buildPage(abs, cfg, linksMap = {}, watchUrl = '') {
  const md = readFileSync(abs, 'utf8');
  const math = hasMath(md), mermaid = hasMermaid(md);
  const name = basename(abs); const dir = dirname(abs);
  const D = {
    md, file: { name, dir }, key: hashOf(abs), themes: THEMES, links: linksMap,
    base: pathToFileURL(dir + '/').href, math, mermaid, watch: watchUrl,
    opts: { defaults: cfg.defaults || {}, force: cfg.force || {}, open: cfg.open, find: cfg.find, fresh: !!cfg.fresh },
  };
  const BS = String.fromCharCode(92); // escape '<' and the JS line separators so the JSON can't close the script tag or break the literal
  const payload = JSON.stringify(D).split('<').join(BS + 'u003c').split(String.fromCharCode(0x2028)).join(BS + 'u2028').split(String.fromCharCode(0x2029)).join(BS + 'u2029');
  const csp = [`default-src 'none'`, `script-src 'unsafe-inline'${watchUrl ? ' file:' : ''}${mermaid ? " 'unsafe-eval'" : ''}`, `style-src 'unsafe-inline'`,
    `img-src file: data: blob:${cfg.remoteImages ? ' https:' : ''}`, `font-src data:`].join('; ');
  const css = lib('src/viewer.css').replace('__FONT__', `data:font/ttf;base64,${b64('vendor/fonts/Silkscreen-Regular.ttf')}`);
  const title = name.replace(/[<>&"]/g, '');

  return `<!doctype html>
<html lang="en" data-theme="castle"><head><meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="${csp}">
<meta name="viewport" content="width=device-width, initial-scale=1">
<base href="${D.base}">
<title>${title}</title>
<link rel="icon" href="data:image/png;base64,${b64('assets/icon-32.png')}">
<style>${themeCss()}</style>
<style>${css}</style>
${math ? `<style>${katexCss()}</style>` : ''}
</head><body>
<div id="app">
 <div id="top">
  <button class="btn pixel-text" id="b-back" type="button" title="Back">Back</button>
  <button class="btn pixel-text" id="b-toc" type="button" title="Outline (T)">Outline</button>
  <div class="title"><span class="fname pixel-text"></span><span class="fpath"></span></div>
  <button class="btn pixel-text" id="b-find" type="button" title="Find (Ctrl+F or /)">Find</button>
  <span class="seg"><button class="btn pixel-text on" id="b-doc" type="button" title="Rendered">Doc</button><button class="btn pixel-text" id="b-src" type="button" title="Markdown source (S)">Src</button></span>
  <button class="btn pixel-text" id="b-theme" type="button" title="Colour theme ([ and ])">Theme</button>
  <button class="btn pixel-text" id="b-style" type="button" title="Reading style">Style</button>
  <button class="btn pixel-text" id="b-help" type="button" title="Keys (?)">?</button>
  <div class="pop" id="p-theme" hidden><h4 class="pixel-text">Colour theme</h4><div class="themes" id="themes"></div></div>
  <div class="pop" id="p-style" hidden>
   <div class="row"><span class="lab pixel-text">Reading style</span><div class="seg" id="sty"></div></div>
   <div class="row"><span class="lab pixel-text">Text size</span><div class="stepper"><button class="btn pixel-text" id="sz-dn" type="button" aria-label="Smaller">A-</button><span class="val pixel-text" id="sz"></span><button class="btn pixel-text" id="sz-up" type="button" aria-label="Larger">A+</button></div></div>
   <div class="row"><span class="lab pixel-text">Width</span><div class="seg"><button class="btn pixel-text" data-set="width" data-val="narrow" type="button">Narrow</button><button class="btn pixel-text" data-set="width" data-val="normal" type="button">Normal</button><button class="btn pixel-text" data-set="width" data-val="wide" type="button">Wide</button><button class="btn pixel-text" data-set="width" data-val="full" type="button">Full</button></div></div>
   <div class="row"><span class="lab pixel-text">Spacing</span><div class="seg"><button class="btn pixel-text" data-set="space" data-val="tight" type="button">Tight</button><button class="btn pixel-text" data-set="space" data-val="normal" type="button">Normal</button><button class="btn pixel-text" data-set="space" data-val="airy" type="button">Airy</button></div></div>
   <div class="row"><span class="lab pixel-text">Code</span><div class="seg"><button class="btn pixel-text" id="o-nums" type="button">Line nums</button><button class="btn pixel-text" id="o-wrap" type="button">Wrap</button></div></div>
   <div class="row"><span class="lab pixel-text">File</span><div class="seg"><button class="btn pixel-text" id="o-save" type="button">Save HTML</button><button class="btn pixel-text" id="o-print" type="button">Print</button><button class="btn pixel-text" id="o-copy" type="button">Copy MD</button><button class="btn pixel-text" id="o-reset" type="button">Reset</button></div></div>
  </div>
 </div>
 <div id="mid">
  <nav id="side" aria-label="Outline"><h3 class="pixel-text">Outline</h3><div id="toc"></div></nav>
  <div id="scroll">
   <div id="find" hidden><input type="text" placeholder="Find in document" aria-label="Find in document" spellcheck="false"><span class="count pixel-text" id="fcount"></span>
    <button class="btn pixel-text" id="f-case" type="button" title="Match case">Aa</button><button class="btn pixel-text" id="f-prev" type="button" title="Previous (Shift+Enter)">Prev</button><button class="btn pixel-text" id="f-next" type="button" title="Next (Enter)">Next</button><button class="btn pixel-text" id="f-close" type="button">Close</button></div>
   <main id="doc"></main>
   <div id="srcwrap" hidden></div>
  </div>
 </div>
 <div id="bot" class="pixel-text"><span><b id="st-words">0</b> words</span><span><b id="st-min">0</b> min</span><span><b id="st-lines">0</b> lines</span><span><b id="st-heads">0</b> heads</span><span class="grow"></span><span id="prog"></span><span id="st-pct" style="min-width:56px;text-align:right">0%</span></div>
</div>
<div id="help" hidden><div class="box"><h4 class="pixel-text">Keys</h4><dl class="pixel-text">
 <dt>F or /</dt><dd>Find</dd><dt>N / Shift+N</dt><dd>Next / previous hit</dd><dt>T</dt><dd>Outline</dd><dt>S</dt><dd>Source / rendered</dd><dt>[ ]</dt><dd>Previous / next theme</dd>
 <dt>+ -</dt><dd>Text size</dd><dt>Z</dt><dd>Zen mode</dd><dt>J K</dt><dd>Scroll</dd><dt>G / Shift+G</dt><dd>Top / bottom</dd><dt>?</dt><dd>This list</dd></dl>
 <p style="margin:0 0 14px;color:var(--muted);font-size:14px">Tables sort when you click a header. Images open larger when clicked. Everything works offline.</p>
 <button class="btn pixel-text" id="h-close" type="button">Close</button></div></div>
<div id="lightbox" hidden><img alt=""></div>
<button class="btn pixel-text" id="zen-exit" type="button" hidden>Exit zen</button>
<script>${safeScript(lib('vendor/marked.min.js'))}</script>
<script>${safeScript(lib('vendor/purify.min.js'))}</script>
<script>${safeScript(lib('vendor/hljs/highlight.min.js'))}</script>
<script>${safeScript(lib('vendor/hljs/extras.min.js'))}</script>
${math ? `<script>${safeScript(lib('vendor/katex/katex.min.js'))}</script>` : ''}
${mermaid ? `<script>${safeScript(lib('vendor/mermaid/mermaid.min.js'))}</script>` : ''}
<script>window.__MDV = ${payload};</script>
<script>${safeScript(lib('src/viewer.js'))}</script>
</body></html>`;
}

// Render a file plus the Markdown files it links to. Returns the output path of the first one.
export function renderTree(abs, cfg, watchUrl = '') {
  mkdirSync(OUT_DIR, { recursive: true });
  const queue = [abs]; const seen = new Set([abs.toLowerCase()]); const order = [];
  while (queue.length && order.length < MAX_LINKED + 1) {
    const p = queue.shift(); order.push(p);
    for (const l of findMdLinks(readFileSync(p, 'utf8'), p)) if (!seen.has(l.toLowerCase())) { seen.add(l.toLowerCase()); queue.push(l); }
  }
  const map = {};
  for (const p of order) map[pathToFileURL(p).href] = pathToFileURL(outPathFor(p)).href;
  for (const p of order) {
    const c = p === abs ? cfg : { ...cfg, open: undefined, find: undefined };
    writeFileSync(outPathFor(p), buildPage(p, c, map, p === abs ? watchUrl : ''));
  }
  return { out: outPathFor(abs), pages: order.length, skipped: queue.length };
}
