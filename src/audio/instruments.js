// Musical voices, each returning a mono Float32Array.
import { SR, secs, biquad, noiseGen, env } from './dsp.js';

const TAU = Math.PI * 2;
const soft = (x) => Math.tanh(x);

// Karplus-Strong plucked string (ukulele / pizzicato), fractional delay.
export function pluck(freq, { dur = 1.6, bright = 0.6, decay = 0.996, seed = 1 } = {}) {
  const n = secs(dur);
  const out = new Float32Array(n);
  const period = SR / freq - 0.5;
  const size = Math.ceil(period) + 2;
  const buf = new Float32Array(size);
  const rnd = noiseGen(seed * 97 + Math.round(freq));
  const lp = biquad().set(800 + bright * 7000);
  for (let i = 0; i < size; i++) buf[i] = lp.run(rnd());
  let w = 0;
  const hist = new Float32Array(size * 4);
  const L = hist.length;
  for (let i = 0; i < size; i++) hist[i] = buf[i];
  w = size;
  for (let i = 0; i < n; i++) {
    // Read `period` samples behind, linearly interpolated.
    const rp = w - period;
    const i0 = Math.floor(rp), f = rp - i0;
    const a = hist[((i0 % L) + L) % L], b = hist[(((i0 - 1) % L) + L) % L];
    const c = hist[(((i0 + 1) % L) + L) % L];
    const y = (a * (1 - f) + c * f) * 0.5 + (b * (1 - f) + a * f) * 0.5;
    hist[w % L] = y * decay;
    w++;
    out[i] = y;
  }
  // Tiny pick transient + body.
  for (let i = 0; i < Math.min(n, 300); i++) out[i] += rnd() * 0.15 * (1 - i / 300);
  const body = biquad('peak').set(260, 1.2, 4);
  for (let i = 0; i < n; i++) out[i] = body.run(out[i]) * env.asr(i / SR, 0.002, dur, 0.08);
  return out;
}

// Glockenspiel / bell: inharmonic partials with separate decays.
export function glock(freq, { dur = 1.8, amp = 1 } = {}) {
  const n = secs(dur);
  const out = new Float32Array(n);
  const parts = [[1, 1, 1.1], [2.76, 0.35, 0.35], [5.4, 0.18, 0.15], [8.93, 0.08, 0.07]];
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    let v = 0;
    for (const [r, a, d] of parts) if (freq * r < SR * 0.42) v += Math.sin(TAU * freq * r * t) * a * Math.exp(-t / d);
    out[i] = v * amp * Math.min(1, t / 0.002) * 0.6;
  }
  return out;
}

// Music box tine: bright, sweet, slightly detuned pair.
export function musicbox(freq, { dur = 2.2 } = {}) {
  const n = secs(dur);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const e = Math.exp(-t / 0.7) * Math.min(1, t / 0.001);
    out[i] = (Math.sin(TAU * freq * t) + 0.5 * Math.sin(TAU * freq * 1.003 * t) + 0.25 * Math.sin(TAU * freq * 3 * t) * Math.exp(-t / 0.1)
      + (freq * 5.2 < SR * 0.42 ? 0.1 * Math.sin(TAU * freq * 5.2 * t) * Math.exp(-t / 0.05) : 0)) * e * 0.45;
  }
  return out;
}

// Marimba: fundamental + 4th partial + mallet knock.
export function marimba(freq, { dur = 1.0 } = {}) {
  const n = secs(dur);
  const out = new Float32Array(n);
  const rnd = noiseGen(Math.round(freq));
  const bp = biquad('bandpass').set(freq * 3, 2);
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const knock = i < 400 ? bp.run(rnd()) * (1 - i / 400) * 0.6 : 0;
    out[i] = (Math.sin(TAU * freq * t) * Math.exp(-t / 0.42) + 0.35 * Math.sin(TAU * freq * 3.99 * t) * Math.exp(-t / 0.08) + knock) * Math.min(1, t / 0.003) * 0.7;
  }
  return out;
}

