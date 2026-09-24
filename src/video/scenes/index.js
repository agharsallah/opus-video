// The film, in order. Each scene exports start/end (seconds), the assets it
// needs, a draw(ctx, t) with absolute time and its sound cues.
import * as morning from './morning.js';
import * as rollcall from './rollcall.js';
import * as montage from './montage.js';
import * as garden from './garden.js';
import * as underwater from './underwater.js';
import * as dusk from './dusk.js';
import * as night from './night.js';

export const SCENES = [morning, rollcall, montage, garden, underwater, dusk, night];
export const DURATION = Math.max(...SCENES.map((s) => s.end));
export const CUES = SCENES.flatMap((s) => s.cues).sort((p, q) => p.t - q.t);
