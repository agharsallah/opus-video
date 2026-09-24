# A Day in the Sketchbook

A 78-second, 1920×1080 animated short built from eight photographed pages of
hand-drawn watercolour sketches. Everything is JavaScript: cutting the
drawings out of the photos, animating them, and synthesising every note of
music and every sound effect. Visuals and sound are timed from the same cue
list, so each pop, tweet, splash and buzz lands on its frame.

Output: `out/sketchbook.mp4` (H.264 + AAC).

## The story

| Time | Scene | What happens |
| --- | --- | --- |
| 0–10 s | Good morning | A pen inks the horizon, the smiling sun peeks in from the page edge, the title writes itself, and a round bird lands on it. |
| 10–22 s | Roll call | Sixteen critters pop up from behind the hill, faster and faster, each with its own voice (tweet, meow, hoot, quack, hee-haw…). The chick dances through its four drawn poses. |
| 22–32 s | Little worlds | The horizon becomes a planet whose surface is a close-up of a different watercolour on every beat, while critters visit the rim. The cuts speed up while "every page is a little world" writes itself, ending on the sunflower. |
| 32–44 s | The garden | Match-cut out of the sunflower. Flowers grow on the beat, butterflies and a pose-swapping bee arrive, the veggie gang marches in… uh-oh. |
| 44–54 s | Underwater | A paper-cut wave sweeps the garden away. Jellyfish pulse on the beat, and a shy octopus falls for a pink jellyfish (shy → wow → sad → love). |
| 54–58 s | Dusk | We surface into the sunset, drift across the evening sketches, and two birds chat on a wire. |
| 58–66 s | Night | An ink-blue wash lowers. Stars, a sleepy moon, and a music box that lights every window in the village, one by one. |
| 66–78 s | Finale | Morning bursts back, every character pops into a ring, "drawn by hand, brought to life.", then a cartoon iris-out and *the end*. |

## Running it

Requires Node 20+, pnpm, and ffmpeg on the PATH.

```sh
pnpm install
pnpm build            # extract assets -> synthesise audio -> render video
```

Individual steps:

```sh
pnpm segment          # (exploratory) numbered overlays of every drawing found
pnpm extract          # cut-outs, stickers, textures, paper -> build/
pnpm audio            # build/soundtrack.wav
pnpm video            # out/sketchbook.mp4
node src/video/render.js --still 19.6        # a single frame -> build/stills/
node src/video/render.js --sheet 22 32 0.25  # a contact sheet of a range
node src/video/render.js --clip 30 34        # a quick preview mp4 with audio
FPS=60 pnpm video                            # smoother, twice the render time
```

## How it works

### 1. Extracting the drawings (`src/extract/`)

- **Paper flattening.** Each photo's uneven lighting is modelled as a smooth
  4th-degree polynomial per colour channel. It is fitted only to paper pixels,
  iteratively rejecting anything darker (ink and paint). Dividing by the model
  turns the paper white everywhere.
- **Finding drawings.** `segment.js` thresholds the "inkiness" map, groups
  nearby strokes, and writes numbered overlays. `manifest.js` names each
  drawing and splits the ones that touch, like the four chicks and the bees.
- **Cut-outs.** Ink blobs whose centre lies inside the box are kept. Blobs cut
  by the crop edge (neighbours) and faint pencil guide lines are dropped.
  Colour-to-alpha against white keeps the watercolour translucency.
- **Stickers.** A filled silhouette with a rounded paper border, so drawings
  read on dark and colourful backgrounds. A morphological closing turns
  open line work (the wave, the tree house) into solid paper props.
- **Paper background.** Seamless real paper grain, quilted from clean patches
  with a variance-preserving blend.
- **Textures.** Full-resolution close-up crops for the montage.

### 2. Animation (`src/video/`)

- `engine.js`: sprites with a stop-motion "boil" (a tiny 8 fps jitter, like
  hand-animated paper), cached soft shadows, hand-inked lines, handwriting
  reveals, watercolour washes, and glyphs (stars, hearts, bubbles, gulls).
- `scenes/*.js`: one module per scene. Each exports `start`/`end`, its assets,
  `draw(ctx, t)` and its **sound cues**. The character sheets become
  animation: the chick's four poses, the bee's four poses, the octopus's
  four expressions.
- `render.js` draws each frame with `@napi-rs/canvas` and pipes raw RGBA into
  ffmpeg (x264, CRF 15, `-tune animation`).

### 3. Sound (`src/audio/`)

- `dsp.js`: stereo buses with equal-power panning, sweeps and LFOs, RBJ
  biquads, a Freeverb-style reverb and a ping-pong echo.
- `instruments.js`: Karplus-Strong ukulele, glockenspiel, music box, marimba,
  pads, bass, a tuba for the parade, and drums.
- `sfx.js`: about 50 procedural cartoon sounds. Birds are chirps, the cat's
  meow and the duck's quack are formant-filtered saws, and the donkey
  hee-haws. There's also a buzzing bee, a sad trombone, a snore-whistle, a
  wave crash, pen scribbles and a slide-whistle iris.
- `music.js`: a C-major tune at 120 BPM with a chord track that follows the
  story. The montage plucks, garden blooms and night windows are cues that
  play notes in key.
- `render-audio.js` mixes score + cues, adds bus compression and a soft clip,
  and normalises to about -14 LUFS.

## Layout

```
input-pictures/   the hand-drawn pages (source)
video-examples/   reference videos
assets/fonts/     Caveat Brush, Patrick Hand (SIL OFL)
src/extract/      photo -> assets
src/video/        engine, scenes, renderer
src/audio/        synth, sfx, score, mixer
build/            generated assets, stills, soundtrack (git-ignored)
out/              the finished film
```

## Credits & licence

Drawings by **Oumaima Bourouis**.

- **Code** (`src/`): [MIT](LICENSE).
- **Artwork and media** (`input-pictures/`, `build/`, `out/`):
  [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). You may reuse and
  adapt it, including commercially, but you must credit Oumaima Bourouis for
  the drawings and link to this repository:

  > Drawings by Oumaima Bourouis, from "A Day in the Sketchbook"
  > (https://github.com/agharsallah/opus-video), licensed CC BY 4.0.

- `video-examples/` are third-party reference videos and are **not** covered.
  The fonts keep their own SIL OFL licence.

See [LICENSE](LICENSE) for the full terms.
