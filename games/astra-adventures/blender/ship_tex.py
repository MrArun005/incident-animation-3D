# Stage B: paint the Jupiter Class IV from the baked geometry buffers (build/buf_*.npy).
#   /tmp/bvenv/bin/python ship_tex.py
# Writes build/tex_albedo_lead.png, build/tex_albedo_vega.png (sRGB), build/tex_orm.png (AO, roughness,
# metalness) and build/tex_height.npy (metres, for the bump -> normal bake in ship_export.py).
#
# Everything is laid out in 3D or in the panel coordinates (u, v) the geometry stored, never in UV space,
# so panel lines, stripes and stencils run straight across UV seams.
import sys, os, math, time
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import numpy as np
import scipy.ndimage as ndi
from scipy.spatial import cKDTree
from PIL import Image, ImageDraw, ImageFont
import ship_geo as G

B = os.path.join(HERE, 'build')
FONT = {k: os.path.join(HERE, 'fonts', f'{k}.ttf') for k in ('stencil-bold', 'stencil-semibold', 'mono-semibold',
                                                             'cond-semibold', 'cond-medium')}
LIVERIES = {'lead': {'mark': (0.94, 0.70, 0.13), 'num': '07', 'call': 'LEAD'},
            'vega': {'mark': (0.22, 0.52, 0.93), 'num': '12', 'call': 'VEGA'}}
T0 = time.time()


def log(*a):
    print(f'[{time.time() - T0:6.1f}s]', *a, flush=True)


def srgb2lin(c):
    c = np.asarray(c, np.float32)
    return np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)


def lin2srgb(c):
    c = np.clip(c, 0, 1)
    return np.where(c <= 0.0031308, c * 12.92, 1.055 * np.power(c, 1 / 2.4) - 0.055)


def sstep(a, b, x):
    t = np.clip((x - a) / (b - a), 0, 1)
    return t * t * (3 - 2 * t)


# ------------------------------------------------------------------ buffers
P = np.load(f'{B}/buf_pos.npy').astype(np.float32)
N = np.load(f'{B}/buf_nrm.npy').astype(np.float32)
PP = np.load(f'{B}/buf_pp.npy').astype(np.float32)
MISC = np.load(f'{B}/buf_misc.npy').astype(np.float32)
RES = P.shape[0]
X, Y, Z = P[..., 0], P[..., 1], P[..., 2]
NX, NY, NZ = N[..., 0], N[..., 1], N[..., 2]
U, V = PP[..., 0], PP[..., 1]
PART = np.round(PP[..., 2]).astype(np.int16)
KIND = np.round(MISC[..., 0]).astype(np.int8)
EDGE = np.clip(MISC[..., 1], 0, 2)
AO = np.clip(MISC[..., 2], 0, 1)
VALID = (NX * NX + NY * NY + NZ * NZ) > 0.25
N = N / np.maximum(np.linalg.norm(N, axis=2, keepdims=True), 1e-6)
NX, NY, NZ = N[..., 0], N[..., 1], N[..., 2]
_gx = np.linalg.norm(np.diff(P, axis=1), axis=2)
TEX = float(np.median(_gx[VALID[:, 1:] & (KIND[:, 1:] == 0)]))     # metres per texel on the paint
AA = 1.3 * TEX
log(f'{RES}px, texel {TEX * 1000:.2f} mm on the paint, {VALID.mean() * 100:.0f}% valid')

LINE = np.full((RES, RES), 9.0, np.float32)     # distance to the nearest panel line (m)
DEEP = np.full((RES, RES), 9.0, np.float32)     # distance to a control-surface gap / door seam
RIV = np.zeros((RES, RES), np.float32)          # rivet heads 0..1
PID = np.zeros((RES, RES), np.int32)            # panel id for per-panel variation
SCREW = np.zeros((RES, RES), np.float32)        # hatch fasteners 0..1
STREAK = np.zeros((RES, RES), np.float32)       # grime trailing aft of panel lines, 0..1


# ------------------------------------------------------------------ noise
_G3 = np.array([[1, 1, 0], [-1, 1, 0], [1, -1, 0], [-1, -1, 0], [1, 0, 1], [-1, 0, 1], [1, 0, -1], [-1, 0, -1],
                [0, 1, 1], [0, -1, 1], [0, 1, -1], [0, -1, -1]], np.float32)


def perlin3(x, y, z, seed=0):
    perm = np.random.default_rng(seed).permutation(256).astype(np.int32)
    perm = np.concatenate([perm, perm])
    xi, yi, zi = np.floor(x), np.floor(y), np.floor(z)
    xf, yf, zf = (x - xi).astype(np.float32), (y - yi).astype(np.float32), (z - zi).astype(np.float32)
    xi, yi, zi = xi.astype(np.int32) & 255, yi.astype(np.int32) & 255, zi.astype(np.int32) & 255
    fu = xf * xf * xf * (xf * (xf * 6 - 15) + 10)
    fv = yf * yf * yf * (yf * (yf * 6 - 15) + 10)
    fw = zf * zf * zf * (zf * (zf * 6 - 15) + 10)

    def gr(h, dx, dy, dz):
        g = _G3[h % 12]
        return g[:, 0] * dx + g[:, 1] * dy + g[:, 2] * dz
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


VI = np.nonzero(VALID.ravel())[0]
PV = P.reshape(-1, 3)[VI]


def fbm(freq, octaves=4, seed=0, gain=0.5, pts=None):
    """3D fBm over the valid texels, returned as a full-resolution image (0 elsewhere)."""
    pts = PV if pts is None else pts
    acc = np.zeros(len(pts), np.float32)
    amp, f, tot = 1.0, freq, 0.0
    for o in range(octaves):
        acc += amp * perlin3(pts[:, 0] * f + 17.3 * o, pts[:, 1] * f - 5.1 * o, pts[:, 2] * f + 3.7 * o, seed + o)
        tot += amp
        amp *= gain
        f *= 2.03
    out = np.zeros(RES * RES, np.float32)
    out[VI] = acc / tot
    return out.reshape(RES, RES)


