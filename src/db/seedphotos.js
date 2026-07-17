// Generates placeholder "resident photo" PNGs for the seeder — simple flat-art
// scenes of the things people actually photograph around an estate (block
// facades, void deck corridors, greenery). Pure Node, no image libraries:
// pixels are drawn in a loop and packed into a minimal PNG by hand.

import zlib from 'node:zlib';

// --- minimal PNG encoder (truecolor RGB, no interlace) ----------------------
const CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();

function crc32(buf) {
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

function chunk(type, data) {
  const out = Buffer.alloc(8 + data.length + 4);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, 'ascii');
  data.copy(out, 8);
  out.writeUInt32BE(crc32(out.subarray(4, 8 + data.length)), 8 + data.length);
  return out;
}

function encodePng(width, height, pixelAt) {
  // One filter byte (0 = none) per scanline, then raw RGB triples.
  const raw = Buffer.alloc(height * (1 + width * 3));
  let o = 0;
  for (let y = 0; y < height; y++) {
    raw[o++] = 0;
    for (let x = 0; x < width; x++) {
      const [r, g, b] = pixelAt(x, y);
      raw[o++] = clamp(r);
      raw[o++] = clamp(g);
      raw[o++] = clamp(b);
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // color type: truecolor
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 6 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// --- drawing helpers --------------------------------------------------------
const clamp = (v) => (v < 0 ? 0 : v > 255 ? 255 : v | 0);
const mix = (a, b, t) => [
  a[0] + (b[0] - a[0]) * t,
  a[1] + (b[1] - a[1]) * t,
  a[2] + (b[2] - a[2]) * t,
];

// Deterministic per-coordinate noise in [-1, 1] — texture without consuming
// the seeder's PRNG stream mid-pixel.
function nz(x, y, s) {
  let h = (x * 374761393 + y * 668265263 + (s | 0) * 2246822519) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return (((h ^ (h >>> 16)) >>> 0) / 4294967296) * 2 - 1;
}

const W = 640;
const H = 480;

const SKY_TOP = [150, 194, 228];
const SKY_LOW = [222, 234, 240];
const FACADES = [
  [233, 225, 209],
  [219, 228, 234],
  [236, 220, 219],
  [224, 230, 217],
  [228, 222, 233],
];
const ACCENTS = [
  [176, 96, 80],
  [96, 128, 168],
  [120, 152, 112],
  [188, 148, 88],
];

// An HDB block seen straight-on: sky, window grid, accent slab lines, grass.
function blockFacade(rand) {
  const seed = Math.floor(rand() * 1e9);
  const facade = FACADES[Math.floor(rand() * FACADES.length)];
  const accent = ACCENTS[Math.floor(rand() * ACCENTS.length)];
  const skyH = Math.round(H * (0.16 + rand() * 0.1));
  const grassY = H - 44;
  const floorH = 46;
  const bayW = 56;
  return encodePng(W, H, (x, y) => {
    const grain = nz(x, y, seed) * 4;
    if (y < skyH) return mix(SKY_TOP, SKY_LOW, y / skyH).map((v) => v + grain);
    if (y >= grassY) {
      const g = mix([116, 158, 92], [96, 140, 78], nz(x >> 2, y >> 2, seed) * 0.5 + 0.5);
      return g.map((v) => v + grain);
    }
    const fy = (y - skyH) % floorH;
    // Slab line between floors, painted in the block's accent colour.
    if (fy < 5) return accent.map((v) => v + grain);
    // Window band: recessed glass with per-unit variation (some lit, some dark).
    const inWinRow = fy >= 14 && fy < 36;
    const inWinCol = x % bayW >= 12 && x % bayW < 44;
    if (inWinRow && inWinCol) {
      const cell = nz(Math.floor(x / bayW), Math.floor((y - skyH) / floorH), seed + 7);
      const glass = cell > 0.3 ? [214, 206, 178] : mix([84, 96, 112], [120, 134, 150], cell * 0.5 + 0.5);
      return glass.map((v) => v + grain);
    }
    return facade.map((v) => v + grain);
  });
}

// A void deck / corridor: two-tone painted wall, columns, polished floor.
function corridor(rand) {
  const seed = Math.floor(rand() * 1e9);
  const paint = ACCENTS[Math.floor(rand() * ACCENTS.length)];
  const ceilY = Math.round(H * 0.16);
  const floorY = Math.round(H * (0.6 + rand() * 0.08));
  const paintY = floorY - 70;
  const colStep = 118;
  return encodePng(W, H, (x, y) => {
    const grain = nz(x, y, seed) * 3;
    // Columns run full height, slightly darker with a shaded edge.
    const cx = x % colStep;
    const onCol = cx < 30;
    if (y < ceilY) return [225, 222, 214].map((v) => v + grain - (onCol ? 12 : 0));
    if (y >= floorY) {
      // Polished concrete with a soft reflection gradient.
      const t = (y - floorY) / (H - floorY);
      return mix([176, 170, 158], [140, 135, 126], t).map((v) => v + grain + nz(x >> 1, y, seed + 3) * 4);
    }
    if (onCol) {
      const shade = cx < 4 || cx >= 26 ? -26 : -10;
      return [214, 210, 200].map((v) => v + shade + grain);
    }
    // Two-tone wall: paint band below, off-white above, dark skirting line.
    if (y >= floorY - 6) return [96, 92, 86].map((v) => v + grain);
    if (y >= paintY) return paint.map((v) => v + grain);
    return [232, 228, 219].map((v) => v + grain);
  });
}

// Estate greenery: sky, mottled tree canopy, lawn with a footpath.
function greenery(rand) {
  const seed = Math.floor(rand() * 1e9);
  const skyY = Math.round(H * (0.28 + rand() * 0.1));
  const canopyY = Math.round(H * 0.68);
  const pathY = Math.round(H * (0.78 + rand() * 0.08));
  return encodePng(W, H, (x, y) => {
    const grain = nz(x, y, seed) * 4;
    if (y < skyY) return mix(SKY_TOP, SKY_LOW, y / skyY).map((v) => v + grain);
    if (y < canopyY) {
      // Coarse mottling reads as foliage from thumbnail distance.
      const m = nz(x >> 4, y >> 4, seed + 1) * 0.5 + nz(x >> 3, y >> 3, seed + 2) * 0.5;
      // Ragged canopy edge against the sky.
      if (y < skyY + 24 && nz(x >> 3, 0, seed + 5) > (y - skyY) / 12 - 1) {
        return mix(SKY_TOP, SKY_LOW, 1).map((v) => v + grain);
      }
      return mix([52, 96, 54], [104, 148, 76], m * 0.5 + 0.5).map((v) => v + grain);
    }
    if (y >= pathY && y < pathY + 26) return [205, 198, 184].map((v) => v + grain);
    return mix([124, 166, 96], [104, 150, 84], nz(x >> 2, y >> 2, seed + 4) * 0.5 + 0.5).map((v) => v + grain);
  });
}

const SCENES = [blockFacade, corridor, greenery];

// Draw one seed photo using the caller's PRNG (keeps the seed deterministic).
export function makeSeedPhoto(rand) {
  return SCENES[Math.floor(rand() * SCENES.length)](rand);
}
