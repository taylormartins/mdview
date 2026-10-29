// Per-user Windows registration (HKCU only, no admin): "Open with" entry, right-click "View Markdown", and, when
// nothing else has claimed .md, the default. Works for both MdView.exe and the node + mdview.vbs setup.
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { packaged, root } from './assets.mjs';

const reg = (...a) => spawnSync('reg', a, { encoding: 'utf8', windowsHide: true });
const add = (key, name, value) => { const r = reg('add', key, ...(name ? ['/v', name] : ['/ve']), '/d', value, '/f'); if (r.status) throw new Error(r.stderr || ('reg add failed: ' + key)); };
const exts = ['.md', '.markdown', '.mdown'];
const PROG = 'HKCU\\Software\\Classes\\MdView.Markdown';

export function register() {
  const target = packaged ? process.execPath : join(root, 'mdview.vbs');
  const cmd = packaged ? `"${target}" "%1"` : `wscript.exe "${target}" "%1"`;
  const icon = packaged ? process.execPath : join(root, 'assets', 'mdview.ico');
  const notes = [];
  add(PROG, null, 'Markdown (MdView)');
  add(PROG + '\\DefaultIcon', null, packaged ? icon + ',0' : icon);
  add(PROG + '\\shell\\open\\command', null, cmd);
  for (const e of exts) {
    add(`HKCU\\Software\\Classes\\${e}\\OpenWithProgids`, 'MdView.Markdown', '');
    const m = `HKCU\\Software\\Classes\\SystemFileAssociations\\${e}\\shell\\MdView`;
    add(m, null, 'View Markdown'); add(m, 'Icon', packaged ? icon + ',0' : icon); add(m + '\\command', null, cmd);
  }
  // Windows keeps the user's explicit choice in a protected UserChoice key that no script may write.
  // With no such choice, the class default below decides, so MdView becomes the default for that extension.
  for (const e of exts) {
    const choice = reg('query', `HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\FileExts\\${e}\\UserChoice`, '/v', 'ProgId');
    if (choice.status === 0) {
      const id = (choice.stdout.match(/ProgId\s+REG_SZ\s+(\S+)/) || [])[1];
      if (id === 'MdView.Markdown') notes.push(`${e}: already MdView`);
      else notes.push(`${e}: you chose "${id}" earlier, so Windows keeps it (right-click > Open with > MdView > Always to switch)`);
    } else {
      add(`HKCU\\Software\\Classes\\${e}`, null, 'MdView.Markdown'); notes.push(`${e}: MdView is now the default`);
    }
  }
  return notes;
}

export function unregister() {
  for (const e of exts) {
    const cur = reg('query', `HKCU\\Software\\Classes\\${e}`, '/ve');
    if (/MdView\.Markdown/.test(cur.stdout || '')) reg('delete', `HKCU\\Software\\Classes\\${e}`, '/ve', '/f');
    reg('delete', `HKCU\\Software\\Classes\\${e}\\OpenWithProgids`, '/v', 'MdView.Markdown', '/f');
    reg('delete', `HKCU\\Software\\Classes\\SystemFileAssociations\\${e}\\shell\\MdView`, '/f');
  }
  reg('delete', PROG, '/f');
}