def fft_noise(center, width=0.6, seed=0):
    """Band-limited noise in texture space: `center` in cycles per texture, log-gaussian band."""
    rng = np.random.default_rng(seed)
    w = rng.standard_normal((RES, RES)).astype(np.float32)
    F = np.fft.rfft2(w)
    fy = np.fft.fftfreq(RES)[:, None] * RES
    fx = np.fft.rfftfreq(RES)[None, :] * RES
    f = np.sqrt(fx * fx + fy * fy) + 1e-6
    F *= np.exp(-(np.log(f / center) ** 2) / (2 * width * width)).astype(np.float32)
    n = np.fft.irfft2(F, s=(RES, RES)).astype(np.float32)
    return n / (n.std() + 1e-9)


# ------------------------------------------------------------------ panel layouts
def rows_cols(sel, u, v, rows, cols, pid0, rivet_rows=False, rivet_cols=False, sp=0.075, off=0.03, rr=0.0085,
              streak_len=0.0):
    """Rectangular panel layout in (u, v): `rows` ascending u-boundaries; cols[i] is a list of v-boundaries
    for row i (numbers or functions of u). Writes LINE, PID and rivet rows beside the lines."""
    for i in range(len(rows) - 1):
        m = sel & (u >= rows[i]) & (u < rows[i + 1])
        if not m.any():
            continue
        uu, vv = u[m], v[m]
        d = np.minimum(uu - rows[i], rows[i + 1] - uu)
        riv = np.zeros_like(uu)
        if rivet_rows:
            for ub in (rows[i], rows[i + 1]):
                dp = np.abs(np.abs(uu - ub) - off)
                ph = (vv / sp) % 1.0 - 0.5
                r = np.sqrt(dp * dp + (ph * sp) ** 2)
                riv = np.maximum(riv, 1 - np.clip(r / rr, 0, 1) ** 2)
        cidx = np.zeros(len(uu), np.int32)
        for c in cols[i]:
            cb = c(uu) if callable(c) else np.full_like(uu, c)
            d = np.minimum(d, np.abs(vv - cb))
            cidx += (vv > cb).astype(np.int32)
            if rivet_cols:
                dp = np.abs(np.abs(vv - cb) - off)
                ph = (uu / sp) % 1.0 - 0.5
                r = np.sqrt(dp * dp + (ph * sp) ** 2)
                riv = np.maximum(riv, 1 - np.clip(r / rr, 0, 1) ** 2)
        LINE[m] = np.minimum(LINE[m], d)
        PID[m] = pid0 + i * 64 + cidx
        RIV[m] = np.maximum(RIV[m], riv)
        if streak_len > 0:
            # dirt runs aft from the seam ahead of each texel (u grows toward the nose)
            behind = rows[i + 1] - uu
            col = perlin3(vv * 22.0, np.full_like(vv, i * 3.7 + pid0 * 0.01), vv * 3.1, 77) * 0.5 + 0.5
            col = np.clip((col - 0.35) * 2.2, 0, 1) ** 1.5
            STREAK[m] = np.maximum(STREAK[m], col * np.exp(-behind / streak_len) * (behind > 0.004))


def sd_rrect(du, dv, hu, hv, r):
    qx, qy = np.abs(du) - hu + r, np.abs(dv) - hv + r
    return np.sqrt(np.maximum(qx, 0) ** 2 + np.maximum(qy, 0) ** 2) + np.minimum(np.maximum(qx, qy), 0) - r


def hatch(sel, u, v, uc, vc, hu, hv, r=0.03, deep=False, screws=True, target=None):
    m = sel & (np.abs(u - uc) < hu + 0.06) & (np.abs(v - vc) < hv + 0.06)
    if not m.any():
        return
    du, dv = u[m] - uc, v[m] - vc
    sd = np.abs(sd_rrect(du, dv, hu, hv, r))
    if deep:
        DEEP[m] = np.minimum(DEEP[m], sd)
    else:
        LINE[m] = np.minimum(LINE[m], sd)
    if screws:
        s = 0.0
        for cu in (-1, 1):
            for cv in (-1, 1):
                rr = np.sqrt((du - cu * (hu - 0.035)) ** 2 + (dv - cv * (hv - 0.035)) ** 2)
                s = np.maximum(s, 1 - np.clip(rr / 0.011, 0, 1))
        SCREW[m] = np.maximum(SCREW[m], s)


R = np.random.default_rng(7)
# fuselage feature arcs (arc length from the top centre line) as functions of y
_ys = np.linspace(G.Y_TAIL - 0.1, G.Y_NOSE + 0.1, 500)
_arc = []
for _y in _ys:
    _H = G.fuse_half(np.clip(_y, G.Y_TAIL, G.Y_NOSE))
    _s = np.concatenate([[0], np.cumsum(np.linalg.norm(np.diff(_H, axis=0), axis=1))])
    _arc.append([(_s[5] + _s[6]) / 2, (_s[13] + _s[14]) / 2, _s[G.IC], (_s[25] + _s[26]) / 2, _s[33], _s[-1]])
_arc = np.array(_arc)


def farc(k, frac=0.0, k2=None):
    """v boundary following fuselage feature k (1 = top shoulder ... 5 = bottom shoulder, 6 = keel line)."""
    def f(u):
        a = np.interp(u, _ys, _arc[:, k - 1])
        if k2 is not None:
            a = a + (np.interp(u, _ys, _arc[:, k2 - 1]) - a) * frac
        return a
    return f


sel = VALID & (PART == 1)
fu, fv = U, np.abs(V)
FROWS = [G.Y_TAIL - 0.2, -5.1, -4.4, -3.6, -2.9, -2.05, -1.3, -0.45, 0.35, 1.3, 2.25, 3.2, 4.0, 4.75, 5.45, 6.15, 8.0]
fcols = []
for i in range(len(FROWS) - 1):
    c = [farc(3), farc(6)]                                   # the chine and the keel line always
    if i % 3 != 1:
        c.append(0.0)                                        # dorsal centre seam
    c.append(farc(1, 0.5, 2) if i % 2 else farc(2))          # upper flank
    c.append(farc(4, 0.5, 5) if i % 2 == 0 else farc(5))     # lower flank
    if FROWS[i] > 5.4:
        c = [farc(3), farc(6)]                               # the radome is one piece
    fcols.append(c)
