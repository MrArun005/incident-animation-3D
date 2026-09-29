# End card for a recorded flight, in the game's type: reads the pilot's flight log and writes a 1600x900 PNG.
#   python tools/endcard.py out/astra-flight-video.json out/endcard.png
import sys, json, os
from PIL import Image, ImageDraw, ImageFont
HERE = os.path.dirname(os.path.abspath(__file__))
F = lambda n, s: ImageFont.truetype(os.path.join(HERE, '..', 'blender', 'fonts', n + '.ttf'), s)
log = json.load(open(sys.argv[1]))
fin, ev = log['final'], log['events']
passes = [e for e in ev if e['type'] == 'pass']
knife = [p for p in passes if p['gap'] < 1.6]
W, H = 1600, 900
im = Image.new('RGB', (W, H), (5, 7, 13))
d = ImageDraw.Draw(im)
YEL, HULL, DIM = (242, 194, 48), (236, 231, 218), (142, 148, 164)
x0 = 150
d.text((x0, 150), ('HARD · ' if fin.get('difficulty') == 'hard' else '') + 'FLIGHT TEST 02 · JUPITER CLASS IV', font=F('mono-semibold', 26), fill=YEL)
d.text((x0, 196), 'ASTRA', font=F('stencil-bold', 170), fill=HULL)
d.text((x0, 356), 'ADVENTURES', font=F('stencil-bold', 170), fill=HULL)
for i in range(12):                                  # the hazard strip
    d.polygon([(x0 + i * 26, 556), (x0 + i * 26 + 13, 556), (x0 + i * 26 + 3, 570), (x0 + i * 26 - 10, 570)], fill=YEL)
stats = [('SCORE', f"{fin['score']:,}"), ('CLOSE PASSES', str(len(passes))), ('KNIFE EDGE', str(len(knife))),
         ('CLOSEST', f"{fin['closest']:.2f} m" if fin.get('closest') is not None else '—'), ('HITS', str(fin['hits']))]
for i, (k, v) in enumerate(stats):
    x = x0 + i * 262
    d.text((x, 620), k, font=F('cond-semibold', 22), fill=DIM)
    d.text((x, 652), v, font=F('mono-semibold', 44), fill=YEL if i == 0 else HULL)
d.text((x0, 760), 'Flown by Claude with the keyboard: arrows, A/D slide, Shift boost, Space guns, drag to look.', font=F('cond-semibold', 24), fill=DIM)
im.save(sys.argv[2])
print('end card', sys.argv[2], stats)
