// Step 1 (exploratory): find every separate drawing on each sketchbook page and
// write a numbered overlay + JSON of boxes. The overlays are used to name the
// drawings in src/extract/manifest.js.
import fs from 'node:fs';
import path from 'node:path';
import { createCanvas, loadImage } from '@napi-rs/canvas';
import sharp from 'sharp';
import {
  BUILD_DIR, SHEETS, loadRGB, fitPaper, flatten, inkMap, dilate, erode, components,
} from './common.js';

const W = 1400;
const outDir = path.join(BUILD_DIR, 'segment');
fs.mkdirSync(outDir, { recursive: true });

const all = {};
for (const sheet of SHEETS) {
  const img = await loadRGB(sheet, W);
  const coefs = fitPaper(img);
  const flat = flatten(img, coefs);
  const ink = inkMap(flat, img.width, img.height);
  let mask = new Uint8Array(ink.length);
  for (let i = 0; i < ink.length; i++) mask[i] = ink[i] > 0.16 ? 1 : 0;
  mask = dilate(erode(mask, img.width, img.height, 1), img.width, img.height, 1);
  const grown = dilate(mask, img.width, img.height, 14);
  const { comps } = components(grown, img.width, img.height);
  const boxes = comps
    .filter((c) => c.area > 2500)
    .map((c) => ({
      x: c.x0 / img.width, y: c.y0 / img.height,
      w: (c.x1 - c.x0 + 1) / img.width, h: (c.y1 - c.y0 + 1) / img.height,
    }));
  all[sheet] = boxes;

  // Numbered overlay on the flattened page.
  const rgb = Buffer.alloc(img.width * img.height * 3);
  for (let i = 0; i < flat.length; i++) rgb[i] = Math.max(0, Math.min(255, flat[i] * 255));
  const png = await sharp(rgb, { raw: { width: img.width, height: img.height, channels: 3 } }).png().toBuffer();
  const canvas = createCanvas(img.width, img.height);
  const ctx = canvas.getContext('2d');
  ctx.drawImage(await loadImage(png), 0, 0);
  ctx.lineWidth = 3;
  ctx.font = 'bold 40px sans-serif';
  boxes.forEach((b, i) => {
    ctx.strokeStyle = 'rgba(255,0,80,0.8)';
    ctx.strokeRect(b.x * img.width, b.y * img.height, b.w * img.width, b.h * img.height);
    ctx.fillStyle = 'rgba(255,0,80,1)';
    ctx.fillText(String(i), b.x * img.width + 4, b.y * img.height + 38);
  });
  const file = path.join(outDir, `${sheet.replace(/ /g, '_')}.jpg`);
  fs.writeFileSync(file, await sharp(await canvas.encode('png')).resize({ width: 1000 }).jpeg().toBuffer());
  console.log(`${sheet}: ${boxes.length} drawings -> ${file}`);
}
fs.writeFileSync(path.join(outDir, 'boxes.json'), JSON.stringify(all, null, 1));