rows_cols(sel, fu, fv, FROWS, fcols, 10000, rivet_rows=True, streak_len=0.30)
PID[sel & (V < 0)] += 5000
# fuselage hatches (mirrored both sides): (u, v-centre as feature interpolation, half-sizes)
for (uc, k, fr, k2, hu, hv) in ((-1.7, 3, 0.45, 4, 0.30, 0.16), (-3.25, 2, 0.5, 3, 0.26, 0.14), (0.0, 4, 0.5, 5, 0.34, 0.12),
                                (4.35, 3, 0.55, 4, 0.18, 0.09), (-4.72, 1, 0.5, 2, 0.16, 0.10), (2.7, 4, 0.4, 5, 0.22, 0.10),
                                (-0.9, 5, 0.6, 6, 0.40, 0.14)):
    vc = farc(k, fr, k2)(np.array([uc]))[0]
    hatch(sel, fu, fv, uc, vc, hu, hv)
# landing-gear doors on the belly (a deep seam)
for (uc, hu, hv) in ((3.1, 0.62, 0.20), (-2.4, 0.75, 0.24)):
    hatch(sel, fu, fv, uc, np.interp(uc, _ys, _arc[:, 5]) - 0.02, hu, hv + 0.2, r=0.05, deep=True, screws=False)

# wings: u = x (span), v = y; lines at chord fractions
for pid, sgn in ((6, 1), (16, -1)):
    sel = VALID & (PART == pid)
    ax = np.abs(X)
    le, te = G.wing_le(ax), G.wing_te(ax)
    c = le - te
    fch = (le - Y) / c                                         # 0 at the leading edge, 1 at the trailing edge
    xs = [G.W_ROOT - 0.2, 1.85, 2.65, 3.45, 4.2, G.W_TIP + 0.3]
    for i in range(len(xs) - 1):
        m = sel & (ax >= xs[i]) & (ax < xs[i + 1])
        d = np.minimum(ax[m] - xs[i], xs[i + 1] - ax[m])
        cm = c[m]
        idx = np.zeros(m.sum(), np.int32)
        for fb in ((0.11, 0.40, 0.70) if i % 2 else (0.11, 0.52, 0.70)):
            d = np.minimum(d, np.abs(fch[m] - fb) * cm)
            idx += (fch[m] > fb)
        LINE[m] = np.minimum(LINE[m], d)
        PID[m] = 20000 + pid * 1000 + i * 16 + idx
        fbs = np.array((0.0, 0.11, 0.40, 0.70) if i % 2 else (0.0, 0.11, 0.52, 0.70))
        ahead = fch[m][:, None] - fbs[None]
        ahead = np.where(ahead > 0, ahead, 9).min(1) * cm
        colw = perlin3(Y[m] * 0 + ax[m] * 20.0, np.full(m.sum(), i * 2.1 + pid), ax[m] * 2.3, 78) * 0.5 + 0.5
        colw = np.clip((colw - 0.35) * 2.2, 0, 1) ** 1.5
        STREAK[m] = np.maximum(STREAK[m], colw * np.exp(-ahead / 0.28) * (ahead > 0.004))
        # rivets along the spars
        ph = (Y[m] / 0.075) % 1.0 - 0.5
        riv = np.zeros(m.sum(), np.float32)
        for fb in (0.11, 0.70):
            dp = np.abs(np.abs(fch[m] - fb) * cm - 0.03)
            riv = np.maximum(riv, 1 - np.clip(np.sqrt(dp ** 2 + (ph * 0.075) ** 2) / 0.0085, 0, 1) ** 2)
        RIV[m] = np.maximum(RIV[m], riv)
    # flap and aileron: a gap along the hinge and at the ends
    for x0, x1 in ((1.45, 2.95), (3.05, 4.35)):
        m = sel & (ax > x0 - 0.05) & (ax < x1 + 0.05) & (fch > 0.66)
        dd = np.minimum(np.abs(fch[m] - 0.735) * c[m], np.minimum(np.abs(ax[m] - x0), np.abs(ax[m] - x1)))
        inside = (ax[m] > x0) & (ax[m] < x1)
        dd = np.where(inside | (dd < 0.01), dd, 9)
        DEEP[m] = np.minimum(DEEP[m], dd)
    hatch(sel, ax, Y, 3.7, 0.55 * 0 + G.wing_le(3.7) - 1.2, 0.20, 0.14)
    hatch(sel, ax, Y, 2.25, G.wing_le(2.25) - 2.6, 0.26, 0.12)

# nacelles: u = y, v = arc from the top (positive inboard on both sides)
NROWS = [-4.03, -3.62, -3.02, -2.25, -1.45, -0.55, 0.35, 0.95]
for pid in (8, 18):
    sel = VALID & (PART == pid) & (KIND == 0) & (U < 0.96) & (U > -4.03)
    ncols = []
    for i in range(len(NROWS) - 1):
        c = [0.0, 1.21, -1.21, 2.42, -2.42]
        c += [0.6, -0.6] if i % 2 else [1.81, -1.81]
        ncols.append(c)
    rows_cols(sel, U, V, NROWS, ncols, 30000 + pid * 1000, rivet_rows=True, streak_len=0.35)
    # engine access door on the outboard flank, with a deep seam
    hatch(sel, U, V, -2.2, -1.35, 0.62, 0.42, r=0.06, deep=True, screws=True)
    hatch(sel, U, V, 0.0, 1.55, 0.22, 0.14)
    hatch(sel, U, V, -3.3, 1.0, 0.16, 0.12)

