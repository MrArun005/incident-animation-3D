#!/bin/bash
# Full-quality delivery for one story: master render (PNG frames, crf 12), a repo copy
# under GitHub's 100 MB limit (two-pass, ~7.6 Mbps), and chat parts under 30 MB.
#   tools/deliver-hq.sh indus
set -e
cd "$(dirname "$0")/.."
S=$1; FF=node_modules/ffmpeg-static/ffmpeg
node tools/render.mjs --story $S --hq
cd out
../$FF -y -loglevel error -i cartoon-$S-hq.mp4 -c:v libx264 -preset slow -tune animation -b:v 7600k -pass 1 -passlogfile p$S -an -f mp4 /dev/null
../$FF -y -loglevel error -i cartoon-$S-hq.mp4 -c:v libx264 -preset slow -tune animation -b:v 7600k -pass 2 -passlogfile p$S -c:a aac -b:a 256k -movflags +faststart cartoon-$S-full.mp4
rm -f p$S*
# Chat parts: 23 s each, re-encoded so every part starts on a keyframe and plays on its own.
for i in 0 1 2 3; do
  ../$FF -y -loglevel error -ss $((i*23)) -t 23 -i cartoon-$S-hq.mp4 -c:v libx264 -preset slow -tune animation -b:v 9000k -maxrate 9500k -bufsize 18000k -c:a aac -b:a 192k -movflags +faststart cartoon-$S-part$((i+1)).mp4
done
ls -la cartoon-$S-hq.mp4 cartoon-$S-full.mp4 cartoon-$S-part*.mp4
