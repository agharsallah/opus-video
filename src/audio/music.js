// The score: a cheerful C-major tune in 120 BPM that follows the story.
// Everything is placed on the same beat grid as the visuals (src/lib/util.js).
import { NOTE, mtof, BEAT, BAR } from '../lib/util.js';
import { pluck, glock, musicbox, marimba, pad, bass, tuba, kick, clap, shaker, woodblock, cymbal } from './instruments.js';

const CH = {
  C: ['C', 'E', 'G'], G: ['G', 'B', 'D'], Am: ['A', 'C', 'E'], F: ['F', 'A', 'C'],
  Dm: ['D', 'F', 'A'], Em: ['E', 'G', 'B'],
};
const f = (n) => mtof(NOTE(n));

// [start, end, chord] across the whole film.
export const CHORDS = [
  [0, 2, 'C'], [2, 4, 'Am'], [4, 6, 'F'], [6, 8, 'G'], [8, 10, 'C'],
  [10, 12, 'C'], [12, 14, 'G'], [14, 16, 'Am'], [16, 18, 'F'], [18, 20, 'C'], [20, 22, 'G'],
  [22, 26, 'C'], [26, 28, 'G'], [28, 29, 'Am'], [29, 30, 'F'], [30, 30.5, 'G'], [30.5, 31, 'Am'], [31, 31.75, 'C'],
  [32, 34, 'C'], [34, 36, 'G'], [36, 38, 'Am'], [38, 40, 'F'], [40, 42, 'C'], [42, 43, 'G'],
  [44, 46, 'Am'], [46, 48, 'F'], [48, 50, 'C'], [50, 52, 'G'], [52, 54, 'F'],
  [54, 55, 'F'], [55, 56, 'G'], [56, 57, 'Em'], [57, 58.4, 'Am'],
  [58.4, 60, 'F'], [60, 62, 'C'], [62, 64, 'Am'], [64, 66, 'G'],
  [66, 68, 'C'], [68, 70, 'G'], [70, 72, 'C'], [72, 73, 'F'], [73, 74, 'G'], [74, 77, 'C'],
];
const chordAt = (t) => CHORDS.find(([a, z]) => t >= a && t < z)?.[2];
const voicing = (name, oct = 4) => CH[name].map((n, i) => `${n}${oct + (i > 0 && 'CDEFGAB'.indexOf(n) < 'CDEFGAB'.indexOf(CH[name][0]) ? 1 : 0)}`);

// The main theme, in eighth notes: [note, start8th, length8ths] per bar.
const THEME = [
  [['E5', 0, 1], ['G5', 1, 1], ['C6', 2, 2], ['G5', 4, 1], ['A5', 5, 1], ['G5', 6, 2]],
  [['D5', 0, 1], ['G5', 1, 1], ['B5', 2, 2], ['A5', 4, 1], ['G5', 5, 1], ['D5', 6, 2]],
  [['C5', 0, 1], ['E5', 1, 1], ['A5', 2, 2], ['G5', 4, 1], ['E5', 5, 1], ['C5', 6, 1], ['D5', 7, 1]],
  [['F5', 0, 2], ['E5', 2, 1], ['D5', 3, 1], ['C5', 4, 3]],
  [['E5', 0, 1], ['G5', 1, 1], ['C6', 2, 2], ['D6', 4, 1], ['C6', 5, 1], ['G5', 6, 2]],
  [['B5', 0, 1], ['A5', 1, 1], ['G5', 2, 2], ['D5', 4, 2], ['G5', 6, 2]],
  [['A5', 0, 1], ['G5', 1, 1], ['F5', 2, 1], ['E5', 3, 1], ['D5', 4, 2], ['B4', 6, 2]],
];
const E8 = BEAT / 2;