# spine, fins, strut, scoops, keel
sel = VALID & (PART == 4) & (KIND == 0)
rows_cols(sel, U, np.abs(V), [-6, -4.8, -3.75, -2.5, -0.95, 0.1, 1.5], [[0.0], [], [0.0], [], [0.0], []], 40000,
          streak_len=0.3)
SPAN = np.zeros((RES, RES), np.float32)          # fin span measured from the root
for pid in (11, 20, 13):
    sel = VALID & (PART == pid)
    SPAN[sel] = V[sel]                               # ship_geo stores the span measured from the root
for pid in (11, 20):
    sel = VALID & (PART == pid)
    rows_cols(sel, SPAN, U, [-1, 0.24, 0.47, 2], [[-4.9], [-4.95], []], 41000 + pid * 100)
for pid in (7, 17):
    sel = VALID & (PART == pid)
    rows_cols(sel, np.abs(U), V, [0, 2.2, 3.5, 6], [[], [], []], 42000 + pid * 100, rivet_rows=True)
for pid in (5, 15, 12, 13):
    sel = VALID & (PART == pid) & (KIND == 0)
    rows_cols(sel, U, np.abs(V), [-9, 1.6, 2.4, 9] if pid in (5, 15) else [-9, -2.0, 1.0, 9], [[], [], []], 43000 + pid * 100)
log('panels laid out')

# ------------------------------------------------------------------ stencils and decals
_tree = {}


def surf(part, u0, v0):
    """Surface point + normal of `part` nearest to panel coords (u0, v0)."""
    if part not in _tree:
        idx = np.nonzero((VALID & (PART == part) & (KIND == 0)).ravel())[0]
        _tree[part] = (cKDTree(np.stack([U.ravel()[idx], V.ravel()[idx]], 1)), idx)
    t, idx = _tree[part]
    _, j = t.query([u0, v0])
    k = idx[j]
    return P.reshape(-1, 3)[k].copy(), N.reshape(-1, 3)[k].copy()


def text_masks(text, font, px=160, stroke=0, spacing=0):
    f = ImageFont.truetype(FONT[font], px)
    d0 = ImageDraw.Draw(Image.new('L', (1, 1)))
    bb = d0.textbbox((0, 0), text, font=f, stroke_width=stroke)
    pad = 6 + stroke
    w, h = bb[2] - bb[0] + 2 * pad, bb[3] - bb[1] + 2 * pad
    full = Image.new('L', (w, h), 0)
    ImageDraw.Draw(full).text((pad - bb[0], pad - bb[1]), text, font=f, fill=255, stroke_width=stroke, stroke_fill=255)
    fill = Image.new('L', (w, h), 0)
    ImageDraw.Draw(fill).text((pad - bb[0], pad - bb[1]), text, font=f, fill=255)
    return np.asarray(fill, np.float32) / 255, np.asarray(full, np.float32) / 255


def project(img, parts, C, Nrm, right, h_m, depth=0.12, facing=0.25, kinds=(0,)):
    """Planar projection of a (H, W) mask onto the surface. Returns a full-resolution coverage mask."""
    Hh, Ww = img.shape
    w_m = h_m * Ww / Hh
    ax = np.asarray(Nrm, np.float32)
    ax /= np.linalg.norm(ax)
    rt = np.asarray(right, np.float32)
    rt = rt - ax * np.dot(rt, ax)
    rt /= np.linalg.norm(rt)
    up = np.cross(ax, rt)
    r = 0.5 * math.hypot(w_m, h_m) + 0.05
    m = VALID & np.isin(PART, parts) & np.isin(KIND, kinds) & (np.abs(X - C[0]) < r) & (np.abs(Y - C[1]) < r) & (np.abs(Z - C[2]) < r)
    out = np.zeros((RES, RES), np.float32)
    if not m.any():
        return out
    d = P[m] - np.asarray(C, np.float32)
    su = d @ rt / w_m + 0.5
    sv = d @ up / h_m + 0.5
    ok = (su >= 0) & (su <= 1) & (sv >= 0) & (sv <= 1) & (np.abs(d @ ax) < depth) & (N[m] @ ax > facing)
    val = np.zeros(len(su), np.float32)
    val[ok] = ndi.map_coordinates(img, [(1 - sv[ok]) * (Hh - 1), su[ok] * (Ww - 1)], order=1)
    out[m] = val
    return out


def frame_at(part, u0, v0, right):
    C, n = surf(part, u0, v0)
    return C, n, right


class Layer:
    def __init__(self):
        self.items = []     # (mask, colour-name, rough)

    def add(self, mask, col, rough=0.5):
        self.items.append((mask, col, rough))


