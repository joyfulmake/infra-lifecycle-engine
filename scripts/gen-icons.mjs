// Generates icon-192.png and icon-512.png for PWA store submissions
// Design: navy background, blue-to-teal gradient tile, bold "O" wordmark
// Pure Node.js — uses pngjs (no native deps)

import { PNG } from 'pngjs';
import { writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dir = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(__dir, '../public');

// Brand colours
const NAVY   = [0x0F, 0x1F, 0x35]; // #0F1F35
const BLUE   = [0x3B, 0x82, 0xF6]; // #3B82F6
const TEAL   = [0x0D, 0x94, 0x88]; // #0D9488
const WHITE  = [0xFF, 0xFF, 0xFF];

function lerp(a, b, t) { return Math.round(a + (b - a) * t); }

function lerpColour(c1, c2, t) {
  return [lerp(c1[0], c2[0], t), lerp(c1[1], c2[1], t), lerp(c1[2], c2[2], t)];
}

function sdfRoundedRect(px, py, cx, cy, hw, hh, r) {
  const qx = Math.abs(px - cx) - hw + r;
  const qy = Math.abs(py - cy) - hh + r;
  return Math.min(Math.max(qx, qy), 0) + Math.sqrt(Math.max(qx, 0) ** 2 + Math.max(qy, 0) ** 2) - r;
}

function sdfCircle(px, py, cx, cy, radius) {
  return Math.sqrt((px - cx) ** 2 + (py - cy) ** 2) - radius;
}

function sdfRing(px, py, cx, cy, outerR, innerR) {
  const d = Math.sqrt((px - cx) ** 2 + (py - cy) ** 2);
  return Math.max(d - outerR, innerR - d);
}

function aa(d, scale) {
  return Math.max(0, Math.min(1, -d * scale + 0.5));
}

function blend(bg, fg, alpha) {
  return [
    Math.round(bg[0] * (1 - alpha) + fg[0] * alpha),
    Math.round(bg[1] * (1 - alpha) + fg[1] * alpha),
    Math.round(bg[2] * (1 - alpha) + fg[2] * alpha),
  ];
}

function generateIcon(size) {
  const png = new PNG({ width: size, height: size, filterType: -1 });
  const S = size;
  const cx = S / 2;
  const cy = S / 2;

  // Tile: rounded square inset with padding
  const pad    = S * 0.12;
  const tileR  = S * 0.22;   // corner radius
  const tileHW = S / 2 - pad;
  const tileHH = S / 2 - pad;

  // Ring: the "O" mark
  const ringOuter = S * 0.22;
  const ringInner = S * 0.12;

  // Dot accent below the ring
  const dotR  = S * 0.05;
  const dotCy = cy + S * 0.28;

  const scale = 2.5; // aa sharpness

  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const idx = (y * S + x) * 4;

      // Background: navy
      let col = [...NAVY];

      // Subtle radial gradient on the background
      const bgDist = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2) / (S * 0.7);
      const bgT = Math.min(bgDist, 1);
      const NAVY2 = [0x1A, 0x2E, 0x4A];
      col = blend(NAVY2, NAVY, bgT * 0.6);

      // Tile: blue-to-teal diagonal gradient
      const tileSdf = sdfRoundedRect(x, y, cx, cy, tileHW, tileHH, tileR);
      if (tileSdf < 2) {
        const gT = ((x - (cx - tileHW)) / (tileHW * 2) + (y - (cy - tileHH)) / (tileHH * 2)) / 2;
        const tileFill = lerpColour(BLUE, TEAL, Math.max(0, Math.min(1, gT)));
        // Subtle inner highlight
        const highlightT = Math.max(0, 1 - Math.sqrt((x - (cx - tileHW * 0.3)) ** 2 + (y - (cy - tileHH * 0.3)) ** 2) / (S * 0.25));
        const highlight = blend(tileFill, [0xFF, 0xFF, 0xFF], highlightT * 0.12);
        const tileAlpha = aa(tileSdf, scale);
        col = blend(col, highlight, tileAlpha);
      }

      // Ring: the bold "O" mark in white
      const ringSdf = sdfRing(x, y, cx, cy - S * 0.03, ringOuter, ringInner);
      if (ringSdf < 2) {
        const ringAlpha = aa(ringSdf, scale);
        col = blend(col, WHITE, ringAlpha * 0.95);
      }

      // Dot: small teal accent below the ring (like a signal dot)
      const dotSdf = sdfCircle(x, y, cx, dotCy, dotR);
      if (dotSdf < 2) {
        const dotGrad = lerpColour(TEAL, [0x60, 0xA5, 0xFA], (x - (cx - dotR)) / (dotR * 2));
        const dotAlpha = aa(dotSdf, scale);
        col = blend(col, dotGrad, dotAlpha);
      }

      png.data[idx]     = col[0];
      png.data[idx + 1] = col[1];
      png.data[idx + 2] = col[2];
      png.data[idx + 3] = 255;
    }
  }

  return PNG.sync.write(png);
}

for (const size of [192, 512]) {
  const buf = generateIcon(size);
  const out = resolve(OUT, `icon-${size}.png`);
  writeFileSync(out, buf);
  console.log(`wrote ${out} (${buf.length} bytes)`);
}
console.log('done');
