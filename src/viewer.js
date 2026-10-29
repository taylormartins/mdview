// MdView client. Runs inside the generated page; everything it needs is injected by build.mjs as window.__MDV.
(function () {
  'use strict';
  const D = window.__MDV;                       // { md, file, key, themes, links, base, opts, math, mermaid, watch }
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const root = document.documentElement;
  const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  // ---------------------------------------------------------------- settings
  const STYLES = {
    pixel:    { name: 'Pixel',    size: 1, width: 'normal', space: 'normal' },
    document: { name: 'Document', size: 2, width: 'normal', space: 'normal' },
    reader:   { name: 'Reader',   size: 3, width: 'narrow', space: 'airy' },
    terminal: { name: 'Terminal', size: 1, width: 'wide',   space: 'tight' },
    compact:  { name: 'Compact',  size: 0, width: 'wide',   space: 'tight' },
  };
  const SIZES = [14, 16, 18, 20, 24];
  const DEFAULTS = { theme: 'castle', style: 'pixel', size: 1, width: 'normal', space: 'normal', toc: true, nums: true, wrap: false, view: 'doc' };
  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* storage can be blocked; the page still works */ } },
  };
  const S = Object.assign({}, DEFAULTS, D.opts.defaults || {}, store.get('mdview.settings', {}), D.opts.force || {});
  if (!D.themes.some(t => t.id === S.theme) && S.theme !== 'system') S.theme = DEFAULTS.theme;
  if (!STYLES[S.style]) S.style = DEFAULTS.style;
  if (D.opts.force && D.opts.force.style && STYLES[S.style]) { const p = STYLES[S.style]; Object.assign(S, { size: p.size, width: p.width, space: p.space }, D.opts.force); }
  const save = () => store.set('mdview.settings', S);

  const mq = window.matchMedia('(prefers-color-scheme: light)');
  const effTheme = () => S.theme === 'system' ? (mq.matches ? 'paper' : 'castle') : S.theme;
  function apply() {
    root.dataset.theme = effTheme(); root.dataset.style = S.style; root.dataset.width = S.width; root.dataset.space = S.space;
    root.style.setProperty('--fs', SIZES[S.size] + 'px');
    root.classList.toggle('noside', !S.toc);
    $('#b-toc').classList.toggle('on', S.toc);
    $$('.code').forEach(c => c.classList.toggle('wrap', S.wrap));
    $$('.code .ln').forEach(n => n.hidden = !S.nums || S.wrap);
    $$('#p-theme .tcard').forEach(b => b.classList.toggle('on', b.dataset.id === S.theme));
    for (const [k, grp] of [['style', S.style], ['width', S.width], ['space', S.space]])
      $$(`#p-style [data-set="${k}"]`).forEach(b => b.classList.toggle('on', b.dataset.val === grp));
    $('#sz').textContent = SIZES[S.size] + 'PX';
    $('#o-nums').classList.toggle('on', S.nums); $('#o-wrap').classList.toggle('on', S.wrap);
    $('#b-doc').classList.toggle('on', S.view === 'doc'); $('#b-src').classList.toggle('on', S.view === 'src');
  }
  mq.addEventListener && mq.addEventListener('change', () => { if (S.theme === 'system') { apply(); drawMermaid(); } });

  // ---------------------------------------------------------------- source segmentation (fences / inline code are never touched)
  const FENCE = /^ {0,3}(`{3,}|~{3,})(.*)$/;
  function segment(src) {
    const out = []; const fnDefs = {}; let text = []; let fence = null; let fbuf = [];
    const flush = () => { if (text.length) { out.push({ code: false, text: text.join('\n') + '\n' }); text = []; } };
    const lines = src.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const ln = lines[i];
      if (fence) {
        fbuf.push(ln);
        const m = ln.match(/^ {0,3}(`{3,}|~{3,})\s*$/);
        if (m && m[1][0] === fence[0] && m[1].length >= fence.length) { out.push({ code: true, text: fbuf.join('\n') + '\n' }); fbuf = []; fence = null; }
        continue;
      }
      const f = ln.match(FENCE);
      if (f && !(f[1][0] === '`' && f[2].includes('`'))) { flush(); fence = f[1]; fbuf = [ln]; continue; }
      const fd = ln.match(/^\[\^([^\]\s]+)\]:\s*(.*)$/);
      if (fd) {
        let body = fd[2];
        while (i + 1 < lines.length && /^( {2,}|\t)\S/.test(lines[i + 1])) body += ' ' + lines[++i].trim();
        fnDefs[fd[1]] = body; continue;
      }
      text.push(ln);
    }
    if (fbuf.length) out.push({ code: true, text: fbuf.join('\n') + '\n' });
    flush();
    // split text chunks further on inline code spans
    const parts = [];
    for (const seg of out) {
      if (seg.code) { parts.push(seg); continue; }
      let last = 0; const re = /(`+)(?!`)([\s\S]*?[^`])\1(?!`)/g; let m;
      while ((m = re.exec(seg.text))) {
        if (m.index > last) parts.push({ code: false, text: seg.text.slice(last, m.index) });
        parts.push({ code: true, text: m[0] }); last = m.index + m[0].length;
      }
      if (last < seg.text.length) parts.push({ code: false, text: seg.text.slice(last) });
    }
    return { parts, fnDefs };
  }

  function frontMatter(src) {
    const m = src.match(/^﻿?---[ \t]*\r?\n([\s\S]*?)\r?\n(?:---|\.\.\.)[ \t]*(?:\r?\n|$)/);
    if (!m) return { meta: null, body: src };
    const meta = []; let cur = null;
    for (const raw of m[1].split(/\r?\n/)) {
      if (!raw.trim() || raw.trim().startsWith('#')) continue;
      const kv = raw.match(/^([A-Za-z0-9_.-]+):\s*(.*)$/);
      const li = raw.match(/^\s*-\s+(.*)$/);
      if (kv) { cur = { k: kv[1], v: kv[2].trim() }; meta.push(cur); }
      else if (li && cur) { cur.list = (cur.list || []); cur.list.push(li[1].trim()); }
      else if (cur) cur.v += ' ' + raw.trim();
    }
    if (!meta.length) return { meta: null, body: src };
    return { meta, body: src.slice(m[0].length) };
  }
  const unq = s => s.replace(/^(["'])(.*)\1$/, '$2');
  function metaCard(meta) {
    const dl = el('dl', 'fm');
    for (const m of meta) {
      const dt = el('dt', null, m.k); const dd = el('dd');
      let items = m.list;
      if (!items && /^\[.*\]$/.test(m.v)) items = m.v.slice(1, -1).split(',').map(x => x.trim()).filter(Boolean);
      if (items) items.forEach(t => dd.appendChild(el('span', 'tag', unq(t)))); else dd.textContent = unq(m.v);
      dl.append(dt, dd);
    }
    return dl;
  }

  // ---------------------------------------------------------------- render pipeline
  const slugs = new Map(); const mermaidSrc = []; // diagram source stays out of attributes: DOMPurify strips values containing "-->"
  const slug = raw => {
    let s = String(raw).toLowerCase().replace(/<[^>]*>/g, '').replace(/[^\p{L}\p{N}\s_-]/gu, '').trim().replace(/\s+/g, '-') || 'section';
    const n = slugs.get(s) || 0; slugs.set(s, n + 1); return n ? s + '-' + n : s;
  };
  marked.use({
    gfm: true, breaks: false,
    renderer: {
      heading(text, level, raw) { const id = slug(raw); return `<h${level} id="${id}">${text}<a class="anchor" href="#${id}" aria-label="Link to this section">#</a></h${level}>\n`; },
      code(code, info) {
        const lang = (info || '').match(/^\S*/)[0];
        if (lang === 'mermaid') return `<div class="mermaid-box" data-i="${mermaidSrc.push(code) - 1}"><pre class="mermaid-raw">${esc(code)}</pre></div>\n`;
        return `<pre><code class="language-${esc(lang)}">${esc(code)}</code></pre>\n`;
      },
    },
  });

  const maths = [];
  function prepare(body) {
    const { parts, fnDefs } = segment(body);
    const order = []; const noteRe = /\[\^([^\]\s]+)\](?!:)/g;
    let text = parts.map(p => {
      if (p.code) return p.text;
      let t = p.text.replace(noteRe, (all, id) => {
        if (!(id in fnDefs)) return all;
        if (!order.includes(id)) order.push(id);
        const n = order.indexOf(id) + 1;
        return `<sup class="fnref" id="fnref-${esc(id)}"><a href="#fn-${esc(id)}">${n}</a></sup>`;
      });
      if (D.math) {
        t = t.replace(/\$\$([\s\S]+?)\$\$/g, (a, tex) => `\n\n⟦D${maths.push(tex.trim()) - 1}⟧\n\n`);
        t = t.replace(/(?<![\\$\w])\$(?![\s$])([^$\n]+?)(?<![\s\\])\$(?![\w$])/g, (a, tex) => `⟦I${maths.push(tex) - 1}⟧`);
      }
      return t;
    }).join('');
    return { text, fnDefs, order };
  }

  function footnotesHtml(fnDefs, order) {
    if (!order.length) return '';
    const li = order.map(id => `<li id="fn-${esc(id)}">${marked.parseInline(fnDefs[id])} <a class="fnback" href="#fnref-${esc(id)}" aria-label="Back to text">back</a></li>`).join('');
    return `<section class="footnotes"><h2 id="footnotes">Footnotes</h2><ol>${li}</ol></section>`;
  }

  const EMOJI = { smile: '😄', grin: '😁', joy: '😂', wink: '😉', heart: '❤️', thumbsup: '👍', '+1': '👍', '-1': '👎', tada: '🎉', rocket: '🚀', fire: '🔥', star: '⭐',
    sparkles: '✨', warning: '⚠️', x: '❌', white_check_mark: '✅', heavy_check_mark: '✔️', check: '✔️', bulb: '💡', memo: '📝', book: '📖', bug: '🐛', wrench: '🔧', hammer: '🔨',
    lock: '🔒', key: '🔑', link: '🔗', eyes: '👀', thinking: '🤔', pray: '🙏', clap: '👏', muscle: '💪', zap: '⚡', boom: '💥', bomb: '💣', package: '📦', gear: '⚙️', mag: '🔍',
    construction: '🚧', question: '❓', exclamation: '❗', information_source: 'ℹ️', point_right: '👉', arrow_right: '➡️', hourglass: '⏳', alarm_clock: '⏰', calendar: '📅',
    chart_with_upwards_trend: '📈', trophy: '🏆', gem: '💎', crown: '👑', sword: '🗡️', shield: '🛡️', skull: '💀', ghost: '👻', robot: '🤖', cat: '🐱', dog: '🐶', coffee: '☕', pizza: '🍕' };

  function walkText(rootEl, fn) {
    const w = document.createTreeWalker(rootEl, NodeFilter.SHOW_TEXT, { acceptNode: n =>
      n.parentElement.closest('code,pre,script,style,svg,.katex,.mermaid-box,mark.hit') ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT });
    const nodes = []; while (w.nextNode()) nodes.push(w.currentNode);
    nodes.forEach(fn);
  }

  const doc = $('#doc'); let tocItems = []; let stats = { words: 0, lines: 0, heads: 0 };
  function render() {
    const fm = frontMatter(D.md);
    const { text, fnDefs, order } = prepare(fm.body);
    const html = marked.parse(text) + footnotesHtml(fnDefs, order);
    doc.innerHTML = DOMPurify.sanitize(html);
    if (fm.meta) doc.prepend(metaCard(fm.meta));

    // math placeholders -> KaTeX
    if (D.math && maths.length && window.katex) {
      walkText(doc, n => {
        if (!/⟦[DI]\d+⟧/.test(n.nodeValue)) return;
        const frag = document.createDocumentFragment(); let last = 0; const s = n.nodeValue; const re = /⟦([DI])(\d+)⟧/g; let m;
        while ((m = re.exec(s))) {
          frag.append(s.slice(last, m.index)); last = m.index + m[0].length;
          const disp = m[1] === 'D'; const box = el(disp ? 'div' : 'span', disp ? 'math-block' : 'math');
          try { katex.render(maths[+m[2]], box, { displayMode: disp, throwOnError: false, output: 'htmlAndMathml' }); } catch (e) { box.textContent = maths[+m[2]]; }
          frag.append(box);
        }
        frag.append(s.slice(last)); n.replaceWith(frag);
      });
      $$('p', doc).forEach(p => { const k = p.children; if (k.length === 1 && k[0].classList.contains('math-block') && !p.textContent.replace(k[0].textContent, '').trim()) p.replaceWith(k[0]); });
    }
    // emoji shortcodes
    walkText(doc, n => { if (n.nodeValue.includes(':')) { const v = n.nodeValue.replace(/:([a-z0-9_+-]+):/g, (a, k) => EMOJI[k] || a); if (v !== n.nodeValue) n.nodeValue = v; } });
    alerts(); codeBlocks(); tables(); links(); images();
    document.title = ($('h1', doc) ? $('h1', doc).textContent.replace(/#$/, '').trim() + ' - ' : '') + D.file.name;
    buildToc(); statsBar();
  }

  function alerts() {
    $$('blockquote', doc).forEach(bq => {
      const p = bq.firstElementChild; if (!p || p.tagName !== 'P') return;
      const m = p.innerHTML.match(/^\s*\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]\s*(?:<br\s*\/?>|\n)?/i); if (!m) return;
      const kind = m[1].toLowerCase(); p.innerHTML = p.innerHTML.slice(m[0].length);
      if (!p.textContent.trim() && !p.children.length) p.remove();
      const box = el('div', 'alert ' + kind); box.append(el('span', 'at', m[1]));
      while (bq.firstChild) box.append(bq.firstChild); bq.replaceWith(box);
    });
  }

  function makeCode(text, lang, opts) {
    const wrap = el('div', 'code'); const nl = text.replace(/\n$/, '').split('\n').length;
    const bar = el('div', 'bar'); bar.append(el('span', 'pixel-text', lang || 'text'));
    const cp = el('button', 'btn pixel-text', 'Copy'); cp.type = 'button'; cp.title = 'Copy to clipboard';
    cp.onclick = () => copyText(text.replace(/\n$/, ''), cp, 'Copy');
    bar.append(cp); if (!(opts && opts.nobar)) wrap.append(bar);
    const body = el('div', 'body'); const ln = el('pre', 'ln'); ln.setAttribute('aria-hidden', 'true');
    ln.textContent = Array.from({ length: nl }, (_, i) => i + 1).join('\n');
    const pre = el('pre'); const code = el('code'); pre.append(code);
    let done = false;
    if (lang && window.hljs && hljs.getLanguage(lang)) {
      try { code.innerHTML = hljs.highlight(text.replace(/\n$/, ''), { language: lang, ignoreIllegals: true }).value; code.className = 'hljs'; done = true; } catch (e) { /* fall back to plain text */ }
    }
    if (!done) code.textContent = text.replace(/\n$/, '');
    body.append(ln, pre); wrap.append(body); return wrap;
  }
  function codeBlocks() {
    $$('pre > code', doc).forEach(c => {
      const pre = c.parentElement; if (pre.closest('.code')) return;
      const lang = ((c.className.match(/language-(\S+)/) || [])[1] || '').toLowerCase();
      pre.replaceWith(makeCode(c.textContent, lang));
    });
  }
  function copyText(t, btn, label) {
    const done = () => { btn.textContent = 'Copied'; setTimeout(() => { btn.textContent = label; }, 1200); };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(t).then(done, () => fallbackCopy(t, done));
    else fallbackCopy(t, done);
  }
  function fallbackCopy(t, done) { const ta = el('textarea'); ta.value = t; ta.style.cssText = 'position:fixed;left:-999px'; document.body.append(ta); ta.select(); try { document.execCommand('copy'); done(); } catch (e) { /* no clipboard */ } ta.remove(); }

  function tables() {
    $$('table', doc).forEach(t => {
      const w = el('div', 'tbl'); t.replaceWith(w); w.append(t);
      const rows = $$('tbody tr', t); if (rows.length < 2) return;
      $$('thead th', t).forEach((th, ci) => {
        th.classList.add('sortable'); th.tabIndex = 0; th.title = 'Click to sort';
        const go = () => {
          const asc = th.getAttribute('aria-sort') !== 'ascending';
          $$('thead th', t).forEach(o => o.removeAttribute('aria-sort')); th.setAttribute('aria-sort', asc ? 'ascending' : 'descending');
          const val = r => (r.cells[ci] ? r.cells[ci].textContent.trim() : '');
          const num = s => { const n = parseFloat(s.replace(/[,$%\s]/g, '')); return isNaN(n) || !/^[-+$]?[\d.,]+%?$/.test(s.replace(/\s/g, '')) ? null : n; };
          const body = t.tBodies[0]; const sorted = rows.slice().sort((a, b) => {
            const x = val(a), y = val(b), nx = num(x), ny = num(y);
            const c = nx != null && ny != null ? nx - ny : x.localeCompare(y, undefined, { numeric: true, sensitivity: 'base' });
            return asc ? c : -c;
          });
          sorted.forEach(r => body.append(r));
        };
        th.onclick = go; th.onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); } };
      });
    });
  }

  function links() {
    const base = new URL(D.base);
    $$('a[href]', doc).forEach(a => {
      const h = a.getAttribute('href');
      if (h.startsWith('#') || a.classList.contains('anchor') || a.closest('.footnotes,.fnref')) { a.dataset.local = '1'; return; }
      if (/^(https?:|mailto:)/i.test(h)) { a.target = '_blank'; a.rel = 'noopener noreferrer'; if (!a.querySelector('img')) a.classList.add('ext'); return; }
      try {
        const u = new URL(h, base); const hash = u.hash; u.hash = '';
        const mapped = D.links[u.href] || D.links[decodeURI(u.href)];
        if (mapped) a.href = mapped + hash; else a.href = u.href + hash;
      } catch (e) { /* leave as written */ }
    });
  }
  function images() {
    $$('img', doc).forEach(img => {
      img.loading = 'lazy';
      img.addEventListener('error', () => { const m = el('span', 'img-missing', 'image missing: ' + (img.alt || img.getAttribute('src') || '')); img.replaceWith(m); }, { once: true });
      img.addEventListener('load', () => {
        if (img.naturalWidth && img.naturalWidth <= 128 && img.naturalHeight <= 128) img.classList.add('pix');
        if (!img.closest('a')) { img.classList.add('zoomable'); img.title = img.title || 'Click to enlarge'; }
      }, { once: true });
      img.addEventListener('click', () => { if (img.closest('a')) return; const lb = $('#lightbox'); $('img', lb).src = img.currentSrc || img.src; lb.hidden = false; });
    });
  }

  // ---------------------------------------------------------------- mermaid
  let mermaidReady = false;
  function drawMermaid() {
    const boxes = $$('.mermaid-box', doc); if (!boxes.length || !window.mermaid) return;
    const c = getComputedStyle(root); const v = k => c.getPropertyValue('--' + k).trim();
    try {
      mermaid.initialize({ startOnLoad: false, securityLevel: 'strict', theme: 'base', fontFamily: 'Consolas, monospace',
        themeVariables: { background: v('panel'), primaryColor: v('raised'), primaryTextColor: v('text'), primaryBorderColor: v('accent'), lineColor: v('muted'),
          secondaryColor: v('accentdark'), tertiaryColor: v('panel'), mainBkg: v('raised'), nodeBorder: v('accent'), clusterBkg: v('panel'), clusterBorder: v('line'),
          titleColor: v('text'), edgeLabelBackground: v('panel'), textColor: v('text'), noteBkgColor: v('accentdark'), noteTextColor: v('text'), noteBorderColor: v('accent'),
          actorBkg: v('raised'), actorBorder: v('accent'), actorTextColor: v('text'), actorLineColor: v('muted'), signalColor: v('text'), signalTextColor: v('text'),
          labelBoxBkgColor: v('raised'), labelBoxBorderColor: v('accent'), labelTextColor: v('text'), loopTextColor: v('text'), activationBkgColor: v('accentdark'),
          pie1: v('accent'), pie2: v('fn'), pie3: v('str'), pie4: v('kw'), pie5: v('type'), pie6: v('num'), pieTitleTextColor: v('text'), pieSectionTextColor: v('canvas'), pieLegendTextColor: v('text') } });
    } catch (e) { return; }
    boxes.forEach((b, i) => {
      const src = mermaidSrc[+b.dataset.i]; mermaid.render('mdv-mmd-' + (++mmdN), src).then(r => { b.innerHTML = r.svg; }, err => {
        b.innerHTML = ''; const m = el('div', 'merr', 'Diagram error: ' + String((err && err.message) || err).split('\n')[0]); b.append(m, el('pre', 'mermaid-raw', src));
      });
    });
    mermaidReady = true;
  }
  let mmdN = 0;

  // ---------------------------------------------------------------- outline + scrollspy + status
  const scroller = $('#scroll');
  function buildToc() {
    const toc = $('#toc'); toc.textContent = ''; tocItems = [];
    $$('h1,h2,h3,h4', doc).forEach(h => {
      const a = el('a', null, h.textContent.replace(/#$/, '').trim()); a.href = '#' + h.id; a.dataset.l = h.tagName[1]; a.dataset.local = '1';
      toc.append(a); tocItems.push({ h, a });
    });
    if (!tocItems.length) toc.append(el('div', 'none', 'No headings in this file.'));
    stats.heads = tocItems.length;
  }
  function statsBar() {
    const t = doc.innerText || ''; stats.words = (t.match(/\S+/g) || []).length; stats.lines = D.md.split('\n').length;
    $('#st-words').textContent = stats.words.toLocaleString(); $('#st-min').textContent = Math.max(1, Math.round(stats.words / 230));
    $('#st-lines').textContent = stats.lines.toLocaleString(); $('#st-heads').textContent = stats.heads;
  }
  const prog = $('#prog'); for (let i = 0; i < 20; i++) prog.append(document.createElement('i'));
  let ticking = false;
  function onScroll() {
    if (ticking) return; ticking = true;
    requestAnimationFrame(() => {
      ticking = false;
      const max = scroller.scrollHeight - scroller.clientHeight; const f = max > 0 ? scroller.scrollTop / max : 1;
      const n = Math.round(f * 20); $$('i', prog).forEach((i, k) => i.classList.toggle('f', k < n)); $('#st-pct').textContent = Math.round(f * 100) + '%';
      if (S.view === 'doc' && tocItems.length) {
        const y = scroller.scrollTop + 40; let cur = null;
        for (const it of tocItems) { if (it.h.offsetTop <= y) cur = it; else break; }
        tocItems.forEach(it => it.a.classList.toggle('on', it === cur));
        if (cur) { const t = $('#toc'); const r = cur.a.offsetTop; if (r < t.scrollTop || r > t.scrollTop + t.clientHeight - 40) t.scrollTop = r - 60; }
      }
      savePos(f);
    });
  }
  let posTimer = 0;
  function savePos(f) { clearTimeout(posTimer); posTimer = setTimeout(() => { const all = store.get('mdview.pos', {}); all[D.key] = { f, t: Date.now() }; const keys = Object.keys(all); if (keys.length > 60) keys.sort((a, b) => all[a].t - all[b].t).slice(0, keys.length - 60).forEach(k => delete all[k]); store.set('mdview.pos', all); }, 250); }
  scroller.addEventListener('scroll', onScroll, { passive: true });

  // ---------------------------------------------------------------- source view
  let srcBuilt = false;
  function buildSource() {
    if (srcBuilt) return; srcBuilt = true;
    const w = $('#srcwrap'); w.append(makeCode(D.md, 'markdown', { nobar: true })); apply();
  }
  function setView(v) {
    clearFind(); S.view = v; save(); const src = v === 'src';
    if (src) buildSource();
    $('#doc').hidden = src; $('#srcwrap').hidden = !src; $('#side').classList.toggle('off', src);
    apply(); scroller.scrollTop = 0; onScroll();
  }

  // ---------------------------------------------------------------- find
  const fbar = $('#find'), finp = $('#find input'); let hits = []; let cur = -1; let caseSens = false; let ftimer = 0;
  function clearFind() {
    $$('mark.hit').forEach(m => { const p = m.parentNode; p.replaceChild(document.createTextNode(m.textContent), m); p.normalize(); });
    hits = []; cur = -1; $('#fcount').textContent = '';
  }
  function runFind() {
    clearFind(); const q = finp.value; if (!q) return;
    const rootEl = S.view === 'src' ? $('#srcwrap pre:not(.ln)') : doc;
    const re = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), caseSens ? 'g' : 'gi'); const nodes = [];
    const w = document.createTreeWalker(rootEl, NodeFilter.SHOW_TEXT, { acceptNode: n => n.parentElement.closest('svg,.katex-mathml,.code .bar,script,style') ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT });
    while (w.nextNode()) nodes.push(w.currentNode);
    outer: for (const n of nodes) {
      const s = n.nodeValue; re.lastIndex = 0; let m, last = 0, frag = null;
      while ((m = re.exec(s))) {
        if (!m[0]) { re.lastIndex++; continue; }
        frag = frag || document.createDocumentFragment(); frag.append(s.slice(last, m.index));
        const mk = el('mark', 'hit', m[0]); frag.append(mk); hits.push(mk); last = m.index + m[0].length;
        if (hits.length >= 3000) { frag.append(s.slice(last)); n.replaceWith(frag); break outer; }
      }
      if (frag) { frag.append(s.slice(last)); n.replaceWith(frag); }
    }
    if (hits.length) go(0); else $('#fcount').textContent = '0';
  }
  function go(i) {
    if (!hits.length) return; if (hits[cur]) hits[cur].classList.remove('cur');
    cur = (i + hits.length) % hits.length; const h = hits[cur]; h.classList.add('cur');
    const r = h.getBoundingClientRect(), sr = scroller.getBoundingClientRect();
    if (r.top < sr.top + 70 || r.bottom > sr.bottom - 20) scroller.scrollTop += r.top - sr.top - sr.height / 3;
    $('#fcount').textContent = (cur + 1) + '/' + hits.length + (hits.length >= 3000 ? '+' : '');
  }
  function openFind(sel) { fbar.hidden = false; $('#b-find').classList.add('on'); finp.focus(); if (sel) { const s = String(getSelection()).trim(); if (s && s.length < 80 && !s.includes('\n')) finp.value = s; } finp.select(); if (finp.value) runFind(); }
  function closeFind() { fbar.hidden = true; $('#b-find').classList.remove('on'); clearFind(); }
  finp.addEventListener('input', () => { clearTimeout(ftimer); ftimer = setTimeout(runFind, 90); });
  finp.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); go(cur + (e.shiftKey ? -1 : 1)); } else if (e.key === 'Escape') closeFind(); });
  $('#f-prev').onclick = () => go(cur - 1); $('#f-next').onclick = () => go(cur + 1); $('#f-close').onclick = closeFind;
  $('#f-case').onclick = e => { caseSens = !caseSens; e.currentTarget.classList.toggle('on', caseSens); runFind(); };
  $('#b-find').onclick = () => (fbar.hidden ? openFind(true) : closeFind());

  // ---------------------------------------------------------------- popovers (closing click is consumed)
  const pops = { theme: $('#p-theme'), style: $('#p-style') };
  const popBtn = { theme: $('#b-theme'), style: $('#b-style') };
  function closePops() { for (const k in pops) { pops[k].hidden = true; popBtn[k].classList.remove('on'); } }
  function togglePop(k) { const open = pops[k].hidden; closePops(); if (open) { pops[k].hidden = false; popBtn[k].classList.add('on'); } }
  popBtn.theme.onclick = () => togglePop('theme'); popBtn.style.onclick = () => togglePop('style');
  document.addEventListener('click', e => {
    const open = Object.values(pops).some(p => !p.hidden);
    if (open && !e.target.closest('.pop') && !e.target.closest('#b-theme,#b-style')) { closePops(); e.preventDefault(); e.stopPropagation(); }
  }, true);

  // theme cards
  const tg = $('#themes');
  [{ id: 'system', name: 'System', colors: null }].concat(D.themes).forEach(t => {
    const b = el('button', 'tcard'); b.type = 'button'; b.dataset.id = t.id;
    const sw = el('div', 'sw'); const c = t.colors || (mq.matches ? D.themes.find(x => x.id === 'paper') : D.themes[0]).colors;
    ['canvas', 'panel', 'raised', 'line', 'accent', 'text'].forEach(k => { const i = el('i'); i.style.background = c[k]; sw.append(i); });
    b.append(sw, el('span', 'pixel-text', t.name)); b.onclick = () => { S.theme = t.id; save(); apply(); drawMermaid(); }; tg.append(b);
  });
  // style panel
  const sty = $('#sty'); Object.entries(STYLES).forEach(([id, s]) => { const b = el('button', 'btn pixel-text', s.name); b.type = 'button'; b.dataset.set = 'style'; b.dataset.val = id;
    b.onclick = () => { S.style = id; S.size = s.size; S.width = s.width; S.space = s.space; save(); apply(); drawMermaid(); }; sty.append(b); });
  $$('#p-style [data-set]').forEach(b => { if (b.dataset.set !== 'style') b.onclick = () => { S[b.dataset.set] = b.dataset.val; save(); apply(); }; });
  const bump = d => { S.size = Math.max(0, Math.min(SIZES.length - 1, S.size + d)); save(); apply(); };
  $('#sz-dn').onclick = () => bump(-1); $('#sz-up').onclick = () => bump(1);
  $('#o-nums').onclick = () => { S.nums = !S.nums; save(); apply(); }; $('#o-wrap').onclick = () => { S.wrap = !S.wrap; save(); apply(); };
  $('#o-reset').onclick = () => { Object.assign(S, DEFAULTS); save(); apply(); drawMermaid(); };
  $('#o-copy').onclick = e => copyText(D.md, e.currentTarget, 'Copy MD');
  $('#o-print').onclick = () => { closePops(); setTimeout(() => window.print(), 50); };
  $('#o-save').onclick = () => {
    const css = Array.from(document.styleSheets).map(s => { try { return Array.from(s.cssRules).map(r => r.cssText).join('\n'); } catch (e) { return ''; } }).join('\n');
    const page = `<!doctype html><html data-theme="${effTheme()}" data-style="${S.style}" data-width="${S.width}" data-space="${S.space}" style="--fs:${SIZES[S.size]}px"><head><meta charset="utf-8"><title>${esc(document.title)}</title><style>${css}</style></head><body style="overflow:auto;height:auto"><main id="doc">${doc.innerHTML}</main></body></html>`;
    const a = el('a'); a.href = URL.createObjectURL(new Blob([page], { type: 'text/html' })); a.download = D.file.name.replace(/\.[^.]+$/, '') + '.html'; document.body.append(a); a.click(); a.remove();
  };

  // ---------------------------------------------------------------- misc controls
  $('#b-toc').onclick = () => { S.toc = !S.toc; save(); apply(); };
  $('#b-doc').onclick = () => setView('doc'); $('#b-src').onclick = () => setView('src');
  $('#b-back').onclick = () => history.back(); $('#b-back').disabled = history.length < 2;
  $('#b-help').onclick = () => { closePops(); $('#help').hidden = false; };
  $('#help').onclick = e => { if (!e.target.closest('.box') || e.target.closest('#h-close')) $('#help').hidden = true; };
  $('#lightbox').onclick = () => { $('#lightbox').hidden = true; };
  const zen = on => { root.classList.toggle('zen', on); $('#zen-exit').hidden = !on; };
  $('#zen-exit').onclick = () => zen(false);
  const cycle = d => { const ids = ['system'].concat(D.themes.map(t => t.id)); S.theme = ids[(ids.indexOf(S.theme) + d + ids.length) % ids.length]; save(); apply(); drawMermaid(); };

  // anchors scroll inside the viewer (the <base> tag would otherwise send "#x" to the folder)
  document.addEventListener('click', e => {
    const a = e.target.closest('a[data-local]'); if (!a) return;
    const id = decodeURIComponent(a.getAttribute('href').slice(1)); e.preventDefault();
    const t = id ? document.getElementById(id) : null; if (!t) { scroller.scrollTop = 0; return; }
    if (t.closest('#doc')) scroller.scrollTop = t.offsetTop - 12; else t.scrollIntoView();
  });

  document.addEventListener('keydown', e => {
    const typing = e.target.matches('input,textarea');
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') { e.preventDefault(); openFind(true); return; }
    if (e.key === 'Escape') { if (!$('#help').hidden) $('#help').hidden = true; else if (!$('#lightbox').hidden) $('#lightbox').hidden = true; else if (Object.values(pops).some(p => !p.hidden)) closePops(); else if (!fbar.hidden) closeFind(); else if (root.classList.contains('zen')) zen(false); return; }
    if (typing || e.ctrlKey || e.metaKey || e.altKey) return;
    const k = e.key;
    if (k === '/' || k === 'f') { e.preventDefault(); openFind(true); }
    else if (k === 't') { S.toc = !S.toc; save(); apply(); }
    else if (k === 's') setView(S.view === 'doc' ? 'src' : 'doc');
    else if (k === 'z') zen(!root.classList.contains('zen'));
    else if (k === '[') cycle(-1); else if (k === ']') cycle(1);
    else if (k === '+' || k === '=') bump(1); else if (k === '-') bump(-1);
    else if (k === '?') { $('#help').hidden = false; }
    else if (k === 'n') go(cur + 1); else if (k === 'N') go(cur - 1);
    else if (k === 'j') scroller.scrollTop += 60; else if (k === 'k') scroller.scrollTop -= 60;
    else if (k === 'g') scroller.scrollTop = 0; else if (k === 'G') scroller.scrollTop = scroller.scrollHeight;
  });

  // ---------------------------------------------------------------- go
  $('.fname').textContent = D.file.name; $('.fpath').textContent = D.file.dir; $('.fpath').title = D.file.dir + '\\' + D.file.name;
  render(); apply();
  if (D.mermaid) { drawMermaid(); }
  if (S.view === 'src') setView('src');
  if (D.opts.open) { const o = D.opts.open; if (o === 'theme' || o === 'style') togglePop(o); else if (o === 'help') $('#help').hidden = false; }
  if (D.opts.find) { finp.value = D.opts.find; openFind(false); }
  const initial = location.hash && document.getElementById(decodeURIComponent(location.hash.slice(1)));
  const restore = () => {
    if (initial) scroller.scrollTop = initial.offsetTop - 12;
    else { const p = store.get('mdview.pos', {})[D.key]; if (p && !D.opts.fresh) scroller.scrollTop = p.f * Math.max(0, scroller.scrollHeight - scroller.clientHeight); }
    onScroll();
  };
  restore(); window.addEventListener('load', () => { setTimeout(restore, 60); });
  window.__mdvReady = true;

  // --watch: the CLI rewrites a stamp file when the markdown changes; reload when it moves
  if (D.watch) {
    let known = null;
    setInterval(() => {
      const s = document.createElement('script'); s.src = D.watch + '?t=' + Date.now();
      s.onload = () => { const v = window.__mdvStamp; s.remove(); if (known == null) known = v; else if (v !== known) location.reload(); };
      s.onerror = () => s.remove(); document.head.append(s);
    }, 1000);
  }
})();
