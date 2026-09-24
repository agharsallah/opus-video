// Step 2: cut every drawing listed in manifest.js out of the photographed pages.
// For each drawing we write two PNGs into build/assets:
//   <name>.png          ink + watercolour with the white paper removed
//                       ("colour to alpha"), for compositing on paper
//   <name>.sticker.png  the drawing on its own piece of paper with a soft,
//                       rounded border, for colourful / dark backgrounds
// Plus build/pages/<sheet>.jpg (flattened pages, used for close-up textures)
// and build/paper.png (a seamless paper background quilted from real paper).
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import {
  BUILD_DIR, SHEETS, loadRGB, fitPaper, flatten, inkMap, dilate, erode, fillHoles,
  components, boxBlur,
} from './common.js';
import { ASSETS } from './manifest.js';

const PAGE_W = 2800; // working resolution (half of the ~5600px photos)
const PAPER = [0.985, 0.962, 0.918]; // warm sketchbook cream
const INK_T = 0.12;

const assetDir = path.join(BUILD_DIR, 'assets');
const pageDir = path.join(BUILD_DIR, 'pages');
fs.mkdirSync(assetDir, { recursive: true });
fs.mkdirSync(pageDir, { recursive: true });

const only = process.argv.slice(2);
const index = fs.existsSync(path.join(assetDir, 'index.json'))
  ? JSON.parse(fs.readFileSync(path.join(assetDir, 'index.json'), 'utf8'))
  : {};

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);