def livery_layers(L):
    """Stencils for one livery: list of (mask, colour-key, roughness). Colour keys: mark, black, white, grey."""
    lay = Layer()
    mk = L['num']
    # big numbers on the upper nose flanks, both sides (reading nose-first on each side)
    for sgn in (1, -1):
        C, n = surf(1, 4.65, sgn * float(farc(1, 0.55, 2)(np.array([4.65]))[0]))
        fill, full = text_masks(mk, 'stencil-bold', 200, stroke=10)
        rt = np.array([0, sgn * 1.0, 0])
        lay.add(project(full, [1], C, n, rt, 0.34), 'black', 0.5)
        lay.add(project(fill, [1], C, n, rt, 0.34), 'mark', 0.42)
        # callsign plate under the canopy rail
        C, n = surf(1, 2.2, sgn * float(farc(2, 0.25, 3)(np.array([2.2]))[0]))
        fill, full = text_masks(L['call'], 'cond-semibold', 120)
        lay.add(project(fill, [1], C, n, rt, 0.075), 'black', 0.5)
        C, n = surf(1, 3.45, sgn * float(farc(2, 0.35, 3)(np.array([3.45]))[0]))
        fill, full = text_masks('RESCUE', 'stencil-semibold', 120, stroke=6)
        lay.add(project(full, [1], C, n, rt, 0.07), 'black', 0.5)
        lay.add(project(fill, [1], C, n, rt, 0.07), 'mark', 0.45)
        C, n = surf(1, 1.1, sgn * float(farc(3, 0.45, 4)(np.array([1.1]))[0]))
        fill, full = text_masks('EXT PWR  115V 400Hz', 'mono-semibold', 90)
        lay.add(project(fill, [1], C, n, rt, 0.04), 'black', 0.5)
        C, n = surf(1, -3.9, sgn * float(farc(3, 0.3, 4)(np.array([-3.9]))[0]))
        fill, full = text_masks('JC-IV  AX-2207-' + mk, 'mono-semibold', 90)
        lay.add(project(fill, [1], C, n, rt, 0.045), 'black', 0.5)
        C, n = surf(1, -1.2, sgn * float(farc(4, 0.5, 5)(np.array([-1.2]))[0]))
        fill, full = text_masks('O2 SERVICE', 'mono-semibold', 90)
        lay.add(project(fill, [1], C, n, rt, 0.04), 'black', 0.5)
    # wings: NO STEP, WALKWAY outline, the Jupiter emblem
    for pid, sgn in ((6, 1), (16, -1)):
        ax = sgn * 2.95
        C, n = surf(pid, sgn * 2.95, G.wing_le(2.95) - 1.0)
        C = np.array([ax, G.wing_le(2.95) - 1.05, C[2]])
        fill, full = text_masks('NO STEP', 'stencil-semibold', 120)
        lay.add(project(fill, [pid], C, [0, 0, 1], [1, 0, 0], 0.085, facing=0.5), 'black', 0.5)
        C = np.array([sgn * 3.95, G.wing_le(3.95) - 1.75, 0.2])
        em = emblem(360)
        lay.add(project(em[0], [pid], C, [0, 0, 1], [1, 0, 0], 0.80, depth=0.4, facing=0.5), 'black', 0.5)
        lay.add(project(em[1], [pid], C, [0, 0, 1], [1, 0, 0], 0.80, depth=0.4, facing=0.5), 'mark', 0.42)
    # nacelles: type name, intake warning
    for pid, sgn in ((8, 1), (18, -1)):
        rt = np.array([0, sgn * 1.0, 0])
        C, n = surf(pid, -1.0, -0.72)
        fill, full = text_masks('JUPITER CLASS IV', 'stencil-semibold', 120)
        lay.add(project(fill, [pid], C, n, rt, 0.085), 'black', 0.5)
        C, n = surf(pid, 0.55, -1.05)
        fill, full = text_masks('DANGER  INTAKE', 'stencil-semibold', 120, stroke=6)
        lay.add(project(full, [pid], C, n, rt, 0.06), 'black', 0.5)
        lay.add(project(fill, [pid], C, n, rt, 0.06), 'mark', 0.45)
        C, n = surf(pid, -3.3, -1.6)
        fill, full = text_masks('HOT', 'stencil-bold', 120)
        lay.add(project(fill, [pid], C, n, rt, 0.07), 'black', 0.5)
    # fins: the number and a serial
    for pid, sgn in ((11, 1), (20, -1)):
        for side in (1, -1):
            cant = math.radians(22)
            C = np.array([sgn * (0.34 + math.sin(cant) * 0.30), -4.72, G.fuse_top(0.34, -4.6) + math.cos(cant) * 0.30])
            nrm = np.array([sgn * math.cos(math.radians(22)) * side, 0, -math.sin(math.radians(22)) * side])
            fill, full = text_masks(mk, 'stencil-bold', 160, stroke=8)
            rt = np.array([0, side * sgn * 1.0, 0])
            lay.add(project(full, [pid], C, nrm, rt, 0.18, depth=0.2, facing=0.3), 'black', 0.5)
            lay.add(project(fill, [pid], C, nrm, rt, 0.18, depth=0.2, facing=0.3), 'mark', 0.42)
    return lay


def emblem(px):
    """The squadron badge: a ringed planet in a roundel. Returns (black, mark) masks; black is laid first."""
    S = px * 2
    yy, xx = (np.mgrid[0:S, 0:S] + 0.5) / S - 0.5
    rr = np.hypot(xx, yy)
    black = (rr < 0.48).astype(np.float32)
    mark = ((rr < 0.43) & (rr > 0.0)).astype(np.float32)
    planet = rr < 0.19
    # tilted ring: an ellipse band, passing in front of the planet on its lower half
    c, s_ = math.cos(math.radians(-20)), math.sin(math.radians(-20))
    ex, ey = xx * c - yy * s_, xx * s_ + yy * c
    er = np.hypot(ex / 0.34, ey / 0.10)
    ring = (er > 0.86) & (er < 1.0)
    front = ey > 0
    ring_w = (er > 0.84) & (er < 1.0)
    mark = np.where(planet | (ring_w & ~planet), 0.0, mark)       # the planet and the ring are cut out (black)
    gap = (er > 0.72) & (er <= 0.84) & planet & front            # a dark gap between ring and planet
    band = planet & (np.abs(yy + 0.05) < 0.03)                   # one pale equatorial band
    mark = np.where(band & ~gap, 0.6, mark)
    mark = np.where(ring_w & front & planet, 1.0, mark)          # the ring passes in front of the planet
    im = lambda a: np.asarray(Image.fromarray((a * 255).astype(np.uint8)).resize((px, px), Image.LANCZOS), np.float32) / 255
    return im(black), im(mark)


