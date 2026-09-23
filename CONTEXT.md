# Context handoff: incident-animation-3D

Paste this into a new Claude session (for example one with Chrome or
Playwright access) to continue the work.

## The project

- Repo: https://github.com/MrArun005/incident-animation-3D (owner: Arun, MrArun005)
- Code-generated animated videos. **No external assets**: every model, texture,
  sprite and sound effect is made in code. The only exception is narration,
  from the open-weight Kokoro TTS model run locally (`whiteboard/tools/voice.py`,
  voice `af_heart`, speed 0.95).
- Finished MP4s live in `videos/`, each kept under 30 MB so they can be posted on X.
- Read `CLAUDE.md` first: it holds the standing rules.

## The three categories

1. **3D films** (`flight-1549/`): three.js, rendered headless in software
   (30 to 60 min each). Flight 1549 "Miracle on the Hudson", 100 s, narrated.
   Also a Spark-hosted explainer (`lesson.html`).
2. **Teaching videos** (`whiteboard/`): 2D marker-on-whiteboard lessons.
   **Clawd is the teacher**: an orange pixel critter (near-square body, side
   nubs, two tall wide-set eyes, four long legs, colour `#cc7f61`). Clawd
   narrates and opens with "Hi, I'm Clawd!". Stories so far: Flight 1549, and
   the Pythagorean theorem proved with four triangles.
3. **Cartoons** (`cartoons/`): a separate category. They are stories, not
   lessons. **No Clawd, no teacher voice.** Two exist, but both were made with
   Clawd narrating and need remaking: "How we invented farming" and
   "The Coconut Problem" (Koa, an early human, learns to open a coconut
   with a stone).

## How the cartoons are built

- `cartoons/src/art.js`: landscape, wheat, clothed Neolithic people, tents,
  houses, animals, map.
- `cartoons/src/humans.js`: a jointed early-human rig (no clothes, smooth and
  non-anatomical, family-friendly), 20 poses (run, walk, climb, slide, sit,
  bite, squeeze, kick, ow, crouch, lift, bash, drink, cheer...), plus corn,
  soil, sea, sand, palm, coconut, stone, impact stars and comic words.
- `cartoons/src/coconut.js`: one scene per narration line, cross-faded.
- `cartoons/tools/audio.mjs <story>`: music (plucks and flute), ambience,
  timed sound effects, and narration ducking.
- `cartoons/tools/render.mjs --story <name>`: headless Chromium, canvas
  frames into ffmpeg. About 1 minute per video.

## The next job: remake the cartoons wordless

Research into how YouTube cartoon channels work (for example Caveman
Animations, Primitive Cartoon, Alan Becker's Animator vs. Animation) says:

- **No narration.** Pantomime: characters grunt and react, and sound effects
  and music carry the story. Rule: if a viewer can't tell what the character
  is thinking on the first watch, the scene isn't working yet.
- **Script, then storyboard, then animatic.** Plan the gag beats with timing
  before animating; check the timing in a rough cut.
- **Cut-out puppet rigs**, as in Moho, Toon Boom or After Effects. Our code
  rig is the same idea.
- **Disney's 12 principles**, especially squash and stretch, anticipation (a
  wind-up before every action), timing and holds on funny poses.
- **Camera work**: close-ups, wide shots, a shake on impacts.

Plan: rebuild "The Coconut Problem" as about 60 s of wordless slapstick,
driven by a beat sheet rather than narration timing:
- spots coconuts → tries to climb → slides down → sits dazed
- tries again → the climbing trick works → reaches the top
- twists a coconut free → it drops with a THUD
- bite, squeeze, kick → OW → gets an idea
- stone → bash, bash, CRACK → drinks → shares with friends

Stronger poses, squash and stretch, anticipation, camera moves and sound
effects throughout. Then remake the farming cartoon the same way.

## What a session with a browser can add

- Watch a few videos from the genre (Caveman Animations shorts, Primitive
  Cartoon, Alan Becker's "12 Principles of Animation") and note shot lengths,
  gag structure, camera moves, character designs and how sound is used.
- Screenshot frames of styles Arun likes, for reference.

## Environment notes

- Chromium: `/opt/pw-browsers/chromium-1194/chrome-linux/chrome`, driven with
  playwright-core. ffmpeg comes from the `ffmpeg-static` npm package.
- Kokoro model files come from the GitHub releases at
  thewh1teagle/kokoro-onnx (Hugging Face is blocked). Install with
  `pip install kokoro-onnx soundfile`.
- Commit messages end with a Co-Authored-By line for Claude.
