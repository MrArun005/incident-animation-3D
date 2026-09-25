# CLAUDE.md: incident-animation-3D

Notes for any Claude session working in this repo. Owner: Arun (MrArun005).

## Clawd is the teacher

- **Clawd** is the teacher and narrator of every teaching video here: the
  orange pixel critter (a near-square body, a nub on each side, two tall
  wide-set black eyes, four long thin legs in two pairs, colour `#cc7f61`).
  The sprite is `whiteboard/src/main.js` `critter()` and `critter-emoji/critter.html`.
- Clawd introduces themself ("Hi, I'm Clawd!") at the start of a story, and the
  title card reads "CLAWD'S WHITEBOARD".
- Clawd's voice is Kokoro `af_heart` at speed 0.95 (`tools/voice.py`). Keep it
  the same across videos so Clawd sounds like one character.
- Spark (the orange loading-spark mascot) is the host of the 3D explainer
  `flight-1549/lesson.html`, not the teacher.

## Categories: teaching vs cartoons

- **Teaching** (whiteboard stories, explainers): Clawd teaches and narrates.
- **Cartoons** (`cartoons/`): a separate category. They are stories, not
  lessons. Do NOT put Clawd in cartoons: no Clawd on screen, no "Hi, I'm
  Clawd", no teacher voice. Let the characters and the action tell it.
- **Direction (2026-09-23): cartoons over photoreal.** Arun rated the
  photoreal "Before Us" short "okish" and wants more cartoons with engaging
  scripts instead. Default to cartoon; the script is the priority: a hook in
  the first 2 s, one character with a clear goal, escalating failures, a
  twist, a payoff gag.
- **"As rich as possible" (2026-09-25, The Unicorn Seal):** Arun asked for the
  richest animation quality. The rich engine is `cartoons/src/indus/` (1080p,
  parallax layers, brick/mud textures, haze, god rays, depth-of-field blur,
  outlined clothed rig with 3/4 faces, colour grade). Reuse it for new rich
  cartoons instead of the flat kit. Wide 16:9 when a story needs big vistas.

## How the videos are made

- No external assets: every model, texture and sound effect is generated in
  code. The one exception is the narration voice, from the open-weight Kokoro
  TTS model run locally (model files from github.com/thewh1teagle/kokoro-onnx
  releases; Hugging Face is blocked from the build sandbox).
- Narration first, visuals second: `tools/voice.py <lines.json>` measures
  every spoken line and writes `<story>.timing.json`; the visuals key off it.
- Every video carries subtitles, so it works muted on X.
- `videos/` holds the finished MP4s, each kept under 30 MB so they can be
  sent in chat and posted on X.
- Whiteboard stories render in under a minute (2D canvas). The 3D films take
  30 to 60 minutes (software WebGL, no GPU).

## Accuracy

Real incidents: state facts only from reliable sources (for Flight 1549, the
NTSB report AAR-10/03), say when a path or number is approximate, and keep
quoted dialogue to what is on the public record.
