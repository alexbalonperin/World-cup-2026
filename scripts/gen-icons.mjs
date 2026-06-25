// Generates the PWA / home-screen icons with zero dependencies.
// Draws a soccer ball on the app's dark background and writes real PNGs
// (iOS apple-touch-icon requires PNG, so SVG is not an option here).
//
//   npm run gen:icons
//
// Outputs into public/:
//   icon-192.png, icon-512.png            -> manifest "any"
//   icon-maskable-512.png                 -> manifest "maskable" (full-bleed)
//   apple-touch-icon.png (180x180)        -> iOS home screen
import { deflateSync } from "node:zlib";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const PUBLIC = join(ROOT, "public");

const BG = [0x0b, 0x10, 0x20]; // --bg
const ACCENT = [0x38, 0xbd, 0xf8]; // --accent
const WHITE = [0xf4, 0xf7, 0xfd];
const DARK = [0x10, 0x18, 0x30];

// ---- tiny PNG encoder (RGBA, 8-bit) ----
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, "ascii");
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}
function encodePng(width, height, rgba) {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  // 10,11,12 = compression / filter / interlace = 0
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0; // filter: none
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, y * stride + stride);
  }
  return Buffer.concat([
    sig,
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

// ---- drawing helpers ----
function makeCanvas(size) {
  return { size, buf: Buffer.alloc(size * size * 4) };
}
function setPx(c, x, y, [r, g, b], a = 255) {
  if (x < 0 || y < 0 || x >= c.size || y >= c.size) return;
  const i = (y * c.size + x) * 4;
  // alpha-blend over existing
  const sa = a / 255;
  const da = c.buf[i + 3] / 255;
  const oa = sa + da * (1 - sa);
  if (oa === 0) return;
  for (let k = 0; k < 3; k++) {
    const sc = [r, g, b][k];
    const dc = c.buf[i + k];
    c.buf[i + k] = Math.round((sc * sa + dc * da * (1 - sa)) / oa);
  }
  c.buf[i + 3] = Math.round(oa * 255);
}
function fillBg(c, color, rounded) {
  const s = c.size;
  const radius = rounded ? s * 0.22 : 0;
  for (let y = 0; y < s; y++) {
    for (let x = 0; x < s; x++) {
      let inside = true;
      if (rounded) {
        // rounded-rect corner test
        const cx = Math.min(x, s - 1 - x);
        const cy = Math.min(y, s - 1 - y);
        if (cx < radius && cy < radius) {
          const dx = radius - cx;
          const dy = radius - cy;
          inside = dx * dx + dy * dy <= radius * radius;
        }
      }
      if (inside) setPx(c, x, y, color, 255);
    }
  }
}
function fillCircle(c, cx, cy, r, color) {
  for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++) {
    for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) {
      const d = Math.hypot(x - cx, y - cy);
      if (d <= r - 1) setPx(c, x, y, color, 255);
      else if (d <= r) setPx(c, x, y, color, Math.round((r - d) * 255)); // AA edge
    }
  }
}
function pointInPoly(px, py, pts) {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i];
    const [xj, yj] = pts[j];
    if (yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
function pentagon(cx, cy, r, rot) {
  const pts = [];
  for (let i = 0; i < 5; i++) {
    const a = rot + (i * 2 * Math.PI) / 5;
    pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
  }
  return pts;
}
function fillPoly(c, pts, color) {
  let minY = Infinity;
  let maxY = -Infinity;
  let minX = Infinity;
  let maxX = -Infinity;
  for (const [x, y] of pts) {
    minY = Math.min(minY, y);
    maxY = Math.max(maxY, y);
    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x);
  }
  for (let y = Math.floor(minY); y <= Math.ceil(maxY); y++) {
    for (let x = Math.floor(minX); x <= Math.ceil(maxX); x++) {
      if (pointInPoly(x + 0.5, y + 0.5, pts)) setPx(c, x, y, color, 255);
    }
  }
}

function drawBall(c, cx, cy, r) {
  // white ball
  fillCircle(c, cx, cy, r, WHITE);
  // central dark pentagon (pointing up)
  const pr = r * 0.34;
  fillPoly(c, pentagon(cx, cy, pr, -Math.PI / 2), DARK);
  // five surrounding pentagons
  const ringR = r * 0.66;
  const small = r * 0.26;
  for (let i = 0; i < 5; i++) {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / 5;
    const px = cx + ringR * Math.cos(a);
    const py = cy + ringR * Math.sin(a);
    fillPoly(c, pentagon(px, py, small, a + Math.PI / 5), DARK);
  }
}

function render(size, { maskable }) {
  const c = makeCanvas(size);
  fillBg(c, BG, !maskable);
  // accent disc behind the ball as a subtle backdrop
  const cx = size / 2;
  const cy = size / 2;
  const ballR = size * (maskable ? 0.3 : 0.36); // smaller for maskable safe zone
  fillCircle(c, cx, cy, ballR * 1.22, ACCENT);
  drawBall(c, cx, cy, ballR);
  return encodePng(size, size, c.buf);
}

mkdirSync(PUBLIC, { recursive: true });
const outputs = [
  ["icon-192.png", render(192, { maskable: false })],
  ["icon-512.png", render(512, { maskable: false })],
  ["icon-maskable-512.png", render(512, { maskable: true })],
  ["apple-touch-icon.png", render(180, { maskable: false })],
];
for (const [name, data] of outputs) {
  writeFileSync(join(PUBLIC, name), data);
  console.log(`wrote public/${name} (${data.length} bytes)`);
}
