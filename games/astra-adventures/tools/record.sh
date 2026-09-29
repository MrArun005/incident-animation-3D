#!/bin/sh
# Record a flight end to end: the autopilot flies and captures frames, the soundtrack is rebuilt from its
# event log, an end card is drawn from the same log, then everything is muxed, plus a smaller copy to share.
#   tools/record.sh [seconds] [hard]
set -e
cd "$(dirname "$0")/.."
SECS=${1:-70}
HARD=""; [ "$2" = "hard" ] && HARD="--hard"
FF=/home/user/incident-animation-3d/cartoons/node_modules/ffmpeg-static/ffmpeg
PY=${PY:-/tmp/bvenv/bin/python}
mkdir -p out
node tools/pilot.mjs --record out/astra-flight-video.mp4 --seconds "$SECS" --width 1600 --height 900 $HARD
node tools/audio-flight.mjs out/astra-flight-video.json out/astra-flight.wav
$PY tools/endcard.py out/astra-flight-video.json out/endcard.png
VD=$($PY -c "import json; print(round(len(json.load(open('out/astra-flight-video.json'))['frames']) / 30, 3))")
FO=$($PY -c "print(round($VD - 0.7, 3))"); AO=$($PY -c "print(round($VD + 1.5, 3))"); TOT=$($PY -c "print(round($VD + 4.5, 3))")
$FF -y -loglevel error -i out/astra-flight-video.mp4 -i out/astra-flight.wav -loop 1 -framerate 30 -t 4.5 -i out/endcard.png \
  -filter_complex "[0:v]fade=t=out:st=$FO:d=0.7[m];[2:v]format=yuv420p,fade=t=in:st=0:d=0.8[c];[m][c]concat=n=2:v=1:a=0[v];[1:a]apad,afade=t=out:st=$AO:d=2.5[a]" \
  -map "[v]" -map "[a]" -t "$TOT" -c:v libx264 -preset slow -crf 17 -pix_fmt yuv420p -c:a aac -b:a 192k out/astra-flight-full.mp4
$FF -y -loglevel error -i out/astra-flight-full.mp4 -c:v libx264 -preset slow -crf 23 -maxrate 3M -bufsize 6M -pix_fmt yuv420p -c:a aac -b:a 160k out/astra-flight-share.mp4
ls -la out/astra-flight-full.mp4 out/astra-flight-share.mp4
