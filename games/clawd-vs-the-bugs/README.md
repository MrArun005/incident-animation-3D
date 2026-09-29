# Clawd vs The Bugs

A one-file browser arcade shooter. Clawd fires at waves of bugs.

- Play: open `index.html` (standalone) — or publish `game.html`, which is the same page without the outer `<html>` wrapper. Run `./build.sh` after editing `game.html` to regenerate `index.html`.
- Controls: mouse / arrows / A-D to move, Space / click / hold a touch to fire, P pause, M mute.
- Enemies: gnats (1 hp), beetles (2), spiders (3, shoot back), and a boss, SEGFAULT, every 5th wave.
- Power-ups: S spread, R rapid, H shield, B bomb. Chain kills within 1.4 s for a x2-x4 multiplier. Extra life every 2,500 points.
- Best score is kept in the browser's localStorage. All art and sound are generated in code.