# ------------------------------------------------------------------ masks shared by both liveries
log('noise')
N_big = fbm(0.55, 4, 11)          # large mottling / grime patches
N_mid = fbm(2.4, 4, 23)           # medium breakup
N_fine = fft_noise(RES / 14, 0.55, 5)      # chip breakup, ~5 cm
N_grain = fft_noise(RES / 3.5, 0.5, 6)     # paint grain
rng = np.random.default_rng(3)
_pv = rng.random(200000).astype(np.float32)
pvar = _pv[PID % 200000]                   # per-panel 0..1
pvar2 = _pv[(PID * 7 + 13) % 200000]
log('masks')
paint = VALID & (KIND == 0)
# convex edges only: concave corners are occluded
convex = sstep(0.80, 0.95, AO)
edge = sstep(0.04, 0.30, EDGE * (0.55 + 0.45 * convex)) * convex
# wear zones: edges, fasteners, walkway, panel lines of doors; broken up by noise
wear_zone = np.clip(0.35 + 0.5 * N_big + 0.35 * N_mid, 0, 1)
chip_field = edge * 1.25 + (1 - sstep(0, 0.02, DEEP)) * 0.55 + SCREW * 0.6 + RIV * 0.12
_axw = np.abs(X)
_fchw = (G.wing_le(_axw) - Y) / (G.wing_le(_axw) - G.wing_te(_axw))
lead_edge = (((PART == 6) | (PART == 16)) * (1 - sstep(0.0, 0.05, _fchw)) + ((PART == 8) | (PART == 18)) * sstep(1.12, 1.25, U)
             + (PART == 1) * sstep(6.4, 7.2, Y) + ((PART == 11) | (PART == 20)) * sstep(0.4, 0.62, SPAN) * 0.5)
chip_field = chip_field + 0.55 * lead_edge
chip_field = chip_field * (0.55 + 0.6 * wear_zone) + 0.14 * N_fine + 0.05 * N_grain
metal_chip = paint & (chip_field > 0.92)
primer_chip = paint & (chip_field > 0.74) & ~metal_chip
# scratches: thin random strokes drawn in texture space
sc = Image.new('L', (RES, RES), 0)
ds = ImageDraw.Draw(sc)
srng = np.random.default_rng(9)
for _ in range(3500):
    x0, y0 = srng.random(2) * RES
    ang = srng.random() * math.pi
    ln = srng.gamma(1.6, 9) * RES / 4096
    ds.line([(x0, y0), (x0 + math.cos(ang) * ln, y0 + math.sin(ang) * ln)], fill=int(40 + 90 * srng.random()),
            width=1)
scratch = np.asarray(sc, np.float32) / 255 * paint * np.clip(0.3 + wear_zone, 0, 1)
del sc, ds
# grime: occlusion, panel lines, streaks trailing backward from lines and hatches
cav = 1 - AO
line_prox = 1 - sstep(0.0, 0.05, LINE)
streak_n = fft_noise(RES / 60, 0.45, 12)
grime = np.clip(cav * 1.3 + line_prox * 0.35 + 0.25 * np.clip(N_big, 0, 1) + 0.15 * np.clip(streak_n, 0, 2) * wear_zone, 0, 1)
# exhaust soot and heat: distance to the engine exits
d_c = np.sqrt(X ** 2 + (Z - G.CEN_Z) ** 2 + np.maximum(0, Y - G.CEN_EXIT_Y) ** 2 * 0)
soot = np.zeros((RES, RES), np.float32)
for ex, ey, ez, rr in ((0, G.CEN_EXIT_Y, G.CEN_Z, 0.5), (G.NAC_X, G.NAC_EXIT_Y, G.NAC_Z, 0.6), (-G.NAC_X, G.NAC_EXIT_Y, G.NAC_Z, 0.6)):
    along = np.clip((Y - ey) / 1.4, 0, 1)
    rad = np.sqrt((X - ex) ** 2 + (Z - ez) ** 2)
    soot = np.maximum(soot, np.exp(-along * 3.0) * sstep(rr * 1.6, rr * 0.8, rad) * (Y > ey - 0.05))
# the fuselage tail and the bulkhead around the centre nozzle also blacken
soot = np.maximum(soot, (PART == 1) * sstep(-4.9, -5.55, Y) * 0.8)
soot = np.maximum(soot, ((PART == 9) | (PART == 19)) * sstep(4.25, 4.66, Y) * 0.9)
soot = np.clip(soot * (0.75 + 0.35 * N_mid), 0, 1)
log('shared masks done')


