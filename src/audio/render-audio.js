// Builds the soundtrack: the score (music.js) plus every scene's sound cues
// (the same cue list the visuals are timed from), mixed, reverbed, limited,
// and written to build/soundtrack.wav.
import fs from 'node:fs';
import path from 'node:path';
import { SR, Bus, reverb, echo, biquad } from './dsp.js';
import { SFX } from './sfx.js';
import { score } from './music.js';
import { CUES, DURATION } from '../video/scenes/index.js';
import { BUILD_DIR } from '../extract/common.js';
import { BEAT } from '../lib/util.js';

const LEN = DURATION + 0.5;
const t0 = performance.now();

const music = new Bus(LEN);
const perc = new Bus(LEN);
const sfx = new Bus(LEN);

score(music, perc);
console.log(`score        ${((performance.now() - t0) / 1000).toFixed(1)}s`);

const missing = new Set();
for (const c of CUES) {
  const gen = SFX[c.sfx];
  if (!gen) { missing.add(c.sfx); continue; }
  if (!c.gain) continue;
  sfx.add(gen(c), c.t, { gain: c.gain, pan: c.pan ?? 0, panTo: c.panTo ?? null, panLfo: c.panLfo ?? 0 });
}
if (missing.size) console.warn('missing sfx:', [...missing].join(', '));
console.log(`sfx (${CUES.length} cues) ${((performance.now() - t0) / 1000).toFixed(1)}s`);

// Mix: music + percussion + effects, with shared reverb and a music echo.
const send = new Bus(LEN);
send.addStereo(music, 0.35);
send.addStereo(sfx, 0.18);
send.addStereo(perc, 0.08);
const verb = reverb(send, { room: 0.82, damp: 0.35 });
const delay = echo(music, { time: BEAT * 0.75, feedback: 0.3 }); // dotted eighth

const master = new Bus(LEN);
master.addStereo(music, 0.8);
master.addStereo(perc, 0.75);
master.addStereo(sfx, 1.0);
master.addStereo(verb, 0.9);
master.addStereo(delay, 0.12);
const rms = (b) => {
  let a = 0;
  for (let i = 0; i < b.n; i++) a += b.L[i] ** 2 + b.R[i] ** 2;
  return (10 * Math.log10(a / (2 * b.n) + 1e-12)).toFixed(1);
};
console.log(`mix          ${((performance.now() - t0) / 1000).toFixed(1)}s   rms dB  music ${rms(music)}  perc ${rms(perc)}  sfx ${rms(sfx)}`);

// Soften the very top end of the whole mix.
for (const ch of [master.L, master.R]) {
  const lp = biquad().set(15000, 0.6);
  for (let i = 0; i < ch.length; i++) ch[i] = lp.run(ch[i]);
}

// Gentle bus compression (envelope follower) + soft clip, then normalise.
let envl = 0;
const att = Math.exp(-1 / (0.005 * SR)), rel = Math.exp(-1 / (0.15 * SR));
let peak = 0;
for (let i = 0; i < master.n; i++) {
  const lvl = Math.max(Math.abs(master.L[i]), Math.abs(master.R[i]));
  envl = lvl > envl ? att * envl + (1 - att) * lvl : rel * envl + (1 - rel) * lvl;
  const thr = 0.5;
  const g = envl > thr ? (thr + (envl - thr) / 3) / envl : 1;
  master.L[i] = Math.tanh(master.L[i] * g * 1.1);
  master.R[i] = Math.tanh(master.R[i] * g * 1.1);
  peak = Math.max(peak, Math.abs(master.L[i]), Math.abs(master.R[i]));
}
const norm = 0.7 / peak; // about -14 LUFS, with headroom for AAC
// Fade out the last half second.
const fadeN = Math.round(0.5 * SR);
const pcm = Buffer.alloc(master.n * 4);
for (let i = 0; i < master.n; i++) {
  const f = i > master.n - fadeN ? (master.n - i) / fadeN : 1;
  pcm.writeInt16LE(Math.round(Math.max(-1, Math.min(1, master.L[i] * norm * f)) * 32767), i * 4);
  pcm.writeInt16LE(Math.round(Math.max(-1, Math.min(1, master.R[i] * norm * f)) * 32767), i * 4 + 2);
}
const header = Buffer.alloc(44);
header.write('RIFF', 0); header.writeUInt32LE(36 + pcm.length, 4); header.write('WAVE', 8);
header.write('fmt ', 12); header.writeUInt32LE(16, 16); header.writeUInt16LE(1, 20); header.writeUInt16LE(2, 22);
header.writeUInt32LE(SR, 24); header.writeUInt32LE(SR * 4, 28); header.writeUInt16LE(4, 32); header.writeUInt16LE(16, 34);
header.write('data', 36); header.writeUInt32LE(pcm.length, 40);
fs.mkdirSync(BUILD_DIR, { recursive: true });
const out = path.join(BUILD_DIR, 'soundtrack.wav');
fs.writeFileSync(out, Buffer.concat([header, pcm]));
console.log(`${out}  (${LEN.toFixed(1)}s, ${((performance.now() - t0) / 1000).toFixed(1)}s total)`);

