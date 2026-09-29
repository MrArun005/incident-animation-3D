# Astra Adventures — flight test 01 (blockout)

A third-person flight prototype. You fly the **Jupiter Class IV** through a sparse rock field with
**Vega**, an AI wingman, on your right wing. There are no missions yet: the point is the feel of the ship,
so close passes score.

- `game.html` is the page (published as an artifact; Three.js r128 from cdnjs). `./build.sh` wraps it into
  a standalone `index.html` you can open locally.
- Controls: `←` `→` steer, `↑` `↓` pitch, `Shift` boost, `A` `D` slide sideways, drag the view to look
  around without turning the ship, `Space` wing guns, `P`/`Esc` pause, `R` reset, `I` inverted pitch,
  `M` sound, `C` or double-click to recentre the camera. Touch screens get a stick and buttons.

## The ship
Blockout of the sketch: a narrow central body with a pointed nose and canopy, two wings that connect the
body to the wing engines (with a lower spar), a gun on each wing, three engines (centre + two wing
engines), yellow hull markings. White panels, no textures yet.

## Why it feels heavy (`FM` in game.html)
- Rotation eases in and out (`rotTauIn` 0.27 s, `rotTauOut` 0.36 s): a turn builds, and keeps going for a
  moment after you let go.
- The velocity keeps pointing where you were going and bleeds into the new heading (`driftTau` 0.95 s):
  in a hard turn the nose leads the flight-path marker by ~25°.
- Speed changes are acceleration-limited: boost takes ~2 s to reach 108 m/s and ~3 s to die away.
- The chase camera trails the ship's rotation and gets shoved by acceleration.
- Close passes are measured against the same surface function that shaped each rock, from eight probes on
  the hull (nose, body, wings, wingtips), so a wingtip skim counts. Feedback: whoosh panned to the rock's
  side, camera shake, FOV punch, screen-edge flash, and a short hit-stop on passes under ~1.6 m.

## Vega
She follows a critically damped path to her slot off your right wing (or to an intercept point on your
path when she has been thrown wide), within the ship's limits: top speed, 70 m/s² and a turn-rate cap.
She looks 3 s down her path and swings wide of rock, matches your boost, and talks on the radio.

## How it was tested
`tools/` holds the harness used to play it headless (Chromium + SwiftShader, three.js served locally,
frames stepped at 60 Hz, real key and mouse events):
- `playtest.mjs` — 31 checks on every control (steer/pitch/inverted/boost/slide/drag/pause/reset/guns,
  close pass, collision, Vega's station-keeping). 31/31 pass.
- `vega.mjs` — Vega over 48 s of full-stick manoeuvres: mean 8.8 m from her slot, max 21 m.
- `pilot.mjs` — a closed-loop pilot that lines up close passes; `--record` captures a video.
  70 s flight: 10 close passes, closest 0.93 m, no hits.
- `audio-flight.mjs` — rebuilds the game's sound offline from a recorded flight's event log.
The tools use this environment's paths (Chromium, ffmpeg, a local three.js copy); they're dev scripts.