def build(livery):
    L = LIVERIES[livery]
    MARK = srgb2lin(L['mark'])
    # ---------------- base colours (linear)
    alb = np.zeros((RES, RES, 3), np.float32)
    rough = np.full((RES, RES), 0.5, np.float32)
    metal = np.zeros((RES, RES), np.float32)
    white = srgb2lin((0.905, 0.895, 0.862))
    tint = (pvar - 0.5)[..., None] * np.array([0.09, 0.09, 0.085]) + (pvar2 - 0.5)[..., None] * np.array([0.03, 0.005, -0.035])
    grey = (pvar > 0.86)[..., None] * np.array([-0.13, -0.12, -0.10])       # the odd weathered panel
    base = white[None, None] * (1 + tint + grey) * (1 + 0.05 * N_big[..., None] + 0.015 * N_grain[..., None])
    alb[:] = base
    rough[:] = 0.36 + 0.07 * pvar + 0.03 * N_mid
    # dark metal: painted gunmetal
    dk = KIND == 1
    gun = srgb2lin((0.215, 0.225, 0.245))
    alb[dk] = gun * (1 + 0.1 * N_mid[dk, None] + 0.05 * N_grain[dk, None])
    rough[dk] = 0.42 + 0.1 * N_mid[dk]
    metal[dk] = 0.55
    # heat metal: bare titanium / inconel with temper colours near the exits
    ht = KIND == 2
    ti = srgb2lin((0.62, 0.60, 0.57))
    alb[ht] = ti * (1 + 0.06 * N_mid[ht, None])
    rough[ht] = 0.30 + 0.08 * N_mid[ht]
    metal[ht] = 1.0
    # black: duct linings, bores, cockpit tub
    bk = KIND == 3
    alb[bk] = srgb2lin((0.05, 0.05, 0.055))
    rough[bk] = 0.72
    # ---------------- markings in panel coordinates
    mark = np.zeros((RES, RES), np.float32)
    black = np.zeros((RES, RES), np.float32)
    fus = PART == 1
    mark = np.maximum(mark, fus * sstep(5.54, 5.54 + AA, Y) * (1 - sstep(5.86 - AA, 5.86, Y)))
    black = np.maximum(black, fus * sstep(5.43, 5.43 + AA, Y) * (1 - sstep(5.48 - AA, 5.48, Y)))
    # anti-glare panel ahead of the canopy
    lim = (farc(1)(Y) + 0.12) * np.clip((6.25 - Y) / 0.55, 0, 1)
    antiglare = fus * (Y > 3.7) * (1 - sstep(lim - AA, lim, np.abs(V))) * (Z > 0)
    # the cockpit tub under the glass
    cw = np.interp(-Y, -G.CAN[:, 0], G.CAN[:, 1])
    tub = fus * (Y > G.CAN_Y1) * (Y < G.CAN_Y0 - 0.1) * (np.abs(X) < cw - 0.035) * (NZ > 0.2)
    # spine stripe with pinstripes
    sp = (PART == 4) & (KIND == 0) & (Y < 0.7) & (Y > -4.6) & (NZ > 0.6)
    mark = np.maximum(mark, sp * (1 - sstep(0.045 - AA, 0.045, np.abs(X))))
    black = np.maximum(black, sp * sstep(0.055, 0.055 + AA, np.abs(X)) * (1 - sstep(0.07 - AA, 0.07, np.abs(X))))
    # wings: an outboard band with pinstripes, walkway
    wg = (PART == 6) | (PART == 16)
    ax = np.abs(X)
    mark = np.maximum(mark, wg * sstep(4.02, 4.02 + AA, ax) * (1 - sstep(4.36 - AA, 4.36, ax)))
    black = np.maximum(black, wg * (sstep(3.95, 3.95 + AA, ax) * (1 - sstep(3.975 - AA, 3.975, ax))))
    fch = (G.wing_le(ax) - Y) / (G.wing_le(ax) - G.wing_te(ax))
    walk = wg * (NZ > 0.5) * (sd_rrect(ax - 1.85, (fch - 0.38) * (G.wing_le(ax) - G.wing_te(ax)), 0.45,
                                        0.22 * (G.wing_le(ax) - G.wing_te(ax)), 0.03) < -0.02)
    cch = G.wing_le(ax) - G.wing_te(ax)
    wsd = sd_rrect(ax - 1.85, (fch - 0.38) * cch, 0.45, 0.22 * cch, 0.03)
    walk_edge = wg * (NZ > 0.5) * (1 - sstep(0.010, 0.010 + AA, np.abs(wsd)))
    black = np.maximum(black, walk_edge)
    # nacelles: intake lip, hazard band, aft band
    nac = ((PART == 8) | (PART == 18)) & (KIND == 0)
    mark = np.maximum(mark, nac * sstep(1.17, 1.19, U))
    hz = nac * sstep(0.76, 0.76 + AA, U) * (1 - sstep(0.96 - AA, 0.96, U))
    stripes = ((U * 1.0 + V) / 0.16) % 1.0 < 0.5
    mark = np.maximum(mark, hz * stripes)
    black = np.maximum(black, hz * ~stripes)
    mark = np.maximum(mark, nac * sstep(-3.46, -3.46 + AA, U) * (1 - sstep(-3.22 - AA, -3.22, U)))
    black = np.maximum(black, nac * (sstep(-3.52, -3.52 + AA, U) * (1 - sstep(-3.495 - AA, -3.495, U))))
    # fin tips, scoop lips
    fin = (PART == 11) | (PART == 20)
    mark = np.maximum(mark, fin * sstep(0.52, 0.53, SPAN))
    black = np.maximum(black, fin * sstep(0.495, 0.5, SPAN) * (1 - sstep(0.515, 0.52, SPAN)))
    scp = ((PART == 5) | (PART == 15)) & (KIND == 0)
    mark = np.maximum(mark, scp * sstep(2.93, 2.96, U))
    # helmet stripe
    helm = (PART == 3) & (KIND == 0)
    mark = np.maximum(mark, helm * (np.abs(X) < 0.03))
    # ---------------- stencils
    lay = livery_layers(L)
    mark *= paint
    black *= paint
    antiglare *= paint
    # ---------------- compose paint
    col = alb
    pm = paint[..., None]
    col = np.where(pm, col, col)
    col = col * (1 - mark[..., None]) + MARK[None, None] * (1 + 0.04 * N_big[..., None]) * mark[..., None]
    col = col * (1 - black[..., None]) + srgb2lin((0.07, 0.07, 0.075))[None, None] * black[..., None]
    col = col * (1 - antiglare[..., None]) + srgb2lin((0.20, 0.21, 0.22))[None, None] * antiglare[..., None]
    col = np.where(tub[..., None] & paint[..., None], srgb2lin((0.12, 0.125, 0.13))[None, None], col)
    rough = np.where(paint, rough * (1 - mark) + 0.40 * mark, rough)
    rough = np.where(paint, rough * (1 - black) + 0.52 * black, rough)
    rough = np.where(paint, rough * (1 - antiglare) + 0.78 * antiglare, rough)
    rough = np.where(paint & walk.astype(bool), 0.85, rough)
    col = np.where((paint & walk.astype(bool))[..., None], srgb2lin((0.40, 0.41, 0.42))[None, None] *
                   (1 + 0.18 * N_grain[..., None]), col)
    # stencils, in the order they were laid (outline first, fill on top)
    CK = {'mark': MARK, 'black': srgb2lin((0.07, 0.07, 0.075)), 'white': srgb2lin((0.9, 0.9, 0.88))}
    for msk, ck, rg in lay.items:
        msk = msk * paint
        col = col * (1 - msk[..., None]) + CK[ck][None, None] * msk[..., None]
        rough = rough * (1 - msk) + rg * msk
    rough = np.where(tub & paint, 0.75, rough)
    # canopy frame: dark grey gasket paint
    cf = (PART == 2) & paint
    col = np.where(cf[..., None], srgb2lin((0.13, 0.135, 0.14))[None, None], col)
    rough = np.where(cf, 0.5, rough)
    # visor: gold film
    vis = (PART == 3) & (KIND == 1) & (Y > 1.52) & (Z > G.fuse_top(0, 1.5) + 0.2)
    col = np.where(vis[..., None], np.array([0.92, 0.66, 0.30], np.float32)[None, None], col)
    rough = np.where(vis, 0.12, rough)
    metal = np.where(vis, 1.0, metal)
    # ---------------- wear
    primer = srgb2lin((0.42, 0.45, 0.43))
    bare = np.array([0.70, 0.70, 0.72], np.float32)
    col = np.where(primer_chip[..., None], primer[None, None] * (1 + 0.08 * N_grain[..., None]), col)
    rough = np.where(primer_chip, 0.62, rough)
    col = np.where(metal_chip[..., None], bare[None, None], col)
    rough = np.where(metal_chip, 0.34 + 0.1 * N_mid, rough)
    metal = np.where(metal_chip, 1.0, metal)
    # dark metal wears to bright steel on its edges
    dchip = (KIND == 1) & (edge * (0.6 + 0.5 * wear_zone) + 0.1 * N_fine > 0.62)
    col = np.where(dchip[..., None], np.array([0.55, 0.56, 0.58], np.float32)[None, None], col)
    metal = np.where(dchip, 1.0, metal)
    rough = np.where(dchip, 0.32, rough)
    # scratches
    col = col * (1 - 0.12 * scratch[..., None]) + primer[None, None] * 0.12 * scratch[..., None]
    rough = rough + 0.18 * scratch
    # heat tint on bare metal: straw -> bronze -> blue -> dark, by distance from the throat
    for (ty, ex, ez) in ((G.CEN_THROAT_Y, 0, G.CEN_Z), (G.NAC_THROAT_Y, G.NAC_X, G.NAC_Z), (G.NAC_THROAT_Y, -G.NAC_X, G.NAC_Z)):
        near = ht & (np.abs(X - ex) < 0.9) & (np.abs(Z - ez) < 0.9)
        t = np.clip((ty - Y) / 0.85 + 0.15 * N_mid, 0, 1)     # 0 at the throat, 1 at the exit and beyond
        inner = np.sqrt((X - ex) ** 2 + (Z - ez) ** 2) < 0.52
        c0 = np.array([0.20, 0.12, 0.25], np.float32)      # purple-blue deep in the bell
        c1 = np.array([0.55, 0.38, 0.18], np.float32)      # bronze
        c2 = np.array([0.66, 0.60, 0.46], np.float32)      # straw
        tt = np.where(inner, t, 1 - t)
        tint_c = np.where((tt < 0.5)[..., None], c0 + (c1 - c0) * (tt / 0.5)[..., None], c1 + (c2 - c1) * ((tt - 0.5) / 0.5)[..., None])
        col = np.where(near[..., None], col * 0.35 + tint_c * 0.65, col)
    # ---------------- grime, soot, AO
    dirt = srgb2lin((0.33, 0.30, 0.26))
    g = (grime * (0.55 + 0.45 * wear_zone))[..., None]
    col = col * (1 - 0.22 * g) + dirt[None, None] * 0.22 * g * (col.mean(2, keepdims=True) > 0.2)
    rough = rough + 0.12 * grime
    st = (STREAK * paint * (0.45 + 0.55 * wear_zone))[..., None]
    col = col * (1 - 0.16 * st) + dirt[None, None] * 0.16 * st
    s = soot[..., None]
    col = col * (1 - 0.85 * s) + np.array([0.018, 0.016, 0.014], np.float32)[None, None] * 0.85 * s
    rough = rough * (1 - soot) + 0.72 * soot
    col = col * (0.72 + 0.28 * AO[..., None])
    # panel lines darken, rivets catch a little
    pl = (1 - sstep(0, 0.0075, LINE)) * paint
    dl = (1 - sstep(0, 0.010, DEEP)) * paint
    col = col * (1 - 0.45 * pl[..., None]) * (1 - 0.7 * dl[..., None])
    rough = rough + 0.15 * pl
    return col, np.clip(rough, 0.04, 1), np.clip(metal, 0, 1)