// Warm pad: detuned saws through a slow low-pass, gentle attack.
export function pad(freqs, dur, { cutoff = 1400, attack = 0.5, release = 0.8, seed = 3 } = {}) {
  const n = secs(dur + release);
  const out = new Float32Array(n);
  const lp = biquad().set(cutoff, 0.6);
  const lp2 = biquad().set(cutoff * 1.4, 0.6);
  const ph = freqs.flatMap((f, k) => [0, 0.33, 0.71].map((p, j) => ({ f: f * (1 + (j - 1) * 0.004), p: p + k * 0.17 + seed })));
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    let v = 0;
    for (const o of ph) {
      o.p += o.f / SR;
      v += (o.p % 1) * 2 - 1;
    }
    const e = t < attack ? t / attack : t > dur ? Math.max(0, 1 - (t - dur) / release) : 1;
    out[i] = lp2.run(lp.run(v / ph.length)) * e * 0.9;
  }
  return out;
}

// Plucky bass (sine + soft saturated harmonics).
export function bass(freq, { dur = 0.45, drive = 1.6 } = {}) {
  const n = secs(dur + 0.05);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const e = Math.min(1, t / 0.004) * Math.exp(-t / (dur * 0.6)) * (t < dur ? 1 : Math.max(0, 1 - (t - dur) / 0.05));
    out[i] = soft(Math.sin(TAU * freq * t) * drive + 0.3 * Math.sin(TAU * freq * 2 * t)) * e * 0.8;
  }
  return out;
}

// Tuba-ish "oom" for the veggie parade.
export function tuba(freq, { dur = 0.35 } = {}) {
  const n = secs(dur + 0.05);
  const out = new Float32Array(n);
  const lp = biquad();
  let p = 0;
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    p += freq * (1 + 0.01 * Math.sin(TAU * 5 * t)) / SR;
    const e = Math.min(1, t / 0.03) * (t < dur ? 1 : Math.max(0, 1 - (t - dur) / 0.05));
    lp.set(300 + 900 * Math.min(1, t / 0.05) * Math.exp(-t / 0.25), 1.2);
    out[i] = lp.run((p % 1) < 0.5 ? 1 : -1) * e * 0.55;
  }
  return out;
}

// ---- drums ---------------------------------------------------------------
export function kick({ amp = 1 } = {}) {
  const n = secs(0.35);
  const out = new Float32Array(n);
  let p = 0;
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    p += (48 + 110 * Math.exp(-t / 0.04)) / SR;
    out[i] = soft(Math.sin(TAU * p) * 1.4 * Math.exp(-t / 0.13)) * amp;
  }
  return out;
}

export function clap({ amp = 1, seed = 5 } = {}) {
  const n = secs(0.25);
  const out = new Float32Array(n);
  const rnd = noiseGen(seed);
  const bp = biquad('bandpass').set(1500, 0.9);
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const bursts = [0, 0.009, 0.018].reduce((a, o) => a + (t >= o ? Math.exp(-(t - o) / (o === 0.018 ? 0.06 : 0.006)) : 0), 0);
    out[i] = bp.run(rnd()) * bursts * amp * 1.3;
  }
  return out;
}

export function shaker({ amp = 1, seed = 9, len = 0.07 } = {}) {
  const n = secs(len + 0.02);
  const out = new Float32Array(n);
  const rnd = noiseGen(seed);
  const hp = biquad('highpass').set(6000, 0.7);
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    out[i] = hp.run(rnd()) * env.perc(t, len * 0.4, len * 0.25) * amp * 0.5;
  }
  return out;
}

export function woodblock(freq = 900, { amp = 1 } = {}) {
  const n = secs(0.15);
  const out = new Float32Array(n);
  const rnd = noiseGen(Math.round(freq));
  const bp = biquad('bandpass').set(freq, 12);
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const exc = i < 60 ? rnd() : 0;
    out[i] = (bp.run(exc) * 8 + Math.sin(TAU * freq * t) * 0.3) * Math.exp(-t / 0.035) * amp;
  }
  return out;
}

export function cymbal({ dur = 1.6, amp = 1, swell = false, seed = 11 } = {}) {
  const n = secs(dur);
  const out = new Float32Array(n);
  const rnd = noiseGen(seed);
  const hp = biquad('highpass').set(5000, 0.5);
  const pk = biquad('peak').set(7500, 1, 4);
  const lp = biquad().set(12000, 0.7);
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const e = swell ? (t / dur) ** 2.5 : Math.exp(-t / (dur * 0.35));
    out[i] = lp.run(pk.run(hp.run(rnd()))) * e * amp * 0.24;
  }
  return out;
}
