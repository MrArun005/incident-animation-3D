# Astra Adventures — flight test 02

A third-person flight prototype. You fly the **Jupiter Class IV** through an asteroid field with
**Vega**, an AI wingman, on your right wing. There are no missions yet: the point is the feel of the ship,
so close passes score.

- `game.html` is the page (published as an artifact). three.js r147 and its add-ons are bundled in
  `vendor/three-r147.js` (MIT), so it needs no CDN. `./build.sh` wraps it
  into a standalone `index.html`. It fetches its models and textures from `assets/`, so serve the folder
  over HTTP (`npx serve .` or any static server); a `file://` page can't load them.
- Controls: `←` `→` steer, `↑` climb, `↓` dive, `W` throttle up (a steady 1.75x cruise), `S` brake, `Shift` boost, `A` `D` slide sideways, drag the view to look
  around without turning the ship, `Space` wing guns, `P`/`Esc` pause, `R` reset, `I` inverted pitch,
  `M` sound, `C` or double-click to recentre the camera. Touch screens get a stick and buttons.
- **Hard** (the toggle on the title screen, or `?hard`): 560 rocks in eleven tighter clusters, a weaving
  gauntlet of rocks set 6–8 m either side of the line out of the start, cruise 56 m/s and boost 132 m/s,
  1.7× damage from a hit, and passes score 1.6×.

## The art (`blender/`)
Everything is built from code, reproducibly, with Blender 5.0 as a Python module (`pip install bpy`) plus
numpy/scipy/Pillow:

- **The ship** (`build_ship.sh`): `ship_geo.py` models it as hard-surface geometry — a chined fuselage lofted
  from rounded sections, a bubble canopy with frame, pilot and seat, side scoops, dorsal spine with vents
  and an antenna, faceted wings and a lower strut into the nacelles, intakes with fan blades, nozzles with
  petals, plugs and heat-stained bells, guns with shrouds and muzzle brakes, canted fins, keel, pitot, nav
  lights, and the stores: a rocket pod on each wing, twin missiles and a drop tank under each wing, canard
  foreplanes, a chin sensor turret, a spine sensor dome, whip antennas and RCS thruster blocks (~66k
  triangles; exported at 1.3x the design size, anchors and probes scaled with it). Two-tone liveries: Lead
  crimson and white with yellow trim, Vega navy and white with light-blue trim, grey bellies. `ship_bake.py` unwraps it (smart project + a skyline packer, texel density by
  surface kind) and bakes position, normal, panel coordinates, edge and occlusion buffers at 4K.
  `ship_tex.py` paints from those buffers in 3D / panel space so nothing breaks at UV seams: worn white
  panels with per-panel tint, yellow markings and hazard stripes, panel lines, rivets and hatches, stencils
  (`07`, `LEAD`, `NO STEP`, `DANGER INTAKE`, the squadron badge), chipped edges, grime streaks, exhaust soot
  and temper colours; `ship_export.py` bakes the height into a tangent-space normal map and exports
  `assets/jupiter.glb` (+ `jupiter-vega.jpg`, Vega's blue livery, and `jupiter.json`, the gameplay anchors).
  `ship_look.py` renders Cycles stills; `ship_mobile.py` writes the half-size copies phones load.
  `gltf_json.py` writes a self-contained `.gltf.json` beside each `.glb` (data embedded); that's what the
  game loads, because some static hosts won't serve `.glb`.
- **The asteroids** (`rocks.py`): six star-shaped bodies — potato, rubble pile, fractured shard, contact
  binary, spinning top, lumpy — with craters (power-law sizes, bowls, rims, ejecta), boulders and ridged
  detail. One octahedral texture per rock serves all three LODs, the normal map is object-space and exact,
  and `rocks.json` carries a radial table of each surface for collision and close-pass scoring. Normal maps
  are saved 4:4:4 (an object-space normal keeps its direction in the chroma).
- **The planets** (`planets.py`): surface maps for all eight planets, the Moon and Saturn's rings, painted from
  noise on the sphere; the game hangs them round the field as lit spheres with atmosphere rims.
- **The sky** (`sky.py`): a 4K equirect with 90,000 stars, the Milky Way with dust lanes, and a nebula
  (`--planet` paints the old gas giant back in). It is the background and, through PMREM, what the
  ship reflects.

## Rendering
PBR materials under one shadow-casting sun (its shadow box follows you, so the ship shadows the rock you
skim), starlight and planet-shine fill, image-based reflections, rocks with object-space normals plus
triplanar close-up grit, instanced exhaust plumes with shock diamonds, then a multisampled HDR pass → bloom
→ ACES tone mapping, vignette and grain. The reflections come from a 2K copy of the sky, rocks grow in
over the last 110 m before the edge of the wrapping field instead of popping, and a governor trades
resolution for frame rate. Phones get half-size textures (ship, rocks and sky) and no MSAA.

## Why it feels heavy (`FM` in game.html)
- Rotation eases in and out (`rotTauIn` 0.27 s, `rotTauOut` 0.36 s): a turn builds, and keeps going for a
  moment after you let go.
- The velocity keeps pointing where you were going and bleeds into the new heading (`driftTau` 0.95 s).
- Speed changes are acceleration-limited: boost takes ~2 s to reach 108 m/s and ~3 s to die away.
- The chase camera trails the ship's rotation and gets shoved by acceleration.
- Close passes are measured against the drawn rock surface from 68 probes fitted to the hull (nose and
  pitot, body, nacelles, gun barrels, wings, fins), so a wingtip skim counts. Gaps and contact normals use
  the rock's true surface normal (differenced from its radial table), so a glancing scrape along a sloping
  face stays a scrape. Feedback: whoosh panned to the rock's side, camera
  shake, FOV punch, screen-edge flash, and a short hit-stop on passes under ~1.6 m.

## Vega
She follows a critically damped path to her slot off your right wing (or to an intercept point on your
path when she has been thrown wide), within the ship's limits: top speed, 70 m/s² and a turn-rate cap.
She looks 3 s down her path and swings wide of rock, matches your boost, and talks on the radio.

## How it was tested
`tools/` holds the harness used to play it headless (Chromium + SwiftShader, served over a local HTTP
server with three.js answered from a local copy, frames stepped at 60 Hz, real key and mouse events):
- `playtest.mjs` — checks on every control (steer/pitch/inverted/boost/slide/drag/pause/reset/guns,
  close pass, collision, Vega's station-keeping).
- `vega.mjs` — Vega over a long run of full-stick manoeuvres.
- `hard.mjs` — the Hard settings: field size, gauntlet clearances, speeds, damage and scoring.
- `pilot.mjs` — the autopilot: a sampling planner that rolls ~200 candidate aims 2.4 s ahead through a copy
  of the flight model, checks every hull probe against the rocks, and flies the one with the best passes and
  no contact (on Hard: 53 passes in 80 s, 22 under 1.6 m, no hits). `--hard` for Hard; `--record` captures a
  video, and `record.sh [seconds] [hard]` turns that into the finished cut with sound and an end card.
  `lab/` holds the scoring harness and the four designs that were tried against it (tuned chaser, MPC,
  sampler, baseline); the sampler won.
- `audio-flight.mjs` — rebuilds the game's sound offline from a recorded flight's event log.
The tools use this environment's paths (Chromium, ffmpeg, a local three.js copy); they're dev scripts.
