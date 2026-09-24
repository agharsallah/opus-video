// The film, in order. Each scene exports start/end (seconds), the assets it
// needs, a draw(ctx, t) with absolute time and its sound cues.
import * as morning from './morning.js';
import * as rollcall from './rollcall.js';

export const SCENES = [morning, rollcall];
export const DURATION = Math.max(...SCENES.map((s) => s.end));
export const CUES = SCENES.flatMap((s) => s.cues).sort((p, q) => p.t - q.t);
