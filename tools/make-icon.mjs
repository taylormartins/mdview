// Draws the 16x16 pixel icon and writes assets/mdview.ico (16/32/48/256, nearest-neighbour) plus assets/icon-32.png.
// Run: node tools/make-icon.mjs
import { writeFileSync, mkdirSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const art = [
  '................',
  '..KKKKKKKKK.....',
  '..KPPPPPPPKK....',
  '..KPPPPPPPKSK...',
  '..KPPPPPPPKKKK..',
  '..KPPPPPPPPPPK..',
  '..KPAPPPAPPPPK..',
  '..KPAAPAAPPPPK..',
  '..KPAPAPAPPPPK..',
  '..KPAPPPAPPPPK..',
  '..KPAPPPAPPPPK..',
  '..KPPPPPPPPPPK..',
  '..KPSSSSSSSPPK..',
  '..KPPPPPPPPPPK..',
  '..KPSSSSPPPPPK..',
  '..KKKKKKKKKKKK..',
];
const pal = { K: [16, 16, 20], P: [244, 232, 209], S: [186, 170, 146], A: [240, 197, 121] };

const crcTable = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
const crc = buf => { let c = 0xffffffff; for (const b of buf) c = crcTable[(c ^ b) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
const chunk = (type, data) => { const t = Buffer.from(type); const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const c = Buffer.alloc(4); c.writeUInt32BE(crc(Buffer.concat([t, data]))); return Buffer.concat([len, t, data, c]); };
function png(size) {
  const k = size / 16; const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    for (let x = 0; x < size; x++) {
      const ch = art[Math.floor(y / k)][Math.floor(x / k)]; const o = y * (size * 4 + 1) + 1 + x * 4;
      if (ch !== '.') { const [r, g, b] = pal[ch]; raw[o] = r; raw[o + 1] = g; raw[o + 2] = b; raw[o + 3] = 255; }
    }
  }
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4); ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

const sizes = [16, 32, 48, 256]; const imgs = sizes.map(png);
const head = Buffer.alloc(6); head.writeUInt16LE(1, 2); head.writeUInt16LE(sizes.length, 4);
let offset = 6 + 16 * sizes.length; const dir = [];
sizes.forEach((s, i) => { const e = Buffer.alloc(16); e[0] = s === 256 ? 0 : s; e[1] = s === 256 ? 0 : s; e.writeUInt16LE(1, 4); e.writeUInt16LE(32, 6); e.writeUInt32LE(imgs[i].length, 8); e.writeUInt32LE(offset, 12); offset += imgs[i].length; dir.push(e); });
const out = join(dirname(fileURLToPath(import.meta.url)), '..', 'assets');
mkdirSync(out, { recursive: true });
writeFileSync(join(out, 'mdview.ico'), Buffer.concat([head, ...dir, ...imgs]));
writeFileSync(join(out, 'icon-32.png'), imgs[1]);
console.log('wrote assets/mdview.ico and assets/icon-32.png');
