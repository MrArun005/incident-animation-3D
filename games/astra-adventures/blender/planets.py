# Surface maps for the solar system the game puts round the rock field: Mercury, Venus, Earth (with its Moon),
# Mars, Jupiter, Saturn (plus its rings), Uranus and Neptune. Each is an equirect in three.js SphereGeometry
# convention, painted from 3D noise sampled on the sphere so nothing seams at the date line or the poles.
#   /tmp/bvenv/bin/python planets.py [--res 2048]   -> ../assets/planet-<name>.jpg, planet-rings.png
# Not photographs: stylised to read at a glance (the Great Red Spot, Saturn's gaps, Earth's blue and white).
import sys, os, math, time
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import numpy as np
from PIL import Image
from noise import fbm, ridged

args = sys.argv[1:]
RES = int(args[args.index('--res') + 1]) if '--res' in args else 2048
OUT = os.path.join(HERE, '..', 'assets')
T0 = time.time()


def log(*a):
    print(f'[{time.time() - T0:6.1f}s]', *a, flush=True)


def sstep(a, b, x):
    t = np.clip((x - a) / (b - a), 0, 1)
    return t * t * (3 - 2 * t)


def lin2srgb(c):
    c = np.clip(c, 0, 1)
    return np.where(c <= 0.0031308, c * 12.92, 1.055 * np.power(c, 1 / 2.4) - 0.055)


def srgb(c):
    c = np.asarray(c, np.float32)
    return np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)


def grid(w):
    """Unit directions for every texel of a w x w/2 equirect, three.js SphereGeometry layout (row 0 = north)."""
    h = w // 2
    th = (np.arange(h) + 0.5) / h * math.pi
    ph = (np.arange(w) + 0.5) / w * 2 * math.pi
    T, P = np.meshgrid(th, ph, indexing='ij')
    d = np.stack([-np.cos(P) * np.sin(T), np.cos(T), np.sin(P) * np.sin(T)], -1).reshape(-1, 3).astype(np.float32)
    lat = (math.pi / 2 - T).reshape(-1).astype(np.float32)
    lon = P.reshape(-1).astype(np.float32)
    return d, lat, lon, h


def save(name, col, w):
    h = w // 2
    img = (lin2srgb(col.reshape(h, w, 3)) * 255 + 0.5).astype(np.uint8)
    Image.fromarray(img).save(os.path.join(OUT, f'planet-{name}.jpg'), quality=90, optimize=True)
    log(name, f'{w}x{h}')


def palette(t, stops):
    """Linear interpolation through (t, rgb) stops; t in [0, 1]."""
    ts = np.array([s[0] for s in stops], np.float32)
    cs = srgb([s[1] for s in stops])
    t = np.clip(t, 0, 1)
    out = np.empty((len(t), 3), np.float32)
    for k in range(3):
        out[:, k] = np.interp(t, ts, cs[:, k])
    return out


def banded(d, lat, lon, stops, nb, warp_amt, seed, fine=0.25):
    """Gas-giant bands: a latitude palette, warped by turbulence, with fine streaks."""
    w = fbm(d * 3.0, 1.0, 4, seed) * warp_amt + fbm(d * 11.0, 1.0, 3, seed + 1) * warp_amt * 0.3
    x = (lat + w) / (math.pi / 2)
    t = 0.5 + 0.5 * np.sin(x * nb + 0.7) * np.cos(x * nb * 0.33)
    col = palette(t, stops)
    streak = 0.5 + 0.5 * np.sin(x * nb * 4.3 + fbm(d * 7, 1, 3, seed + 2) * 2.5)
    return col * (1 - fine + fine * 2 * streak[:, None] * 0.5 + fine * 0.5)


def mercury(w):
    d, lat, lon, h = grid(w)
    base = palette(0.5 + 0.5 * fbm(d * 2.0, 1, 5, 11), [(0, (0.36, 0.34, 0.32)), (1, (0.62, 0.59, 0.55))])
    cr = ridged(d * 6.0, 1.0, 5, 12)
    col = base * (0.75 + 0.45 * cr[:, None])
    rays = sstep(0.82, 0.95, 0.5 + 0.5 * fbm(d * 18, 1, 3, 13))
    save('mercury', col * (1 + 0.25 * rays[:, None]), w)


