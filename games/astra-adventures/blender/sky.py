# The backdrop for Astra Adventures: a 4096 x 2048 equirect (three.js convention) with a star field, the
# Milky Way with dust lanes, a faint emission nebula and a banded gas giant with a moon, lit by the game's sun.
#   /tmp/bvenv/bin/python sky.py [--res 4096]      -> ../assets/sky.jpg + sky.json (directions for the game)
# The same picture is the scene background and, through PMREM, the environment the ship reflects.
import sys, os, math, json, time
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import numpy as np
from PIL import Image
from noise import fbm, ridged

args = sys.argv[1:]
W = int(args[args.index('--res') + 1]) if '--res' in args else 4096
H = W // 2
OUT = os.path.join(HERE, '..', 'assets')
T0 = time.time()


def log(*a):
    print(f'[{time.time() - T0:6.1f}s]', *a, flush=True)


def unit(v):
    return v / np.linalg.norm(v, axis=-1, keepdims=True)


def sstep(a, b, x):
    t = np.clip((x - a) / (b - a), 0, 1)
    return t * t * (3 - 2 * t)


def lin2srgb(c):
    c = np.clip(c, 0, 1)
    return np.where(c <= 0.0031308, c * 12.92, 1.055 * np.power(c, 1 / 2.4) - 0.055)


SUN = unit(np.array([0.72, 0.46, 0.52]))
PLANET = unit(np.array([-0.35, 0.18, -0.92]))
PLANET_R = math.radians(11.0)
MOON = unit(PLANET + np.array([0.21, 0.10, 0.05]))
MOON_R = math.radians(1.25)
GAL_POLE = unit(np.array([0.42, 0.84, 0.34]))
GAL_CENTRE = unit(np.cross(GAL_POLE, np.array([0.0, 0.0, 1.0])) * -1)

# pixel directions (row 0 = top of the image = v 1 in three.js)
lat = math.pi / 2 - (np.arange(H) + 0.5) / H * math.pi
lon = ((np.arange(W) + 0.5) / W - 0.5) * 2 * math.pi
LA, LO = np.meshgrid(lat, lon, indexing='ij')
D = np.stack([np.cos(LA) * np.cos(LO), np.sin(LA), np.cos(LA) * np.sin(LO)], -1).astype(np.float32)
Df = D.reshape(-1, 3)
img = np.zeros((H * W, 3), np.float32)

# ---------------------------------------------------------------- deep background: a whisper of colour
g0 = fbm(Df * 1.5, 1.0, 3, 5) * 0.5 + 0.5
img += np.array([0.0016, 0.0019, 0.0032]) * (0.6 + 0.8 * g0[:, None])
log('background')

# ---------------------------------------------------------------- Milky Way
gz = Df @ GAL_POLE
band = np.exp(-(gz ** 2) / (2 * 0.13 ** 2))
core = np.exp(-(gz ** 2) / (2 * 0.06 ** 2))
bulge = np.exp(-(1 - np.clip(Df @ GAL_CENTRE, -1, 1)) / 0.35) * np.exp(-(gz ** 2) / (2 * 0.18 ** 2))
clouds = np.clip(fbm(Df * 5.0, 1.0, 5, 21) * 0.9 + 0.55, 0, None)
clouds2 = np.clip(fbm(Df * 14.0, 1.0, 4, 22) * 0.8 + 0.6, 0, None)
lanes = ridged(Df * 4.2 + 3.0, 1.0, 5, 23)
dust = sstep(0.22, 0.55, lanes) * np.exp(-(gz ** 2) / (2 * 0.075 ** 2))
rift = np.exp(-((gz - 0.012 * fbm(Df * 3, 1, 2, 24)) ** 2) / (2 * 0.018 ** 2)) * (0.55 + 0.45 * fbm(Df * 7, 1, 3, 25))
mw = (band * 0.55 + core * 0.9) * clouds * clouds2 + bulge * 1.6 * clouds
mw = mw * (1 - 0.9 * np.clip(dust + rift * 0.85, 0, 1))
tone = np.clip(bulge * 1.5, 0, 1)[:, None]
mw_col = np.array([0.60, 0.66, 0.85]) * (1 - tone) + np.array([1.0, 0.82, 0.60]) * tone
img += mw[:, None] * mw_col * 0.10
# a faint haze of unresolved stars along the band
img += (band * clouds2 * 0.009)[:, None] * np.array([0.8, 0.85, 1.0])
log('milky way')