def height_map():
    h = np.zeros((RES, RES), np.float32)
    pnt = VALID & (KIND == 0)
    h -= 0.0009 * (1 - sstep(0, 0.0065, LINE)) * pnt
    h -= 0.0022 * (1 - sstep(0, 0.008, DEEP)) * pnt
    h += 0.00045 * RIV * pnt
    h += 0.0007 * SCREW
    h -= 0.00016 * metal_chip - 0.0 * primer_chip
    h -= 0.00008 * primer_chip
    # sheet-metal pillowing, different in every panel
    h += 0.00025 * (N_mid * (0.5 + pvar)) * pnt
    h -= 0.00006 * scratch
    # gun shroud perforations
    for pid in (9, 19):
        gx = G.GUN_X if pid == 9 else -G.GUN_X
        m = VALID & (PART == pid) & (Y > 1.85) & (Y < 3.0) & (np.sqrt((X - gx) ** 2 + (Z - G.GUN_Z) ** 2) > 0.095)
        ang = np.arctan2(Z[m] - G.GUN_Z, X[m] - gx)
        a = (ang / (2 * np.pi / 14)) % 1.0 - 0.5
        yy = ((Y[m] - 1.85) / 0.075) % 1.0 - 0.5
        rr = np.sqrt((a * 0.104 * 2 * np.pi / 14) ** 2 + (yy * 0.075) ** 2)
        h[m] -= 0.003 * (rr < 0.014)
    return h


if __name__ == '__main__':
    hm = height_map()
    np.save(f'{B}/tex_height.npy', hm)
    log('height saved', float(hm.min()), float(hm.max()))
    orm_done = False
    for lv in LIVERIES:
        col, rough, metal = build(lv)
        Image.fromarray((lin2srgb(col) * 255 + 0.5).astype(np.uint8)).save(f'{B}/tex_albedo_{lv}.png')
        if not orm_done:
            orm = np.stack([AO, rough, metal], 2)
            Image.fromarray((orm * 255 + 0.5).astype(np.uint8)).save(f'{B}/tex_orm.png')
            orm_done = True
        log('wrote', lv)