export function score(music, perc) {
  const put = (bus, sig, t, o) => bus.add(sig, t, o);
  const melody = (bars, t0, inst, gain, pan = 0, oct = 0) => {
    bars.forEach((b, bi) => THEME[b].forEach(([n, s, l]) => {
      const t = t0 + bi * BAR + s * E8;
      const fr = f(n) * 2 ** oct;
      const sig = inst === 'marimba' ? marimba(fr, { dur: 0.9 }) : inst === 'glock' ? glock(fr, { dur: 1.2 })
        : inst === 'musicbox' ? musicbox(fr) : pluck(fr, { dur: l * E8 + 0.8, bright: 0.7, seed: s + bi });
      put(music, sig, t, { gain, pan });
    }));
  };
  const pads = (a, z, gain, cutoff = 1300) => {
    for (const [s, e, c] of CHORDS) {
      if (e <= a || s >= z) continue;
      const t0 = Math.max(s, a), t1 = Math.min(e, z);
      put(music, pad(voicing(c, 4).map(f), t1 - t0, { cutoff, attack: 0.25, release: 0.5, seed: t0 }), t0, { gain, pan: 0 });
    }
  };
  const bassline = (a, z, gain, pattern = [0, 2]) => {
    for (let t = a; t < z - 1e-6; t += BAR) {
      for (const beat of pattern) {
        const tt = t + beat * BEAT;
        const c = chordAt(tt);
        if (!c || tt >= z) continue;
        const root = `${CH[c][0]}2`;
        put(music, bass(f(root), { dur: 0.42 }), tt, { gain });
        put(music, bass(f(root) * 2, { dur: 0.2 }), tt + BEAT * 1.5, { gain: gain * 0.45 });
      }
    }
  };
  const strum = (a, z, gain, pattern = [0, 1, 1.5, 2, 3, 3.5]) => {
    for (let t = a; t < z - 1e-6; t += BAR) {
      for (const beat of pattern) {
        const tt = t + beat * BEAT;
        const c = chordAt(tt);
        if (!c || tt >= z) continue;
        voicing(c, 4).concat(`${CH[c][0]}5`).forEach((n, k) => {
          put(music, pluck(f(n), { dur: 0.5, bright: 0.55, decay: 0.993, seed: k + beat * 3 }), tt + k * 0.012, { gain: gain * (beat % 1 ? 0.6 : 1), pan: -0.25 + k * 0.1 });
        });
      }
    }
  };
  const drums = (a, z, { kicks = [0, 2], claps = [1, 3], shake = true, gain = 1 } = {}) => {
    for (let t = a; t < z - 1e-6; t += BAR) {
      kicks.forEach((b) => t + b * BEAT < z && put(perc, kick(), t + b * BEAT, { gain: 0.8 * gain }));
      claps.forEach((b) => t + b * BEAT < z && put(perc, clap({ seed: Math.round(t * 10 + b) }), t + b * BEAT, { gain: 0.45 * gain, pan: 0.1 }));
      if (shake) for (let e = 0; e < 8; e++) if (t + e * E8 < z) put(perc, shaker({ seed: e + Math.round(t) }), t + e * E8, { gain: (e % 2 ? 0.5 : 0.3) * gain, pan: 0.35 });
    }
  };
  const arp = (a, z, inst, gain, step = E8, oct = 5, pan = 0) => {
    let k = 0;
    for (let t = a; t < z - 1e-6; t += step, k++) {
      const c = chordAt(t);
      if (!c) continue;
      const notes = voicing(c, oct);
      const n = [notes[0], notes[1], notes[2], notes[1]][k % 4];
      const sig = inst === 'musicbox' ? musicbox(f(n)) : inst === 'marimba' ? marimba(f(n), { dur: 0.6 }) : glock(f(n), { dur: 1 });
      put(music, sig, t, { gain, pan: pan + (k % 2 ? 0.2 : -0.2) });
    }
  };

  // 1. Morning (0-10): soft pad, music-box arpeggio, glock hints of the theme.
  pads(0, 10, 0.18, 1000);
  arp(1, 10, 'musicbox', 0.28, BEAT);
  melody([0], 6, 'glock', 0.22, 0.2);
  put(music, cymbal({ dur: 1.2, swell: true }), 8.8, { gain: 0.3 });

  // 2. Roll call (10-22): the band starts. Strummed uke, bass, drums; the
  //    theme is teased on glockenspiel once everyone is in.
  strum(10, 22, 0.3);
  bassline(10, 22, 0.45);
  drums(10, 14, { kicks: [0], claps: [], shake: true, gain: 0.7 });
  drums(14, 21.5, { gain: 0.9 });
  melody([4, 5], 18, 'glock', 0.28, 0.25);
  melody([4, 5], 18, 'marimba', 0.3, -0.2, -1);

  // 3. Montage (22-32): plucks come from the cuts; pad + building pulse.
  pads(22, 31.75, 0.2, 1600);
  for (let t = 22; t < 26; t += BAR) put(perc, kick({ amp: 0.9 }), t, { gain: 0.7 });
  for (let t = 26; t < 28; t += BEAT) put(perc, kick({ amp: 0.9 }), t, { gain: 0.7 });
  for (let t = 28; t < 30; t += E8) put(perc, kick({ amp: 0.8 }), t, { gain: 0.6 });
  for (let t = 30; t < 31.5; t += E8 / 2) put(perc, clap({ amp: 0.5 + (t - 30) * 0.3, seed: Math.round(t * 100) }), t, { gain: 0.35 });
  bassline(26, 31, 0.35, [0, 1, 2, 3]);

  // 4. Garden (32-43): the full tune. At 38 the veggie parade turns it
  //    into an oom-pah march.
  put(perc, cymbal({ dur: 2.5 }), 32, { gain: 0.45 });
  melody([0, 1, 2, 3, 4], 32, 'marimba', 0.42, -0.15);
  melody([0, 1, 2, 3, 4], 32, 'glock', 0.18, 0.25, 1);
  melody([5], 42, 'marimba', 0.42, -0.15);
  strum(32, 38, 0.24);
  bassline(32, 38, 0.45);
  drums(32, 38, { gain: 1 });
  for (let t = 38; t < 43 - 1e-6; t += BEAT) {
    const c = chordAt(t);
    const beat = Math.round((t - 38) / BEAT) % 2;
    if (beat === 0) put(music, tuba(f(`${CH[c][beat ? 2 : 0]}2`) * (Math.round((t - 38) / BEAT) % 4 === 2 ? 1.5 : 1)), t, { gain: 0.55 });
    else voicing(c, 4).forEach((n, k) => put(music, pluck(f(n), { dur: 0.25, bright: 0.5, seed: k }), t + k * 0.01, { gain: 0.22 }));
    put(perc, woodblock(beat ? 1200 : 900), t + E8, { gain: 0.25, pan: 0.4 });
  }
  drums(38, 43, { kicks: [0, 2], claps: [1, 3], shake: false, gain: 0.8 });

  // 5. Underwater (44-54): dreamy half-time with an echoing music box.
  pads(44.3, 54, 0.26, 900);
  arp(44.3, 52.5, 'glock', 0.22, E8, 5);
  for (let t = 44; t < 52; t += BAR) {
    const c = chordAt(t);
    put(music, bass(f(`${CH[c][0]}2`), { dur: 1.2, drive: 1.1 }), t, { gain: 0.45 });
    put(perc, kick({ amp: 0.6 }), t, { gain: 0.45 });
    put(perc, shaker({ seed: Math.round(t), len: 0.12 }), t + BEAT * 2, { gain: 0.3 });
  }
  melody([2, 3], 48, 'musicbox', 0.25, 0.3);

  // 6. Dusk (54-58.4): fingerpicked uke over a warm pad.
  pads(54, 58.4, 0.2, 1100);
  for (let t = 54, k = 0; t < 58.2; t += E8, k++) {
    const c = chordAt(t);
    const notes = voicing(c, 4);
    const n = [notes[0], notes[2], notes[1], `${CH[c][0]}5`][k % 4];
    put(music, pluck(f(n), { dur: 1.2, bright: 0.45, seed: k }), t, { gain: 0.32, pan: k % 2 ? 0.25 : -0.25 });
  }
  for (let t = 54; t < 58; t += BAR / 2) put(music, bass(f(`${CH[chordAt(t)][0]}2`), { dur: 0.8, drive: 1 }), t, { gain: 0.35 });

  // 7. Night (58.4-66): lullaby. Pad, soft bass, the window music box.
  pads(58.4, 66, 0.22, 800);
  for (let t = 58.4; t < 65.5; t += BAR / 2) put(music, bass(f(`${CH[chordAt(t)][0]}2`), { dur: 0.9, drive: 0.9 }), t, { gain: 0.3 });
  arp(63, 65.5, 'musicbox', 0.18, BEAT, 5);

  // 8. Finale (66-77): everything, one last time, big ending on C.
  melody([0, 1, 4, 6], 66, 'marimba', 0.45, -0.15);
  melody([0, 1, 4, 6], 66, 'glock', 0.2, 0.25, 1);
  strum(66, 74, 0.26);
  bassline(66, 74, 0.45);
  drums(66, 70, { gain: 0.9 });
  drums(70, 73.5, { kicks: [0, 1, 2, 3], claps: [1, 3], gain: 1 });
  // Final chord.
  voicing('C', 4).concat(['C5', 'E5', 'G5', 'C6']).forEach((n, k) => {
    put(music, pluck(f(n), { dur: 3.2, bright: 0.7, seed: k }), 74 + k * 0.015, { gain: 0.3, pan: -0.3 + k * 0.08 });
    put(music, glock(f(n) * 2, { dur: 2.5 }), 74 + k * 0.02, { gain: 0.08 });
  });
  put(music, pad(voicing('C', 4).map(f), 2.2, { cutoff: 1800, attack: 0.02, release: 1.2 }), 74, { gain: 0.3 });
  put(music, bass(f('C2'), { dur: 2, drive: 1.3 }), 74, { gain: 0.55 });
  put(perc, kick(), 74, { gain: 0.9 });
  put(perc, cymbal({ dur: 3 }), 74, { gain: 0.55 });
  // "The end": a tiny music-box coda.
  ['G5', 'E5', 'C5', 'G4', 'C5'].forEach((n, k) => put(music, musicbox(f(n)), 76.7 + k * 0.18, { gain: 0.3, pan: 0.1 }));
}