# ---------------------------------------------------------------- emission nebula near the band
NEB = unit(np.array([-0.55, 0.25, -0.35]))
nd = 1 - np.clip(Df @ NEB, -1, 1)
neb_mask = np.exp(-nd / 0.012)
neb = np.clip(fbm(Df * 16.0 + 7, 1.0, 5, 31) * 1.2 + 0.25, 0, None) * neb_mask
neb2 = np.clip(ridged(Df * 22.0, 1.0, 4, 32) - 0.45, 0, None) * neb_mask
img += neb[:, None] * np.array([0.9, 0.18, 0.28]) * 0.09 + neb2[:, None] * np.array([0.3, 0.55, 0.9]) * 0.06
log('nebula')

# ---------------------------------------------------------------- stars
rng = np.random.default_rng(2026)
NS = 90000
sd = unit(rng.standard_normal((NS, 3)))
# half of them crowd towards the galactic plane
k = rng.random(NS) < 0.55
t = rng.standard_normal(k.sum()) * 0.09
sd[k] = unit(sd[k] - (sd[k] @ GAL_POLE)[:, None] * GAL_POLE[None] + t[:, None] * GAL_POLE[None])
mag = rng.pareto(1.35, NS) + 1                      # a few bright, many faint
flux = np.clip(0.0009 * mag ** 1.7, 0, 0.05)
temp = rng.random(NS)
tint = np.where(temp[:, None] < 0.18, [0.65, 0.78, 1.0], np.where(temp[:, None] < 0.75, [1.0, 0.97, 0.92], [1.0, 0.78, 0.55]))
starimg = np.zeros((H, W, 3), np.float32)
slat, slon = np.arcsin(np.clip(sd[:, 1], -1, 1)), np.arctan2(sd[:, 2], sd[:, 0])
sy = (math.pi / 2 - slat) / math.pi * H - 0.5
sx = (slon / (2 * math.pi) + 0.5) * W - 0.5
for i in np.argsort(flux):
    f = flux[i]
    sig = 0.55 + 0.35 * min(1.0, f / 2)
    rad = int(math.ceil(sig * (3 + 2 * min(1, f))))
    cy, cx = sy[i], sx[i]
    stretch = 1 / max(0.05, math.cos(slat[i]))
    rx = min(int(rad * stretch) + 1, 60)
    y0, y1 = max(0, int(cy) - rad), min(H, int(cy) + rad + 2)
    xs = np.arange(int(cx) - rx, int(cx) + rx + 2)
    yy = np.arange(y0, y1)[:, None]
    dx = (xs[None] - cx) / stretch
    g = np.exp(-((yy - cy) ** 2 + dx ** 2) / (2 * sig * sig))
    starimg[y0:y1, xs % W] += g[..., None] * (f * tint[i])[None, None]
img += starimg.reshape(-1, 3)
log('stars', NS)

# ---------------------------------------------------------------- the gas giant
def body(dirs, centre, ang_r, shade):
    """Ray-traced sphere at angular radius ang_r; shade(n, hit_mask) -> colours for the hit directions."""
    cos_t = dirs @ centre
    sin_r = math.sin(ang_r)
    Dd, Rr = 1.0, sin_r
    b = Dd * cos_t
    disc = b * b - (Dd * Dd - Rr * Rr)
    hit = (disc > 0) & (cos_t > 0)
    tt = b[hit] - np.sqrt(disc[hit])
    P = dirs[hit] * tt[:, None]
    n = (P - centre[None] * Dd) / Rr
    return hit, n, np.arccos(np.clip(cos_t, -1, 1))