def venus(w):
    d, lat, lon, h = grid(w)
    # thick cloud deck: broad chevrons swept by the super-rotation
    sw = fbm(d * 2.2 + np.stack([lat * 2, lat * 0, lat * 0], 1), 1, 5, 21)
    t = 0.5 + 0.35 * sw + 0.15 * np.sin(lat * 6 + sw * 3)
    col = palette(t, [(0, (0.72, 0.58, 0.36)), (0.5, (0.88, 0.78, 0.56)), (1, (0.97, 0.93, 0.80))])
    save('venus', col, w)


def earth(w):
    d, lat, lon, h = grid(w)
    land = fbm(d * 1.6, 1.0, 7, 31) + 0.25 * fbm(d * 5.0, 1.0, 4, 32)
    sea = land < 0.08
    shore = sstep(0.08, 0.16, land)
    ice = sstep(1.05, 1.2, np.abs(lat) + 0.08 * fbm(d * 6, 1, 3, 33))
    dry = sstep(0.1, 0.5, np.abs(0.5 + 0.5 * fbm(d * 3, 1, 4, 34)) - np.abs(np.abs(lat) - 0.4) * 0.8)
    green = srgb((0.13, 0.30, 0.10))
    desert = srgb((0.62, 0.50, 0.30))
    mount = srgb((0.40, 0.36, 0.30))
    lcol = green[None] * (1 - dry[:, None]) + desert[None] * dry[:, None]
    lcol = lcol * (1 - sstep(0.55, 0.9, land)[:, None]) + mount[None] * sstep(0.55, 0.9, land)[:, None]
    deep, shallow = srgb((0.02, 0.07, 0.22)), srgb((0.06, 0.24, 0.42))
    ocol = deep[None] + (shallow - deep)[None] * sstep(-0.35, 0.08, land)[:, None]
    col = np.where(sea[:, None], ocol, lcol * (0.6 + 0.4 * shore[:, None]))
    col = col * (1 - ice[:, None]) + srgb((0.92, 0.95, 0.98))[None] * ice[:, None]
    # clouds: swirled fBm, heavier in the storm belts
    cw = fbm(d * 2.5 + fbm(d * 1.2, 1, 3, 35)[:, None] * 0.6, 1.0, 6, 36)
    band = 0.6 + 0.4 * np.cos(lat * 6)
    cloud = sstep(0.05, 0.45, cw * band)
    col = col * (1 - 0.85 * cloud[:, None]) + srgb((0.95, 0.96, 0.98))[None] * 0.85 * cloud[:, None]
    save('earth', col, w)


def moon(w):
    d, lat, lon, h = grid(w)
    mare = sstep(0.1, 0.35, fbm(d * 1.4, 1, 5, 41))
    base = srgb((0.55, 0.54, 0.52))[None] * (1 - 0.45 * mare[:, None])
    cr = ridged(d * 7.0, 1.0, 5, 42)
    save('moon', base * (0.8 + 0.35 * cr[:, None]), w)


def mars(w):
    d, lat, lon, h = grid(w)
    t = 0.5 + 0.5 * fbm(d * 2.0, 1.0, 6, 51)
    col = palette(t, [(0, (0.30, 0.13, 0.07)), (0.45, (0.62, 0.30, 0.15)), (1, (0.80, 0.52, 0.32))])
    dark = sstep(0.15, 0.5, fbm(d * 1.2, 1, 4, 52)) * sstep(-0.9, 0.3, np.cos(lat * 2.2))
    col = col * (1 - 0.45 * dark[:, None])
    canyon = (1 - sstep(0.0, 0.06, np.abs(lat + 0.12 + 0.04 * fbm(d * 4, 1, 3, 53)))) * sstep(0.5, 1.6, lon) * (1 - sstep(1.6, 2.4, lon))
    col = col * (1 - 0.5 * canyon[:, None])
    cap = sstep(1.18, 1.3, lat + 0.06 * fbm(d * 5, 1, 3, 54)) + sstep(1.28, 1.4, -lat)
    col = col * (1 - cap[:, None]) + srgb((0.93, 0.92, 0.90))[None] * cap[:, None]
    save('mars', col, w)