for (const sheet of SHEETS) {
  const names = Object.keys(ASSETS).filter((n) => ASSETS[n].sheet === sheet && (!only.length || only.includes(n)));
  const wantPage = !only.length;
  if (!names.length && !wantPage) continue;

  const img = await loadRGB(sheet, PAGE_W);
  const { width: W, height: H } = img;
  const flat = flatten(img, fitPaper(img));
  // Lightly blurred so the embossed paper grain does not read as ink.
  const ink = boxBlur(inkMap(flat, W, H), W, H, 3);
  console.log(`${sheet}: ${W}x${H}, ${names.length} drawings`);

  if (wantPage) {
    const rgb = Buffer.alloc(W * H * 3);
    for (let i = 0; i < flat.length; i++) rgb[i] = clamp01(Math.min(1, flat[i]) * PAPER[i % 3]) * 255;
    await sharp(rgb, { raw: { width: W, height: H, channels: 3 } })
      .jpeg({ quality: 92 }).toFile(path.join(pageDir, `${sheet.replace(/ /g, '_')}.jpg`));
    if (sheet === 'creature 1') await makePaper(flat, ink, W, H);
  }

  for (const name of names) {
    const a = ASSETS[name];
    const mode = a.mode ?? 'object';
    const pad = mode === 'object' ? Math.round(0.035 * W) : Math.round(0.004 * W);
    const bx = Math.round(a.box[0] * W), by = Math.round(a.box[1] * H);
    const bw = Math.round(a.box[2] * W), bh = Math.round(a.box[3] * H);
    const x0 = Math.max(0, bx - pad), y0 = Math.max(0, by - pad);
    const x1 = Math.min(W, bx + bw + pad), y1 = Math.min(H, by + bh + pad);
    const cw = x1 - x0, ch = y1 - y0;

    // Crop working buffers.
    const cflat = new Float32Array(cw * ch * 3);
    const cink = new Float32Array(cw * ch);
    const craw = new Uint8Array(cw * ch);
    for (let y = 0; y < ch; y++) {
      for (let x = 0; x < cw; x++) {
        const s = (y + y0) * W + (x + x0), d = y * cw + x;
        cflat[d * 3] = flat[s * 3]; cflat[d * 3 + 1] = flat[s * 3 + 1]; cflat[d * 3 + 2] = flat[s * 3 + 2];
        cink[d] = ink[s];
        craw[d] = (img.data[s * 3] + img.data[s * 3 + 1] + img.data[s * 3 + 2]) / 3;
      }
    }

    // The tree house page was photographed with a dark table peeking in at the
    // edge: find that big dark region (thin ink lines vanish under opening).
    const edge = new Uint8Array(cw * ch);
    if (a.photoEdge) {
      let dark = new Uint8Array(cw * ch);
      for (let i = 0; i < dark.length; i++) dark[i] = craw[i] < 90 ? 1 : 0;
      dark = dilate(erode(dark, cw, ch, 10), cw, ch, 10);
      const { label, comps } = components(dark, cw, ch);
      const touching = new Set(comps.filter((c) => c.x0 === 0 || c.y0 === 0).map((c) => c.id));
      const m = new Uint8Array(cw * ch);
      for (let i = 0; i < m.length; i++) m[i] = touching.has(label[i]) ? 1 : 0;
      edge.set(dilate(m, cw, ch, 14));
    }

    let inkMask = new Uint8Array(cw * ch);
    for (let i = 0; i < inkMask.length; i++) inkMask[i] = cink[i] > INK_T && !edge[i] ? 1 : 0;
    inkMask = dilate(erode(inkMask, cw, ch, 1), cw, ch, 1);
    {
      // Drop isolated specks (paper emboss shadows, dust).
      const { label, comps } = components(inkMask, cw, ch);
      const real = new Set(comps.filter((c) => c.area > 120).map((c) => c.id));
      for (let i = 0; i < inkMask.length; i++) inkMask[i] = inkMask[i] && real.has(label[i]) ? 1 : 0;
    }

    let keep;
    if (mode === 'object') {
      const grown = dilate(inkMask, cw, ch, a.grow ?? 12);
      const { label, comps } = components(grown, cw, ch);
      // Faint pencil guide lines never get above a light grey.
      const peak = new Float32Array(comps.length);
      for (let i = 0; i < label.length; i++) if (label[i] >= 0 && cink[i] > peak[label[i]]) peak[label[i]] = cink[i];
      const inBox = (cx, cy, b) => {
        const px = (cx + x0) / W, py = (cy + y0) / H;
        return px >= b[0] && px <= b[0] + b[2] && py >= b[1] && py <= b[1] + b[3];
      };
      const pick = (edgeRule) => new Set(comps.filter((c) => {
        const cx = (c.x0 + c.x1) / 2, cy = (c.y0 + c.y1) / 2;
        // Blobs cut by the crop edge belong to a neighbouring drawing.
        const cut = (c.x0 === 0 && x0 > 0) || (c.y0 === 0 && y0 > 0) || (c.x1 === cw - 1 && x1 < W) || (c.y1 === ch - 1 && y1 < H);
        return c.area > 200 && peak[c.id] > 0.33 && !(edgeRule && cut) && inBox(cx, cy, a.box) && !(a.exclude ?? []).some((e) => inBox(cx, cy, e));
      }).map((c) => c.id));
      let ids = pick(a.edgeRule ?? true);
      if (!ids.size) ids = pick(false);
      keep = new Uint8Array(cw * ch);
      for (let i = 0; i < keep.length; i++) keep[i] = ids.has(label[i]) ? 1 : 0;
    } else {
      keep = new Uint8Array(cw * ch);
      for (let y = 0; y < ch; y++) {
        for (let x = 0; x < cw; x++) {
          const px = (x + x0) / W, py = (y + y0) / H;
          const out = (a.exclude ?? []).some((e) => px >= e[0] && px <= e[0] + e[2] && py >= e[1] && py <= e[1] + e[3]);
          keep[y * cw + x] = edge[y * cw + x] || out ? 0 : 1;
        }
      }
    }
    // Alpha only lives on (and just around) actual ink/paint, so the paper
    // grain between strokes disappears.
    const tight = new Uint8Array(cw * ch);
    for (let i = 0; i < tight.length; i++) tight[i] = inkMask[i] && keep[i] ? 1 : 0;
    const softKeep = boxBlur(Float32Array.from(dilate(tight, cw, ch, 4)), cw, ch, 3);

    // Colour-to-alpha against white paper.
    const rgba = new Float32Array(cw * ch * 4);
    for (let i = 0; i < cw * ch; i++) {
      const r = Math.min(1, cflat[i * 3]), g = Math.min(1, cflat[i * 3 + 1]), b = Math.min(1, cflat[i * 3 + 2]);
      const aRaw = 1 - Math.min(r, g, b);
      let al = clamp01((aRaw - 0.05) / 0.9) * softKeep[i];
      if (aRaw > 0.001) {
        rgba[i * 4] = clamp01(1 - (1 - r) / aRaw);
        rgba[i * 4 + 1] = clamp01(1 - (1 - g) / aRaw);
        rgba[i * 4 + 2] = clamp01(1 - (1 - b) / aRaw);
      }
      rgba[i * 4 + 3] = al;
    }

    // Sticker: fill the silhouette, grow a rounded paper border around it.
    let stickerAlpha = null;
    if (mode === 'object' || a.sticker) {
      // Silhouette from confident paint only, minus small specks of paper
      // texture, so the sticker border hugs the drawing.
      let kept = new Uint8Array(cw * ch);
      for (let i = 0; i < kept.length; i++) kept[i] = cink[i] > 0.2 && keep[i] ? 1 : 0;
      const specks = components(dilate(kept, cw, ch, 2), cw, ch);
      const big = new Set(specks.comps.filter((c) => c.area > 900).map((c) => c.id));
      for (let i = 0; i < kept.length; i++) kept[i] = kept[i] && big.has(specks.label[i]) ? 1 : 0;
      // Optional morphological closing bridges open line work (the wave).
      const closed = a.stickerClose
        ? erode(dilate(kept, cw, ch, a.stickerClose), cw, ch, a.stickerClose - 4)
        : dilate(kept, cw, ch, 4);
      const solid = fillHoles(closed, cw, ch);
      const round = boxBlur(boxBlur(Float32Array.from(solid), cw, ch, 12), cw, ch, 12);
      const border = new Float32Array(cw * ch);
      for (let i = 0; i < border.length; i++) border[i] = round[i] > 0.06 ? 1 : 0;
      stickerAlpha = boxBlur(border, cw, ch, 2);
    }

    // Trim to content.
    let tx0 = cw, ty0 = ch, tx1 = 0, ty1 = 0;
    for (let y = 0; y < ch; y++) {
      for (let x = 0; x < cw; x++) {
        const i = y * cw + x;
        const v = Math.max(rgba[i * 4 + 3], stickerAlpha ? stickerAlpha[i] : 0);
        if (v > 0.02) { if (x < tx0) tx0 = x; if (x > tx1) tx1 = x; if (y < ty0) ty0 = y; if (y > ty1) ty1 = y; }
      }
    }
    const m = 4;
    tx0 = Math.max(0, tx0 - m); ty0 = Math.max(0, ty0 - m);
    tx1 = Math.min(cw - 1, tx1 + m); ty1 = Math.min(ch - 1, ty1 + m);
    const ow = tx1 - tx0 + 1, oh = ty1 - ty0 + 1;
    const cut = Buffer.alloc(ow * oh * 4);
    const stk = Buffer.alloc(ow * oh * 4);
    let footY = 0;
    for (let y = 0; y < oh; y++) {
      for (let x = 0; x < ow; x++) {
        const s = (y + ty0) * cw + (x + tx0), d = (y * ow + x) * 4;
        for (let c = 0; c < 4; c++) cut[d + c] = rgba[s * 4 + c] * 255;
        if (rgba[s * 4 + 3] > 0.3) footY = y;
        if (stickerAlpha) {
          for (let c = 0; c < 3; c++) stk[d + c] = clamp01(Math.min(1, cflat[s * 3 + c]) * PAPER[c]) * 255;
          stk[d + 3] = stickerAlpha[s] * 255;
        }
      }
    }
    await sharp(cut, { raw: { width: ow, height: oh, channels: 4 } }).png().toFile(path.join(assetDir, `${name}.png`));
    if (stickerAlpha) {
      await sharp(stk, { raw: { width: ow, height: oh, channels: 4 } }).png().toFile(path.join(assetDir, `${name}.sticker.png`));
    }
    index[name] = { w: ow, h: oh, footY, sticker: !!stickerAlpha, sheet };
    console.log(`  ${name.padEnd(16)} ${ow}x${oh}`);
  }
}
fs.writeFileSync(path.join(assetDir, 'index.json'), JSON.stringify(index, null, 1));

