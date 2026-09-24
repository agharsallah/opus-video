// Step 3: full-resolution close-up crops for the montage (flattened paper,
// no alpha), written to build/textures/<name>.jpg.
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { BUILD_DIR, INPUT_DIR, loadRGB, fitPaper, flatten } from './common.js';
import { TEXTURES } from './manifest.js';

const ASPECT = 1920 / 860;
const PAPER = [0.985, 0.962, 0.918];
const outDir = path.join(BUILD_DIR, 'textures');
fs.mkdirSync(outDir, { recursive: true });

const coefCache = {};
for (const [name, { sheet, at }] of Object.entries(TEXTURES)) {
  const file = path.join(INPUT_DIR, `${sheet}.jpg`);
  const meta = await sharp(file).rotate().toBuffer({ resolveWithObject: true }).then((r) => r.info);
  const FW = meta.width, FH = meta.height;
  coefCache[sheet] ??= fitPaper(await loadRGB(sheet, 1400));
  const w = Math.round(at[2] * FW), h = Math.round(w / ASPECT);
  const left = Math.max(0, Math.min(FW - w, Math.round(at[0] * FW - w / 2)));
  const top = Math.max(0, Math.min(FH - h, Math.round(at[1] * FH - h / 2)));
  const { data, info } = await sharp(file).rotate().removeAlpha()
    .extract({ left, top, width: w, height: h }).raw().toBuffer({ resolveWithObject: true });
  const flat = flatten({ data, width: info.width, height: info.height }, coefCache[sheet], { x0: left, y0: top, fullW: FW, fullH: FH });
  const rgb = Buffer.alloc(flat.length);
  for (let i = 0; i < flat.length; i++) rgb[i] = Math.max(0, Math.min(1, Math.min(1, flat[i]) * PAPER[i % 3])) * 255;
  await sharp(rgb, { raw: { width: w, height: h, channels: 3 } })
    .resize({ width: Math.min(w, 2200) }).jpeg({ quality: 92 }).toFile(path.join(outDir, `${name}.jpg`));
  console.log(`${name.padEnd(14)} ${w}x${h}`);
}
