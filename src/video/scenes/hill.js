// The "little world" hill: a giant circle whose top edge is our horizon.
import { W, H, INK, inkLine, arcPoints, grain } from '../engine.js';
import { clamp } from '../../lib/util.js';

export const makeHill = (top, r, cx = W / 2) => ({ cx, top, r, cy: top + r });
export const HILL = makeHill(790, 2600);

export const hillY = (x, hill = HILL) => hill.cy - Math.sqrt(Math.max(0, hill.r ** 2 - (x - hill.cx) ** 2));
// Surface tilt at x (radians) so characters stand perpendicular to the world.
export const hillTilt = (x, hill = HILL) => Math.asin(clamp((x - hill.cx) / hill.r, -1, 1));

const ptsCache = new Map();
function hillPoints(hill) {
  const key = `${hill.cx}|${hill.top}|${hill.r}`;
  if (!ptsCache.has(key)) {
    const span = Math.asin(Math.min(1, (W / 2 + 120) / hill.r));
    ptsCache.set(key, arcPoints(hill.cx, hill.cy, hill.r, -Math.PI / 2 - span, -Math.PI / 2 + span, 160, 3, 11));
  }
  return ptsCache.get(key);
}

export function drawHill(ctx, t, { hill = HILL, progress = 1, fill = 1, color = '#a9cf7a', deep = '#7fb563' } = {}) {
  if (fill > 0) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(hill.cx, hill.cy, hill.r, 0, Math.PI * 2);
    ctx.clip();
    const g = ctx.createLinearGradient(0, hill.top, 0, H);
    g.addColorStop(0, color);
    g.addColorStop(1, deep);
    ctx.globalAlpha = 0.42 * fill;
    ctx.fillStyle = g;
    ctx.fillRect(-200, hill.top - 10, W + 400, H + 400);
    // A few darker pigment pools, like wet-in-wet watercolour.
    ctx.globalAlpha = 0.12 * fill;
    ctx.fillStyle = '#5f9a4a';
    for (let i = 0; i < 7; i++) {
      ctx.beginPath();
      ctx.ellipse(120 + i * 290, hill.top + 120 + (i % 3) * 60, 220, 60, 0.1 * i, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
    grain(ctx, t, 0.5 * fill);
  }
  return inkLine(ctx, hillPoints(hill), { progress, width: 6, color: INK, seed: 21, t });
}

// Clip to everything above the horizon (so things can rise from behind it).
export function clipAboveHill(ctx, hill = HILL) {
  ctx.beginPath();
  ctx.rect(-500, -500, W + 1000, H + 1000);
  ctx.arc(hill.cx, hill.cy, hill.r, 0, Math.PI * 2, true);
  ctx.clip('evenodd');
}
