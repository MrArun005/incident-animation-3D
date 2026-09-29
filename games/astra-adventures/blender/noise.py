# Vectorised gradient noise for the asset builds (numpy only).
import numpy as np

_G3 = np.array([[1, 1, 0], [-1, 1, 0], [1, -1, 0], [-1, -1, 0], [1, 0, 1], [-1, 0, 1], [1, 0, -1], [-1, 0, -1],
                [0, 1, 1], [0, -1, 1], [0, 1, -1], [0, -1, -1]], np.float32)
_PERM = {}


def _perm(seed):
    if seed not in _PERM:
        p = np.random.default_rng(seed).permutation(256).astype(np.int32)
        _PERM[seed] = np.concatenate([p, p])
    return _PERM[seed]


def perlin3(x, y, z, seed=0):
    """Improved Perlin noise, roughly in [-1, 1]. x, y, z: float arrays of the same shape."""
    perm = _perm(seed)
    xi, yi, zi = np.floor(x), np.floor(y), np.floor(z)
    xf, yf, zf = (x - xi).astype(np.float32), (y - yi).astype(np.float32), (z - zi).astype(np.float32)
    xi, yi, zi = xi.astype(np.int32) & 255, yi.astype(np.int32) & 255, zi.astype(np.int32) & 255
    fu = xf * xf * xf * (xf * (xf * 6 - 15) + 10)
    fv = yf * yf * yf * (yf * (yf * 6 - 15) + 10)
    fw = zf * zf * zf * (zf * (zf * 6 - 15) + 10)

    def gr(h, dx, dy, dz):
        g = _G3[h % 12]
        return g[..., 0] * dx + g[..., 1] * dy + g[..., 2] * dz
    a = perm[xi] + yi
    b = perm[xi + 1] + yi
    aa, ab, ba, bb = perm[a] + zi, perm[a + 1] + zi, perm[b] + zi, perm[b + 1] + zi
    x1 = gr(perm[aa], xf, yf, zf)
    x1 = x1 + fu * (gr(perm[ba], xf - 1, yf, zf) - x1)
    x2 = gr(perm[ab], xf, yf - 1, zf)
    x2 = x2 + fu * (gr(perm[bb], xf - 1, yf - 1, zf) - x2)
    y1 = x1 + fv * (x2 - x1)
    x3 = gr(perm[aa + 1], xf, yf, zf - 1)
    x3 = x3 + fu * (gr(perm[ba + 1], xf - 1, yf, zf - 1) - x3)
    x4 = gr(perm[ab + 1], xf, yf - 1, zf - 1)
    x4 = x4 + fu * (gr(perm[bb + 1], xf - 1, yf - 1, zf - 1) - x4)
    y2 = x3 + fv * (x4 - x3)
    return y1 + fw * (y2 - y1)


def fbm(p, freq, octaves=4, seed=0, gain=0.5, lac=2.03):
    """fBm over points p (n, 3), normalised to roughly [-1, 1]."""
    acc = np.zeros(len(p), np.float32)
    amp, f, tot = 1.0, freq, 0.0
    for o in range(octaves):
        acc += amp * perlin3(p[:, 0] * f + 17.3 * o, p[:, 1] * f - 5.1 * o, p[:, 2] * f + 3.7 * o, seed + o)
        tot += amp
        amp *= gain
        f *= lac
    return acc / tot


def ridged(p, freq, octaves=5, seed=0, gain=0.5, lac=2.1):
    """Ridged multifractal: sharp crests, in [0, 1]."""
    acc = np.zeros(len(p), np.float32)
    amp, f, tot, w = 1.0, freq, 0.0, np.ones(len(p), np.float32)
    for o in range(octaves):
        n = 1 - np.abs(perlin3(p[:, 0] * f + 3.1 * o, p[:, 1] * f + 11.7 * o, p[:, 2] * f - 7.3 * o, seed + 31 + o))
        n = n * n * w
        w = np.clip(n * 1.6, 0, 1)
        acc += amp * n
        tot += amp
        amp *= gain
        f *= lac
    return acc / tot