// ---------------------------------------------------------------------------
// Seamless paper: blend random clean patches of real paper grain with a
// variance-preserving blend, so no grid or seams show.
// ---------------------------------------------------------------------------
async function makePaper(flat, ink, W, H) {
  const OW = 2400, OH = 1400, P = 360, S = 240;
  // Integral image of "has ink" to find clean windows.
  const I = new Float64Array((W + 1) * (H + 1));
  for (let y = 0; y < H; y++) {
    let row = 0;
    for (let x = 0; x < W; x++) {
      row += ink[y * W + x] > 0.13 ? 1 : 0;
      I[(y + 1) * (W + 1) + x + 1] = I[y * (W + 1) + x + 1] + row;
    }
  }
  const clean = [];
  for (let y = 0; y + P < H; y += 40) {
    for (let x = 0; x + P < W; x += 40) {
      const s = I[(y + P) * (W + 1) + x + P] - I[y * (W + 1) + x + P] - I[(y + P) * (W + 1) + x] + I[y * (W + 1) + x];
      if (s < P * P * 0.0004) clean.push([x, y]);
    }
  }
  console.log(`  paper: ${clean.length} clean patches`);
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const acc = new Float64Array(OW * OH), wsq = new Float64Array(OW * OH);
  const win = (t) => Math.sin(Math.PI * t) ** 2;
  for (let oy = -S; oy < OH; oy += S) {
    for (let ox = -S; ox < OW; ox += S) {
      const [px, py] = clean[Math.floor(rnd() * clean.length)];
      let mean = 0;
      for (let y = 0; y < P; y++) for (let x = 0; x < P; x++) {
        const s = ((py + y) * W + px + x) * 3;
        mean += (flat[s] + flat[s + 1] + flat[s + 2]) / 3;
      }
      mean /= P * P;
      for (let y = 0; y < P; y++) {
        const ty = oy + y; if (ty < 0 || ty >= OH) continue;
        for (let x = 0; x < P; x++) {
          const tx = ox + x; if (tx < 0 || tx >= OW) continue;
          const s = ((py + y) * W + px + x) * 3;
          const v = (flat[s] + flat[s + 1] + flat[s + 2]) / 3 - mean;
          const w = win((x + 0.5) / P) * win((y + 0.5) / P);
          acc[ty * OW + tx] += w * v;
          wsq[ty * OW + tx] += w * w;
        }
      }
    }
  }
  const out = Buffer.alloc(OW * OH * 3);
  for (let i = 0; i < OW * OH; i++) {
    const g = 1 + 0.6 * acc[i] / Math.sqrt(Math.max(1e-9, wsq[i]));
    for (let c = 0; c < 3; c++) out[i * 3 + c] = clamp01(g * PAPER[c]) * 255;
  }
  await sharp(out, { raw: { width: OW, height: OH, channels: 3 } }).png().toFile(path.join(BUILD_DIR, 'paper.png'));
}