AXIS = unit(np.array([0.18, 1.0, 0.12]))
hit, n, ang = body(Df, PLANET, PLANET_R, None)
plat = np.arcsin(np.clip(n @ AXIS, -1, 1))
e1 = unit(np.cross(AXIS, np.array([0, 0, 1.0])))
e2 = np.cross(AXIS, e1)
plon = np.arctan2(n @ e2, n @ e1)
warp = fbm(n * 6.0, 1.0, 4, 41) * 0.05 + fbm(n * 22.0, 1.0, 3, 42) * 0.012
lw = plat + warp
# zones and belts: a latitude palette with fine banding
x = lw / (math.pi / 2)
base = 0.5 + 0.5 * np.sin(x * 9.5 + 0.8) * np.cos(x * 3.1)
fine = 0.5 + 0.5 * np.sin(x * 41 + fbm(n * 10, 1, 3, 43) * 3)
base = np.clip((base - 0.5) * 1.5 + 0.5, 0, 1)
cream = np.array([0.80, 0.70, 0.55])
belt = np.array([0.36, 0.19, 0.09])
rust = np.array([0.62, 0.36, 0.20])
col = cream * base[:, None] + belt * (1 - base[:, None])
col = col * (0.82 + 0.28 * fine[:, None])
col = col * (1 - 0.35 * sstep(0.6, 1.0, np.abs(x))[:, None]) + np.array([0.35, 0.33, 0.30]) * 0.35 * sstep(0.6, 1.0, np.abs(x))[:, None]
# the great storm
slat0, slon0 = math.radians(-22), 0.9
dl = (plon - slon0 + math.pi) % (2 * math.pi) - math.pi
storm = np.exp(-(((plat - slat0) / 0.075) ** 2 + (dl / 0.19) ** 2))
swirl = 0.5 + 0.5 * np.sin(np.sqrt(((plat - slat0) / 0.075) ** 2 + (dl / 0.19) ** 2) * 9 - np.arctan2(plat - slat0, dl) * 2)
col = col * (1 - storm[:, None] * 0.85) + (rust * (0.8 + 0.3 * swirl[:, None])) * storm[:, None] * 0.85
# light: Lambert with limb darkening, soft terminator, a thin bright limb of atmosphere on the lit side
mu = np.clip(n @ SUN, -1, 1)
view_mu = np.clip(-np.sum(Df[hit] * n, 1), 0, 1)
lamb = sstep(-0.06, 0.25, mu) * np.clip(mu, 0, 1) ** 0.8 + 0.02 * sstep(-0.2, 0.05, mu)
limb = view_mu ** 0.35
atmo = (1 - view_mu) ** 3.5 * sstep(-0.1, 0.3, mu)
pcol = col * (lamb * limb)[:, None] * 1.25 + atmo[:, None] * np.array([0.55, 0.62, 0.72]) * 0.55
planet_img = img.copy()
planet_img[hit] = pcol + 0.004
# a soft haze just outside the lit limb
halo = np.exp(-np.clip(ang - PLANET_R, 0, None) / math.radians(0.7)) * (~hit)
hal_sun = np.clip(((Df - PLANET[None]) @ SUN) * 4 + 0.3, 0, 1)
planet_img += (halo * hal_sun * 0.05)[:, None] * np.array([0.6, 0.66, 0.78])
img = planet_img
log('planet')

# ---------------------------------------------------------------- the moon
hit, n, ang = body(Df, MOON, MOON_R, None)
mu = np.clip(n @ SUN, 0, 1)
cr = fbm(n * 9.0, 1.0, 5, 51) * 0.5 + 0.5
mcol = np.array([0.42, 0.40, 0.38]) * (0.7 + 0.5 * cr[:, None])
img[hit] = mcol * (mu ** 0.9)[:, None] * 1.1 + 0.002
log('moon')

# ---------------------------------------------------------------- the sun's glow (the disc itself is drawn in-game)
sa = np.arccos(np.clip(Df @ SUN, -1, 1))
img += (np.exp(-sa / 0.22) * 0.05 + np.exp(-sa / 0.06) * 0.12)[:, None] * np.array([1.0, 0.86, 0.68])

out = lin2srgb(img.reshape(H, W, 3))
Image.fromarray((out * 255 + 0.5).astype(np.uint8)).save(os.path.join(OUT, 'sky.jpg'), quality=91, optimize=True)
Image.fromarray((out * 255 + 0.5).astype(np.uint8)).resize((W // 2, H // 2), Image.LANCZOS).save(os.path.join(OUT, 'sky-2k.jpg'), quality=90, optimize=True)
bright = np.argsort(-flux * 0 - (0.0009 * mag ** 1.7))[:9000]
stars = np.concatenate([sd[bright], (0.0009 * mag[bright] ** 1.7)[:, None], tint[bright]], 1)
json.dump({'stars': np.round(stars, 4).tolist()}, open(os.path.join(OUT, 'stars.json'), 'w'), separators=(',', ':'))
json.dump({'sun': SUN.round(5).tolist(), 'planet': PLANET.round(5).tolist(), 'planetRadiusDeg': 11.0,
           'moon': MOON.round(5).tolist()}, open(os.path.join(OUT, 'sky.json'), 'w'))
log('sky.jpg written', os.path.getsize(os.path.join(OUT, 'sky.jpg')) // 1024, 'KB')