def jupiter(w):
    d, lat, lon, h = grid(w)
    col = banded(d, lat, lon, [(0, (0.46, 0.27, 0.14)), (0.35, (0.72, 0.55, 0.38)), (0.65, (0.90, 0.82, 0.66)),
                              (1, (0.96, 0.92, 0.82))], 11.0, 0.06, 61)
    col = col * (1 - 0.35 * sstep(1.1, 1.5, np.abs(lat))[:, None]) + srgb((0.5, 0.48, 0.45))[None] * 0.35 * sstep(1.1, 1.5, np.abs(lat))[:, None]
    slat0, slon0 = math.radians(-22), 2.2
    dl = (lon - slon0 + math.pi) % (2 * math.pi) - math.pi
    r = np.sqrt(((lat - slat0) / 0.075) ** 2 + (dl / 0.16) ** 2)
    storm = np.exp(-r ** 2)
    swirl = 0.5 + 0.5 * np.sin(r * 9 - np.arctan2(lat - slat0, dl) * 2)
    col = col * (1 - 0.85 * storm[:, None]) + srgb((0.72, 0.30, 0.16))[None] * (0.8 + 0.3 * swirl[:, None]) * 0.85 * storm[:, None]
    save('jupiter', col, w)


def saturn(w):
    d, lat, lon, h = grid(w)
    col = banded(d, lat, lon, [(0, (0.66, 0.52, 0.32)), (0.5, (0.86, 0.76, 0.54)), (1, (0.95, 0.89, 0.72))], 13.0, 0.025, 71, fine=0.12)
    hexa = sstep(1.25, 1.35, lat)
    col = col * (1 - 0.3 * hexa[:, None]) + srgb((0.55, 0.60, 0.62))[None] * 0.3 * hexa[:, None]
    save('saturn', col, w)


def rings(n=2048):
    """Saturn's rings as a radial strip (u: inner -> outer edge), RGBA: C ring, B ring, Cassini gap, A ring,
    Encke gap, F ring."""
    r = (np.arange(n) + 0.5) / n                           # 0 at 1.24 planet radii, 1 at 2.33
    R = 1.24 + r * (2.33 - 1.24)
    dens = np.zeros(n, np.float32)
    dens += (R < 1.52) * 0.25                               # C ring, faint
    dens += (R >= 1.52) * (R < 1.95) * 0.95                 # B ring, the bright one
    dens += (R >= 2.03) * (R < 2.27) * 0.7                  # A ring
    dens *= 1 - ((R > 2.20) & (R < 2.215))                  # Encke gap
    dens += np.exp(-((R - 2.32) / 0.004) ** 2) * 0.6        # F ring
    rng = np.random.default_rng(81)
    fine = np.convolve(rng.standard_normal(n), np.ones(9) / 9, 'same')
    dens = np.clip(dens * (0.8 + 0.25 * fine) + 0.12 * fine * (dens > 0), 0, 1)
    col = srgb((0.86, 0.78, 0.62))[None] * (0.75 + 0.3 * np.sin(R * 60)[:, None] * 0.3) * np.ones((n, 1))
    rgba = np.concatenate([lin2srgb(col), dens[:, None]], 1)
    img = (np.repeat(rgba[None], 8, 0) * 255 + 0.5).astype(np.uint8)
    Image.fromarray(img, 'RGBA').save(os.path.join(OUT, 'planet-rings.png'), optimize=True)
    log('rings')


def uranus(w):
    d, lat, lon, h = grid(w)
    col = banded(d, lat, lon, [(0, (0.52, 0.76, 0.80)), (1, (0.66, 0.86, 0.88))], 7.0, 0.02, 91, fine=0.05)
    save('uranus', col, w)


def neptune(w):
    d, lat, lon, h = grid(w)
    col = banded(d, lat, lon, [(0, (0.10, 0.20, 0.55)), (0.6, (0.20, 0.36, 0.78)), (1, (0.34, 0.50, 0.90))], 8.0, 0.04, 95, fine=0.12)
    dl = (lon - 1.1 + math.pi) % (2 * math.pi) - math.pi
    spot = np.exp(-(((lat + 0.35) / 0.07) ** 2 + (dl / 0.14) ** 2))
    col = col * (1 - 0.6 * spot[:, None])
    streak = np.exp(-(((lat + 0.26) / 0.02) ** 2)) * sstep(0.3, 0.8, 0.5 + 0.5 * fbm(d * 6, 1, 3, 96))
    col = col + srgb((0.9, 0.93, 1.0))[None] * 0.5 * streak[:, None]
    save('neptune', col, w)


if __name__ == '__main__':
    big, small = RES, RES // 2
    for f, w in ((jupiter, big), (saturn, big), (earth, big), (mars, small), (venus, small), (mercury, small),
                 (uranus, small), (neptune, small), (moon, small)):
        f(w)
    rings()
    log('done')
