// Scene 1 — "Good morning": a pen draws the horizon, the sun peeks in from
// the edge of the page, the title writes itself and a round bird lands on it.
import { W, H, INK, sprite, paper, vignette, writeText, gull, img } from '../engine.js';
import { drawHill } from './hill.js';
import { clamp, ease, spring, squash, bezier, invLerp, smooth } from '../../lib/util.js';

export const start = 0;
export const end = 10;
export const assets = ['paper', 'peekSun', 'cloud1', 'cloud2', 'roundBird'];

const T = {
  pen0: 0.5, pen1: 2.3, sun: 2.5, cloud1: 3.0, cloud2: 3.5,
  line1: 4.0, line2: 4.9, line2end: 6.3,
  birdIn: 6.5, birdLand: 7.5, birdTweet: 8.0, lettersOut: 8.5, birdOff: 8.75,
};

const title1 = 'a day in the';
const title2 = 'sketchbook';

// Pen follows the arc: map draw progress to screen x for panned scratch.
export const cues = [
  { t: 0.05, sfx: 'pageTurn', gain: 0.7 },
  { t: T.pen0, sfx: 'scribble', dur: T.pen1 - T.pen0, pan: -0.8, panTo: 0.8, gain: 0.8 },
  { t: T.sun, sfx: 'boing', pitch: 0.7, pan: 0.7, gain: 0.8 },
  { t: T.sun + 0.05, sfx: 'shimmer', pan: 0.6, gain: 0.5 },
  { t: T.cloud1, sfx: 'puff', pan: -0.6, gain: 0.5 },
  { t: T.cloud2, sfx: 'puff', pan: -0.2, pitch: 1.2, gain: 0.5 },
  { t: T.line1, sfx: 'scribble', dur: 0.8, pan: -0.3, panTo: 0.2, gain: 0.6 },
  { t: T.line2, sfx: 'scribble', dur: 1.3, pan: -0.5, panTo: 0.5, gain: 0.75 },
  { t: T.birdIn, sfx: 'flutter', dur: 1.0, pan: -0.9, panTo: 0.1, gain: 0.6 },
  { t: T.birdLand, sfx: 'boop', pan: 0.1, gain: 0.7 },
  { t: T.birdTweet, sfx: 'tweet', pan: 0.1, gain: 0.8 },
  ...[...title2].map((_, i) => ({ t: T.lettersOut + i * 0.04, sfx: 'pop', pitch: 1 + i * 0.07, pan: -0.5 + i * 0.1, gain: 0.35 })),
  { t: T.birdOff, sfx: 'whoosh', pan: 0.2, panTo: 1, gain: 0.5 },
];

export function sky(ctx, t, warm) {
  paper(ctx, t, { tint: '#ffe3a8', tintAlpha: 0.22 * warm });
}

