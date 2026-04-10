/**
 * Generates PWA icons for GymMate.
 * Run once: node scripts/generate-icons.js
 * Requires: npm install --save-dev canvas
 */

const { createCanvas } = require('canvas');
const fs = require('fs');
const path = require('path');

const THEME = '#00BFA5';
const BG    = '#ffffff';
const ICON_DIR = path.join(__dirname, '../public/icons');

if (!fs.existsSync(ICON_DIR)) fs.mkdirSync(ICON_DIR, { recursive: true });

function drawIcon(size, maskable = false) {
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d');
  const pad = maskable ? size * 0.1 : 0;

  // Background
  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, size, size);

  // Circle / rounded rect
  const r = (size - pad * 2) / 2;
  const cx = size / 2;
  const cy = size / 2;

  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = THEME;
  ctx.fill();

  // Dumbbell icon — two circles + bar
  ctx.fillStyle = '#ffffff';
  const unit = size / 16;

  // Bar
  ctx.fillRect(cx - unit * 3.5, cy - unit * 0.6, unit * 7, unit * 1.2);

  // Left weight plate (outer)
  ctx.beginPath();
  ctx.arc(cx - unit * 4.2, cy, unit * 1.8, 0, Math.PI * 2);
  ctx.fill();

  // Left weight plate (inner cutout)
  ctx.fillStyle = THEME;
  ctx.beginPath();
  ctx.arc(cx - unit * 4.2, cy, unit * 1.0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#ffffff';
  // Right weight plate (outer)
  ctx.beginPath();
  ctx.arc(cx + unit * 4.2, cy, unit * 1.8, 0, Math.PI * 2);
  ctx.fill();

  // Right weight plate (inner cutout)
  ctx.fillStyle = THEME;
  ctx.beginPath();
  ctx.arc(cx + unit * 4.2, cy, unit * 1.0, 0, Math.PI * 2);
  ctx.fill();

  // "GM" text below dumbbell
  ctx.fillStyle = '#ffffff';
  ctx.font = `bold ${Math.round(unit * 2.8)}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('GM', cx, cy + unit * 4.2);

  return canvas.toBuffer('image/png');
}

const configs = [
  { name: 'icon-192.png',          size: 192, maskable: false },
  { name: 'icon-512.png',          size: 512, maskable: false },
  { name: 'icon-maskable-192.png', size: 192, maskable: true  },
  { name: 'icon-maskable-512.png', size: 512, maskable: true  },
];

configs.forEach(({ name, size, maskable }) => {
  const buf = drawIcon(size, maskable);
  fs.writeFileSync(path.join(ICON_DIR, name), buf);
  console.log(`✅ Created public/icons/${name} (${size}x${size})`);
});

console.log('\nDone! All PWA icons generated in frontend/public/icons/');
