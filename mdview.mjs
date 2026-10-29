// mdview: render a Markdown file to a local HTML page and open it in the default browser.
// Fully offline: libraries are vendored, and the page's CSP blocks every network request.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, basename, resolve, join } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { spawn } from 'node:child_process';

const here = dirname(fileURLToPath(import.meta.url));
const file = process.argv[2];
if (!file) {
  console.error('usage: mdview <file.md>');
  process.exit(1);
}
const abs = resolve(file);
const md = readFileSync(abs, 'utf8');
const marked = readFileSync(join(here, 'vendor/marked/marked.min.js'), 'utf8');
const purify = readFileSync(join(here, 'vendor/dompurify/dist/purify.min.js'), 'utf8');
const css = readFileSync(join(here, 'style.css'), 'utf8');

// JSON-encode the markdown and neutralise "</" so it can't close the script tag.
const payload = JSON.stringify(md).replace(/<\//g, '<\\/');
const title = basename(abs).replace(/[<>&"]/g, '');
const base = pathToFileURL(dirname(abs) + '/').href;

const html = `<!doctype html>
<html><head><meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src file: data:;">
<meta name="viewport" content="width=device-width, initial-scale=1">
<base href="${base}">
<title>${title}</title>
<style>${css}</style>
</head><body>
<header><span>${title}</span><span class="path">${abs.replace(/[<>&"]/g, '')}</span></header>
<main id="doc"></main>
<script>${marked}</script>
<script>${purify}</script>
<script>
  marked.setOptions({ gfm: true, breaks: false });
  document.getElementById('doc').innerHTML = DOMPurify.sanitize(marked.parse(${payload}));
  // Copy button on every code block, handy for pasting agent prompts.
  for (const pre of document.querySelectorAll('pre')) {
    const b = document.createElement('button');
    b.className = 'copy'; b.textContent = 'Copy';
    b.onclick = () => navigator.clipboard.writeText(pre.innerText.replace(/Copy(ed!)?$/, '')).then(() => { b.textContent = 'Copied!'; setTimeout(() => b.textContent = 'Copy', 1200); });
    pre.appendChild(b);
  }
</script>
</body></html>`;

const outDir = join(tmpdir(), 'mdview');
mkdirSync(outDir, { recursive: true });
const out = join(outDir, basename(abs).replace(/[^\w.-]/g, '_') + '.html');
writeFileSync(out, html);
spawn('cmd', ['/c', 'start', '', out], { detached: true, stdio: 'ignore' }).unref();