export function sun(ctx, t, s = 1) {
  const h = 860;
  const im = img('peekSun');
  const w = (im.width / im.height) * h;
  const inT = spring(t - T.sun, 1.4, 4.2);
  // Sun sits at the right page edge; the waterfall strip stays off-frame.
  const x = W + w * 0.2 + (1 - inT) * w * 0.9;
  const bob = Math.sin(t * 1.3) * 0.03;
  // Warm glow behind the sun.
  if (inT > 0) {
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    const g = ctx.createRadialGradient(x - w * 0.55, 330, 40, x - w * 0.55, 330, 520);
    g.addColorStop(0, `rgba(255,214,120,${0.45 * clamp(inT)})`);
    g.addColorStop(1, 'rgba(255,214,120,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }
  sprite(ctx, 'peekSun', { x, y: 300 + (1 - s) * 400, h, ax: 1, ay: 0.5, rot: bob - 0.08, seed: 91, t });
}

export function clouds(ctx, t, alpha = 1) {
  const c1 = ease.outCubic((t - T.cloud1) / 1.6);
  const c2 = ease.outCubic((t - T.cloud2) / 1.6);
  if (c1 > 0) sprite(ctx, 'cloud1', { x: -200 + c1 * 560 + t * 6, y: 190 + Math.sin(t * 0.9) * 6, h: 110, seed: 5, t, alpha });
  if (c2 > 0) sprite(ctx, 'cloud2', { x: -200 + c2 * 1000 + t * 4, y: 300 + Math.sin(t * 0.7 + 1) * 6, h: 80, seed: 6, t, alpha });
}

export function gulls(ctx, t, alpha = 1) {
  for (let i = 0; i < 3; i++) {
    const u = (t * 0.045 + i * 0.07) % 1;
    const x = -100 + u * (W + 200), y = 170 + i * 26 + Math.sin(t + i) * 10;
    gull(ctx, x, y, 16 - i * 3, t * 9 + i * 2, `rgba(31,27,24,${0.7 * alpha})`);
  }
}

export function draw(ctx, t) {
  const warm = smooth(invLerp(T.sun, T.sun + 1.5, t));
  sky(ctx, t, warm);
  gulls(ctx, t, smooth(invLerp(5, 6, t)));
  clouds(ctx, t);
  sun(ctx, t);
  drawHill(ctx, t, { progress: ease.inOutSine(invLerp(T.pen0, T.pen1, t)), fill: smooth(invLerp(T.pen1 - 0.2, T.pen1 + 0.8, t)) });

  // Title
  const outK = (i) => 1 - ease.inBack(clamp((t - (T.lettersOut + i * 0.04)) / 0.25));
  const out1 = 1 - ease.inBack(clamp((t - T.lettersOut) / 0.3));
  if (out1 > 0) {
    writeText(ctx, title1, 960, 380, { size: 92, font: 'Hand', progress: invLerp(T.line1, T.line1 + 0.8, t), alpha: out1 });
  }
  if (t < T.lettersOut) {
    writeText(ctx, title2, 960, 520, { size: 230, font: 'Brush', progress: invLerp(T.line2, T.line2end, t) });
  } else {
    // Letters pop away one by one.
    ctx.save();
    ctx.font = '230px Brush';
    const total = ctx.measureText(title2).width;
    let x = 960 - total / 2;
    for (let i = 0; i < title2.length; i++) {
      const w = ctx.measureText(title2[i]).width;
      const k = outK(i);
      if (k > 0) {
        ctx.save();
        ctx.translate(x + w / 2, 520);
        ctx.scale(k, k);
        writeText(ctx, title2[i], 0, 0, { size: 230, font: 'Brush' });
        ctx.restore();
      }
      x += w;
    }
    ctx.restore();
  }

  // The round bird: flies in on a curve, lands on the title, tweets, leaves.
  if (t >= T.birdIn) {
    let x, y, rot = 0, sx = 1, sy = 1;
    const land = [1352, 452];
    if (t < T.birdLand) {
      const u = ease.inOutSine(invLerp(T.birdIn, T.birdLand, t));
      [x, y] = bezier([-150, 250], [300, -50], [900, 150], land, u);
      rot = Math.sin(t * 30) * 0.12;
      sy = 1 + Math.sin(t * 40) * 0.08;
    } else if (t < T.birdOff) {
      [x, y] = land;
      [sx, sy] = squash(t - T.birdLand, 0.25);
      if (t > T.birdTweet) {
        const k = Math.exp(-(t - T.birdTweet) * 6);
        sy *= 1 + 0.18 * k * Math.sin((t - T.birdTweet) * 50);
        rot = -0.15 * k;
      }
    } else {
      const u = ease.inCubic(invLerp(T.birdOff, T.birdOff + 0.9, t));
      [x, y] = bezier(land, [1400, 300], [1800, 100], [2200, -100], u);
      rot = Math.sin(t * 30) * 0.12;
    }
    sprite(ctx, 'roundBird', { x, y, h: 150, sx, sy, rot, seed: 33, t, flip: true });
    if (t > T.birdTweet && t < T.birdTweet + 0.6) {
      const a = 1 - invLerp(T.birdTweet, T.birdTweet + 0.6, t);
      ctx.save();
      ctx.globalAlpha = a;
      ctx.strokeStyle = INK;
      ctx.lineWidth = 4;
      ctx.lineCap = 'round';
      for (let i = 0; i < 3; i++) {
        const a0 = -Math.PI / 2 - 0.9 + i * 0.5, r0 = 95, r1 = 130 + (1 - a) * 20;
        ctx.beginPath();
        ctx.moveTo(land[0] + Math.cos(a0) * r0 - 40, land[1] - 60 + Math.sin(a0) * r0);
        ctx.lineTo(land[0] + Math.cos(a0) * r1 - 40, land[1] - 60 + Math.sin(a0) * r1);
        ctx.stroke();
      }
      ctx.restore();
    }
  }
  vignette(ctx, 0.28);
  // Fade in from paper-white at the very start.
  if (t < 0.6) {
    ctx.fillStyle = `rgba(251,244,230,${1 - t / 0.6})`;
    ctx.fillRect(0, 0, W, H);
  }
}
export { T as MORNING_T };
