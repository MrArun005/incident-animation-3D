# The Jupiter Class IV as hard-surface geometry: a narrow chined fuselage with a bubble canopy, two engine
# wings (an upper wing and a lower strut) ending in engine nacelles, a gun on each nacelle and three engines.
# Blender axes: +X right, +Y forward, +Z up; metres. build() returns {'hull': [...], 'glass': obj, 'glow': {...}}
# and writes the gameplay anchors (engine exits, muzzles, collision spheres) that the game reads.
import math
import numpy as np
from scipy.interpolate import PchipInterpolator
from lib import Part, rounded_chain, arclen, grid_faces, fan, lathe, sweep, rrect, rbox, solid, slab, unit, KIND

# ------------------------------------------------------------------ fuselage stations
#                 y      a      zc     ht     tw     hb     bw
FUSE = np.array([
    [7.30, 0.030, 0.000, 0.030, 0.010, 0.030, 0.010],
    [7.05, 0.150, 0.000, 0.100, 0.040, 0.090, 0.040],
    [6.55, 0.370, 0.010, 0.240, 0.090, 0.200, 0.110],
    [5.80, 0.620, 0.030, 0.400, 0.160, 0.320, 0.200],
    [4.80, 0.860, 0.050, 0.540, 0.230, 0.420, 0.300],
    [3.70, 1.050, 0.070, 0.640, 0.290, 0.500, 0.400],
    [2.50, 1.200, 0.090, 0.700, 0.340, 0.560, 0.480],
    [1.10, 1.300, 0.100, 0.720, 0.370, 0.600, 0.540],
    [-0.40, 1.350, 0.100, 0.710, 0.390, 0.620, 0.570],
    [-1.90, 1.360, 0.090, 0.680, 0.400, 0.620, 0.580],
    [-3.30, 1.320, 0.070, 0.640, 0.400, 0.590, 0.560],
    [-4.40, 1.200, 0.050, 0.600, 0.380, 0.560, 0.510],
    [-5.10, 1.040, 0.040, 0.580, 0.360, 0.540, 0.460],
    [-5.55, 0.920, 0.030, 0.570, 0.340, 0.530, 0.420],
])
Y_NOSE, Y_TAIL = 7.30, -5.55
_fi = [PchipInterpolator(-FUSE[:, 0], FUSE[:, k]) for k in range(1, 7)]
SEC_K = [1, 6, 4, 5, 4, 5, 1]           # arc points per section vertex
SEC_E = [2, 3, 2, 1, 3, 2]              # extra points per section edge
IC = 1 + SEC_E[0] + SEC_K[1] + SEC_E[1] + SEC_K[2] + SEC_E[2] + SEC_K[3] // 2   # chine index in the half


def fuse_params(y):
    return [float(f(-y)) for f in _fi]


def fuse_half(y):
    """Right half of the section at y, from the top centre line to the bottom centre line, as (x, z)."""
    a, zc, ht, tw, hb, bw = fuse_params(y)
    P = [(0, ht), (tw, ht), (0.86 * a, 0.46 * ht), (a, 0), (0.9 * a, -0.42 * hb), (bw, -hb), (0, -hb)]
    R = [0, 0.30 * ht, 0.20 * a, 0.02 * a + 0.006, 0.12 * a, 0.24 * hb, 0]
    H = rounded_chain(P, R, SEC_K, SEC_E)
    H[:, 1] += zc
    return H


def fuse_top(x, y):
    H = fuse_half(y)
    return float(np.interp(abs(x), H[:IC + 1, 0], H[:IC + 1, 1]))


def fuse_bot(x, y):
    H = fuse_half(y)[IC:][::-1]
    return float(np.interp(abs(x), H[:, 0], H[:, 1]))


def fuse_side(z, y):
    """Half-width of the hull at height z (outermost x), for parts that sit on the flank."""
    H = fuse_half(y)
    zs, xs = H[:, 1], H[:, 0]
    best = 0.0
    for i in range(len(H) - 1):
        z0, z1 = zs[i], zs[i + 1]
        if (z0 - z) * (z1 - z) <= 0 and z0 != z1:
            best = max(best, xs[i] + (xs[i + 1] - xs[i]) * (z - z0) / (z1 - z0))
    return best


def fuselage():
    p = Part('fuselage', 1)
    ys = np.concatenate([Y_NOSE - (Y_NOSE - 5.9) * np.linspace(0, 1, 14) ** 1.6,
                         np.linspace(5.9, Y_TAIL, 41)[1:]])
    rings, pps = [], []
    for y in ys:
        H = fuse_half(y)
        s = arclen(H)
        ring = np.concatenate([H[::-1], H[1:-1] * [-1, 1]])
        v = np.concatenate([s[::-1], -s[1:-1]])
        rings.append(np.stack([ring[:, 0], np.full(len(ring), y), ring[:, 1]], 1))
        pps.append(np.stack([np.full(len(ring), y), v], 1))
    R = np.stack(rings)
    m, n, _ = R.shape
    V = R.reshape(-1, 3)
    PP = np.concatenate(pps)
    F = grid_faces(m, n, True)
    K = ['paint'] * len(F)
    a, zc, ht, tw, hb, bw = fuse_params(Y_NOSE)
    V = np.concatenate([V, [[0, Y_NOSE + 0.08, zc]]])
    PP = np.concatenate([PP, [[Y_NOSE + 0.08, 0]]])
    F += fan(len(V) - 1, list(range(n)), V, [0, 1, 0])
    K += ['paint'] * n
    a, zc, ht, tw, hb, bw = fuse_params(Y_TAIL)
    V = np.concatenate([V, [[0, Y_TAIL, zc + (ht - hb) / 2]]])
    PP = np.concatenate([PP, [[Y_TAIL, 0]]])
    F += fan(len(V) - 1, list(range((m - 1) * n, m * n)), V, [0, -1, 0])
    K += ['dark'] * n
    p.add(V, F, pp=PP, kinds=K)
    return p


# ------------------------------------------------------------------ canopy
CAN = np.array([  # y, base half-width, height above the fuselage top centre
    [3.95, 0.06, 0.000],
    [3.62, 0.25, 0.170],
    [3.15, 0.39, 0.340],
    [2.55, 0.47, 0.470],
    [1.95, 0.50, 0.525],
    [1.35, 0.48, 0.480],
    [0.98, 0.43, 0.370],
    [0.76, 0.38, 0.270],
])
_ci = [PchipInterpolator(-CAN[:, 0], CAN[:, k]) for k in (1, 2)]
CAN_Q = 2.3
CAN_Y0, CAN_Y1 = 3.95, 0.76


def canopy_section(y, n=25, off=0.0):
    w, h = float(_ci[0](-y)), float(_ci[1](-y))
    zc = fuse_top(0, y) + h
    ze = fuse_top(w, y) - 0.012
    phi = np.linspace(0, np.pi, n)
    c, s = np.cos(phi), np.sin(phi)
    x = w * np.sign(c) * np.abs(c) ** (2 / CAN_Q)
    z = ze + (zc - ze) * np.abs(s) ** (2 / CAN_Q)
    P = np.stack([x, np.full(n, y), z], 1)
    if off:
        # outward offset along the section's 2D normal (the section runs right -> left over the top)
        t = np.gradient(P[:, [0, 2]], axis=0)
        nrm = unit(np.stack([t[:, 1], -t[:, 0]], 1))
        P[:, 0] += nrm[:, 0] * off
        P[:, 2] += nrm[:, 1] * off
    return P


def canopy():
    ys = np.linspace(CAN_Y0, CAN_Y1, 26)
    R = np.stack([canopy_section(y) for y in ys])
    m, n, _ = R.shape
    V = R.reshape(-1, 3)
    g = Part('Glass', 90)
    g.add(V, grid_faces(m, n, closed=False), kind='glass', pp=np.stack([V[:, 1], V[:, 0]], 1))
    return g


def canopy_frame():
    p = Part('canopy_frame', 2)
    # base rails along both sides
    ys = np.linspace(CAN_Y0 - 0.04, CAN_Y1, 30)
    for sgn in (1, -1):
        path = []
        for y in ys:
            w = float(_ci[0](-y))
            path.append((sgn * (w + 0.004), y, fuse_top(w, y) - 0.004))
        path = np.array(path)
        ups = np.tile([sgn * 0.35, 0, 1.0], (len(path), 1))
        prof = rrect(0.034, 0.018, 0.012, 3) + [0, 0.010]
        V, F, PP = sweep(path, ups, prof)
        V, F = solid(V, F)
        p.add(V, F, pp=np.stack([V[:, 1], V[:, 2]], 1))
    # bows: windscreen frame, a mid bow and the rear hoop
    for y, hw in ((3.18, 0.030), (1.60, 0.026), (CAN_Y1 + 0.03, 0.034)):
        sec = canopy_section(y, 33, off=0.002)
        c = sec[len(sec) // 2]
        ups = unit(sec - [0, y, c[2] - 0.6])
        ups[:, 1] = 0
        prof = rrect(hw, 0.011, 0.008, 3) + [0, 0.009]
        V, F, PP = sweep(sec, ups, prof)
        V, F = solid(V, F)
        p.add(V, F, pp=np.stack([V[:, 1], V[:, 0]], 1))
    # rear bulkhead closing the glass
    sec = canopy_section(CAN_Y1 + 0.005, 25)
    ctr = np.array([0, CAN_Y1 + 0.005, sec[:, 2].min() + 0.35 * (sec[:, 2].max() - sec[:, 2].min())])
    V = np.concatenate([sec, [ctr]])
    ring = list(range(len(sec)))
    F = fan(len(V) - 1, ring, V, [0, -1, 0])
    p.add(V, F, pp=np.stack([V[:, 0], V[:, 2]], 1))
    return p


def cockpit():
    """What shows through the glass: coaming, seat and a pilot. The hull under the canopy is painted as the
    cockpit tub by the texture stage, so everything here sits low, head and shoulders under the bubble."""
    p = Part('cockpit', 3)
    t = lambda y: fuse_top(0, y)
    for c, s, r, k in (((0, 2.90, t(2.90) + 0.05), (0.66, 0.26, 0.14), 0.05, 'black'),     # coaming
                       ((0, 1.22, t(1.22) + 0.13), (0.46, 0.12, 0.34), 0.05, 'dark'),     # seat back
                       ((0, 1.24, t(1.24) + 0.34), (0.26, 0.14, 0.13), 0.05, 'dark'),     # headrest
                       ((0, 1.46, t(1.46) + 0.07), (0.42, 0.28, 0.18), 0.08, 'black'),    # shoulders
                       ((0, 2.35, t(2.35) + 0.035), (0.34, 0.50, 0.07), 0.03, 'black'),   # stick box
                       ((0, 2.55, t(2.55) + 0.12), (0.03, 0.03, 0.16), 0.01, 'dark')):    # stick
        V, F, PP = rbox(c, s, r)
        p.add(V, F, kind=k, pp=PP)
    # helmet and visor
    cy, cz = 1.50, t(1.50) + 0.27
    prof = [(cy + 0.125 * math.cos(a), 0.125 * math.sin(a)) for a in np.linspace(0, np.pi, 11)]
    prof[0] = (cy + 0.125, 0.0)
    prof[-1] = (cy - 0.125, 0.0)
    V, F, PP, row = lathe(prof, 18, center=(0, cz))
    p.add(V, F, kind='paint', pp=PP)
    prof = [(cy + 0.131 * math.cos(a), 0.131 * math.sin(a)) for a in np.linspace(0.05, 1.0, 6)]
    V, F, PP, row = lathe(prof, 18, center=(0, cz + 0.015))
    p.add(V, F, kind='dark', pp=PP)
    return p


# ------------------------------------------------------------------ spine and its details
SPINE = np.array([  # y, half-width, height above the fuselage top centre
    [0.80, 0.25, 0.235],
    [0.20, 0.26, 0.240],
    [-1.50, 0.26, 0.230],
    [-3.20, 0.24, 0.200],
    [-4.50, 0.21, 0.150],
    [-5.15, 0.19, 0.090],
    [-5.42, 0.17, 0.030],
])
_si = [PchipInterpolator(-SPINE[:, 0], SPINE[:, k]) for k in (1, 2)]


def spine_top(y):
    return fuse_top(0, y) + float(_si[1](-y))


def spine():
    p = Part('spine', 4)
    ys = np.linspace(SPINE[0, 0], SPINE[-1, 0], 34)
    rings = []
    for y in ys:
        hw, h = float(_si[0](-y)), float(_si[1](-y))
        base = fuse_top(0, y) - 0.06
        hh = (h + 0.06) / 2
        rr = rrect(hw, hh, min(0.075, hh * 0.9), 5)
        rings.append(np.stack([rr[:, 0], np.full(len(rr), y), base + hh + rr[:, 1]], 1))
    R = np.stack(rings)
    m, n, _ = R.shape
    V = R.reshape(-1, 3)
    F = grid_faces(m, n, True)
    V = np.concatenate([V, [R[0].mean(0), R[-1].mean(0)]])
    F += fan(len(V) - 2, list(range(n)), V, [0, 1, 0])
    F += fan(len(V) - 1, list(range((m - 1) * n, m * n)), V, [0, -1, 0])
    p.add(V, F, pp=np.stack([V[:, 1], V[:, 0]], 1))
    # two vent housings with louvres
    for y0, y1 in ((-1.50, -2.30), (-2.95, -3.55)):
        yc = (y0 + y1) / 2
        zt = spine_top(yc)
        V, F, PP = rbox((0, yc, zt - 0.005), (0.36, abs(y1 - y0), 0.05), 0.015)
        p.add(V, F, kind='dark', pp=PP)
        for y in np.arange(y0 - 0.06, y1 + 0.03, -0.085):
            V, F, PP = rbox((0, y, spine_top(y) + 0.028), (0.38, 0.034, 0.024), 0.006, 2)
            p.add(V, F, kind='dark', pp=PP)
    # blade antenna
    zr = spine_top(-0.6)
    top = np.array([[[0.006, -0.42, zr - 0.01], [0.006, -0.78, zr - 0.01]],
                    [[0.004, -0.70, zr + 0.25], [0.004, -0.84, zr + 0.25]]])
    V, F = slab(top, np.tile([1.0, 0, 0], (2, 2, 1)), 0.012)
    p.add(V, F, kind='dark')
    return p


# ------------------------------------------------------------------ side scoops (cooling intakes)
def scoop():
    """Right-hand scoop under the chine beside the cockpit; mouth faces forward."""
    p = Part('scoop', 5)
    Y = [3.05, 2.75, 2.25, 1.70, 1.15]
    OUT = [0.10, 0.095, 0.075, 0.035, -0.04]
    TOP = [-0.02, -0.02, -0.035, -0.06, -0.10]
    BOT = [-0.40, -0.40, -0.38, -0.33, -0.24]
    rings = []
    for y, o, tz, bz in zip(Y, OUT, TOP, BOT):
        a, zc, ht, tw, hb, bw = fuse_params(y)
        zt, zb = zc + tz, zc + bz
        xin = fuse_side(zb, y) - 0.10
        xout = a + o
        hw, hh = (xout - xin) / 2, (zt - zb) / 2
        rr = rrect(hw, hh, min(0.05, hh * 0.8), 5)
        rings.append(np.stack([xin + hw + rr[:, 0], np.full(len(rr), y), zb + hh + rr[:, 1]], 1))
    R = np.stack(rings)
    m, n, _ = R.shape
    V = R.reshape(-1, 3)
    F = grid_faces(m, n, True)
    K = ['paint'] * len(F)
    # mouth: lip face from the outer ring to an inset ring, then a short dark duct and a back wall
    ctr = R[0].mean(0)
    inset = ctr + (R[0] - ctr) * np.array([0.80, 1, 0.78])
    inset[:, 1] = Y[0]
    deep = inset.copy()
    deep[:, 1] = Y[0] - 0.34
    base = len(V)
    V = np.concatenate([V, inset, deep, [deep.mean(0)]])
    for j in range(n):
        j1 = (j + 1) % n
        F.append([j1, j, base + j, base + j1])            # lip (faces forward)
        K.append('paint')
        F.append([base + j1, base + j, base + n + j, base + n + j1])   # duct wall (faces inward)
        K.append('black')
    F += fan(len(V) - 1, list(range(base + n, base + 2 * n)), V, [0, 1, 0])
    K += ['black'] * n
    V2 = np.concatenate([V, [R[-1].mean(0)]])
    F += fan(len(V2) - 1, list(range((m - 1) * n, m * n)), V2, [0, -1, 0])
    K += ['paint'] * n
    p.add(V2, F, pp=np.stack([V2[:, 1], V2[:, 2]], 1), kinds=K)
    return p


# ------------------------------------------------------------------ wings
NAC_X, NAC_Z = 5.30, 0.05
W_ROOT, W_TIP = 1.15, 4.78
AERO = [(0.0, 0.0), (0.16, 0.042), (0.64, 0.042), (1.0, 0.0045), (1.0, -0.0045), (0.66, -0.028), (0.20, -0.028)]
AERO_R = [0.013, 0.20, 0.25, 0.0025, 0.0025, 0.20, 0.15]
AERO_K = [7, 4, 4, 2, 2, 4, 4]
AERO_E = [2, 5, 3, 0, 3, 5, 2]


def wing_le(x):
    return 1.00 - (x - W_ROOT) * (0.80 / (W_TIP - W_ROOT))


def wing_te(x):
    return -3.90 + (x - W_ROOT) * (0.50 / (W_TIP - W_ROOT))


def wing():
    p = Part('wing', 6)
    sec = rounded_chain(AERO, AERO_R, AERO_K, AERO_E, closed=True)
    xs = np.array([W_ROOT, 1.45, 1.9, 2.4, 2.9, 3.4, 3.9, 4.35, W_TIP])
    rings = []
    for x in xs:
        le, c = wing_le(x), wing_le(x) - wing_te(x)
        rings.append(np.stack([np.full(len(sec), x), le - sec[:, 0] * c, NAC_Z + sec[:, 1] * c], 1))
    R = np.stack(rings)
    m, n, _ = R.shape
    V = R.reshape(-1, 3)
    F = grid_faces(m, n, True)
    V = np.concatenate([V, [R[0].mean(0), R[-1].mean(0)]])
    F += fan(len(V) - 2, list(range(n)), V, [-1, 0, 0])
    F += fan(len(V) - 1, list(range((m - 1) * n, m * n)), V, [1, 0, 0])
    V, F = solid(V, F)
    p.add(V, F, pp=np.stack([V[:, 0], V[:, 1]], 1))
    # wing fence
    x = 3.25
    le = wing_le(x)
    zt = NAC_Z + 0.042 * (le - wing_te(x)) - 0.01
    top = np.array([[[x + 0.008, le - 0.10, zt], [x + 0.008, le - 1.70, zt]],
                    [[x + 0.006, le - 0.28, zt + 0.10], [x + 0.006, le - 1.40, zt + 0.07]]])
    V, F = slab(top, np.tile([1.0, 0, 0], (2, 2, 1)), 0.016)
    p.add(V, F, kind='paint', pp=np.stack([V[:, 1], V[:, 2]], 1))
    return p


def strut():
    p = Part('strut', 7)
    xs = np.linspace(0.70, 4.95, 6)
    rings = []
    for x in xs:
        z = -0.36 - (x - 0.70) / 4.25 * 0.05
        rr = rrect(0.76, 0.062, 0.058, 6)
        rings.append(np.stack([np.full(len(rr), x), -3.05 + rr[:, 0], z + rr[:, 1]], 1))
    R = np.stack(rings)
    m, n, _ = R.shape
    V = R.reshape(-1, 3)
    F = grid_faces(m, n, True)
    V = np.concatenate([V, [R[0].mean(0), R[-1].mean(0)]])
    F += fan(len(V) - 2, list(range(n)), V, [-1, 0, 0])
    F += fan(len(V) - 1, list(range((m - 1) * n, m * n)), V, [1, 0, 0])
    V, F = solid(V, F)
    p.add(V, F, pp=np.stack([V[:, 0], V[:, 1]], 1))
    return p


# ------------------------------------------------------------------ nacelles
NAC_PROF = [  # y, r, kind of the segment that starts here
    (0.50, 0.455, 'dark'), (0.90, 0.462, 'dark'), (1.18, 0.472, 'dark'),
    (1.27, 0.490, 'paint'), (1.33, 0.520, 'paint'), (1.355, 0.556, 'paint'), (1.33, 0.592, 'paint'),
    (1.27, 0.626, 'paint'), (1.15, 0.662, 'paint'), (0.95, 0.700, 'paint'), (0.65, 0.733, 'paint'),
    (0.25, 0.757, 'paint'), (-0.30, 0.769, 'paint'), (-1.00, 0.772, 'paint'), (-2.00, 0.772, 'paint'),
    (-2.90, 0.768, 'paint'), (-3.45, 0.752, 'paint'), (-3.90, 0.725, 'paint'), (-4.02, 0.715, 'paint'),
    (-4.04, 0.690, 'heat'), (-4.10, 0.685, 'heat'), (-4.50, 0.660, 'heat'), (-4.82, 0.628, 'heat'),
    (-4.875, 0.612, 'heat'), (-4.895, 0.592, 'heat'), (-4.875, 0.572, 'heat'), (-4.70, 0.548, 'heat'),
    (-4.45, 0.495, 'heat'), (-4.28, 0.430, 'heat'), (-4.20, 0.395, 'heat'),
]
NAC_EXIT_Y, NAC_THROAT_Y, NAC_THROAT_R = -4.895, -4.20, 0.395


def nozzle_petals(p, cx, cz, prof_y, prof_r, count, gap_deg, lift, kind='heat'):
    ys = np.linspace(prof_y[0], prof_y[-1], 6)
    rs = np.interp(-ys, -np.asarray(prof_y), np.asarray(prof_r))
    step = 2 * np.pi / count
    for i in range(count):
        a0 = i * step + math.radians(gap_deg) / 2
        angs = np.linspace(a0, a0 + step - math.radians(gap_deg), 4)
        top = np.stack([np.stack([cx + (r + lift) * np.cos(angs), np.full(4, y), cz + (r + lift) * np.sin(angs)], 1)
                        for y, r in zip(ys, rs)])
        nrm = np.stack([np.stack([np.cos(angs), np.zeros(4), np.sin(angs)], 1) for _ in ys])
        V, F = slab(top, nrm, lift + 0.004)
        p.add(V, F, kind=kind, pp=np.stack([V[:, 1], np.arctan2(V[:, 2] - cz, V[:, 0] - cx) * 0.7], 1))


def fan_blades(p, cx, cy, cz, n=18, r0=0.13, r1=0.445):
    for i in range(n):
        ph = 2 * np.pi * i / n
        er = np.array([math.cos(ph), 0, math.sin(ph)])
        et = np.array([-math.sin(ph), 0, math.cos(ph)])
        ey = np.array([0, 1.0, 0])
        rs = np.linspace(r0, r1, 5)
        top, nrm = [], []
        for r in rs:
            beta = math.radians(52 - 24 * (r - r0) / (r1 - r0))
            chord = math.cos(beta) * et + math.sin(beta) * ey
            normal = -math.sin(beta) * et + math.cos(beta) * ey
            c = np.array([cx, cy, cz]) + r * er
            row = [c + chord * s for s in (-0.07, -0.02, 0.03, 0.07)]
            top.append(row)
            nrm.append([normal] * 4)
        V, F = slab(np.array(top), np.array(nrm), 0.009)
        p.add(V, F, kind='dark', pp=np.stack([V[:, 1], V[:, 0]], 1))


def nacelle():
    """Right nacelle, axis along Y through (NAC_X, NAC_Z)."""
    p = Part('nacelle', 8)
    cx, cz = NAC_X, NAC_Z
    prof = [(y, r) for y, r, k in NAC_PROF]
    V, F, PP, row = lathe(prof, 56, center=(cx, cz), rref=0.77)
    kinds = [NAC_PROF[i][2] for i in row]
    p.add(V, F, pp=PP, kinds=kinds)
    # raised bands
    for y0, y1 in ((-0.62, -0.74), (-3.05, -3.14)):
        r0 = float(np.interp(-y0, [-y for y, r, k in NAC_PROF[::-1]], [r for y, r, k in NAC_PROF[::-1]]))
        V, F, PP, row = lathe([(y0 + 0.01, r0 - 0.01), (y0, r0 + 0.013), (y1, r0 + 0.013), (y1 - 0.01, r0 - 0.01)],
                              56, center=(cx, cz), rref=0.77)
        p.add(V, F, kind='dark', pp=PP)
    # nozzle petals on the shroud
    ys = [y for y, r, k in NAC_PROF if -4.83 <= y <= -4.10]
    rs = [r for y, r, k in NAC_PROF if -4.83 <= y <= -4.10]
    nozzle_petals(p, cx, cz, ys, rs, 16, 1.6, 0.010)
    # fan: back wall, spinner, blades
    V = np.array([[cx, 0.49, cz]] + [[cx + 0.46 * math.cos(t), 0.49, cz + 0.46 * math.sin(t)]
                                     for t in np.linspace(0, 2 * np.pi, 40, endpoint=False)])
    p.add(V, fan(0, list(range(1, 41)), V, [0, 1, 0]), kind='black')
    V, F, PP, row = lathe([(0.90, 0.0), (0.86, 0.045), (0.78, 0.095), (0.68, 0.128), (0.58, 0.145), (0.50, 0.15)],
                          28, center=(cx, cz))
    p.add(V, F, kind='dark', pp=PP)
    fan_blades(p, cx, 0.62, cz)
    # exhaust plug
    V, F, PP, row = lathe([(-4.18, 0.21), (-4.30, 0.205), (-4.50, 0.16), (-4.68, 0.085), (-4.76, 0.0)],
                          32, center=(cx, cz))
    p.add(V, F, kind='heat', pp=PP)
    # dorsal equipment fairing along the top of the nacelle
    ys = np.linspace(0.55, -3.10, 16)
    rings = []
    for y in ys:
        k = min(1.0, (0.55 - y) / 0.5, (y + 3.10) / 0.6)
        k = max(0.0, k) ** 0.6
        hw, h = 0.19, 0.012 + 0.075 * k
        rr = rrect(hw * (0.6 + 0.4 * k), (h + 0.05) / 2, min(0.05, (h + 0.05) * 0.45), 5)
        rings.append(np.stack([cx + rr[:, 0], np.full(len(rr), y), cz + 0.77 - 0.05 + (h + 0.05) / 2 + rr[:, 1]], 1))
    R = np.stack(rings)
    m, n, _ = R.shape
    V = R.reshape(-1, 3)
    F = grid_faces(m, n, True)
    V = np.concatenate([V, [R[0].mean(0), R[-1].mean(0)]])
    F += fan(len(V) - 2, list(range(n)), V, [0, 1, 0])
    F += fan(len(V) - 1, list(range((m - 1) * n, m * n)), V, [0, -1, 0])
    p.add(V, F, pp=np.stack([V[:, 1], V[:, 0] - cx], 1))
    # RCS block and nav-light housing on the outboard flank
    V, F, PP = rbox((cx + 0.78, -2.25, cz - 0.02), (0.10, 0.34, 0.22), 0.03)
    p.add(V, F, kind='dark', pp=PP)
    V, F, PP = rbox((cx + 0.775, -1.30, cz + 0.02), (0.06, 0.16, 0.10), 0.02)
    p.add(V, F, kind='dark', pp=PP)
    return p


# ------------------------------------------------------------------ guns
GUN_X, GUN_Z = 6.02, 0.42
GUN_MUZZLE_Y = 4.66


def gun():
    p = Part('gun', 9)
    cx, cz = GUN_X, GUN_Z
    # receiver: a rounded box lofted along Y, tapered at both ends, sunk into the nacelle
    rings = []
    for y, s in ((1.80, 0.70), (1.60, 1.0), (-0.70, 1.0), (-0.92, 0.62)):
        rr = rrect(0.12 * s, 0.125 * s, 0.035 * s, 4)
        rings.append(np.stack([cx + rr[:, 0], np.full(len(rr), y), cz - 0.03 + rr[:, 1]], 1))
    R = np.stack(rings)
    m, n, _ = R.shape
    V = R.reshape(-1, 3)
    F = grid_faces(m, n, True)
    V = np.concatenate([V, [R[0].mean(0), R[-1].mean(0)]])
    F += fan(len(V) - 2, list(range(n)), V, [0, 1, 0])
    F += fan(len(V) - 1, list(range((m - 1) * n, m * n)), V, [0, -1, 0])
    p.add(V, F, kind='dark', pp=np.stack([V[:, 1], V[:, 2]], 1))
    # barrel, heat shroud, ring and muzzle brake in one lathe
    prof = [(4.40, 0.040, 'black'), (GUN_MUZZLE_Y, 0.040, 'heat'), (GUN_MUZZLE_Y, 0.092, 'heat'),
            (4.40, 0.092, 'dark'), (4.40, 0.068, 'dark'), (3.62, 0.068, 'dark'), (3.62, 0.086, 'dark'),
            (3.54, 0.086, 'dark'), (3.54, 0.068, 'dark'), (3.05, 0.068, 'dark'), (3.05, 0.104, 'dark'),
            (1.70, 0.104, 'dark')]
    V, F, PP, row = lathe([(y, r) for y, r, k in prof], 24, center=(cx, cz), rref=0.1)
    p.add(V, F, pp=PP, kinds=[prof[i][2] for i in row])
    # muzzle brake ports: small blocks either side
    for sgn in (1, -1):
        V, F, PP = rbox((cx + sgn * 0.094, 4.53, cz), (0.02, 0.10, 0.05), 0.006, 2)
        p.add(V, F, kind='black', pp=PP)
    # a feed conduit from the receiver down into the nacelle
    path = np.array([[cx - 0.02, -0.40, cz - 0.12], [cx - 0.10, -0.80, cz - 0.20], [cx - 0.18, -1.20, cz - 0.30],
                     [cx - 0.22, -1.60, cz - 0.36]])
    V, F, PP = sweep(path, np.tile([0.0, 0, 1.0], (4, 1)), rrect(0.03, 0.03, 0.029, 4))
    V, F = solid(V, F)
    p.add(V, F, kind='dark', pp=PP)
    return p


# ------------------------------------------------------------------ centre engine, fins, keel, nose
CEN_Z = 0.03
CEN_PROF = [
    (-5.40, 0.560, 'heat'), (-5.62, 0.560, 'heat'), (-5.66, 0.545, 'heat'), (-6.10, 0.528, 'heat'),
    (-6.55, 0.505, 'heat'), (-6.86, 0.492, 'heat'), (-6.905, 0.478, 'heat'), (-6.92, 0.462, 'heat'),
    (-6.905, 0.446, 'heat'), (-6.75, 0.428, 'heat'), (-6.50, 0.395, 'heat'), (-6.25, 0.335, 'heat'),
    (-6.10, 0.300, 'heat'),
]
CEN_EXIT_Y, CEN_THROAT_Y, CEN_THROAT_R = -6.92, -6.10, 0.300


def centre_engine():
    p = Part('engine', 10)
    V, F, PP, row = lathe([(y, r) for y, r, k in CEN_PROF], 56, center=(0, CEN_Z), rref=0.56)
    p.add(V, F, pp=PP, kinds=[CEN_PROF[i][2] for i in row])
    ys = [y for y, r, k in CEN_PROF if -6.86 <= y <= -5.66]
    rs = [r for y, r, k in CEN_PROF if -6.86 <= y <= -5.66]
    nozzle_petals(p, 0, CEN_Z, ys, rs, 16, 1.5, 0.011)
    V, F, PP, row = lathe([(-6.08, 0.16), (-6.20, 0.155), (-6.42, 0.12), (-6.62, 0.06), (-6.70, 0.0)],
                          32, center=(0, CEN_Z))
    p.add(V, F, kind='heat', pp=PP)
    # actuators from the bulkhead to the shroud
    for ang in (45, 135, 225, 315):
        a = math.radians(ang)
        d = np.array([math.cos(a), 0, math.sin(a)])
        path = np.array([[0, Y_TAIL + 0.02, CEN_Z] + d * 0.70, [0, -5.9, CEN_Z] + d * 0.62, [0, -6.25, CEN_Z] + d * 0.57])
        V, F, PP = sweep(path, np.tile(d, (3, 1)), rrect(0.035, 0.035, 0.034, 4))
        V, F = solid(V, F)
        p.add(V, F, kind='dark', pp=PP)
    return p


def fin_loft(root_pts, tip_pts, span_dir, thick_dir, t_root, t_tip, name, pid, kind='paint'):
    """A thin faceted fin between a root chord and a tip chord (each a (LE, TE) pair of points)."""
    p = Part(name, pid)
    sec = np.array(rounded_chain([(0, 0), (0.2, 1), (0.75, 1), (1, 0.12), (1, -0.12), (0.75, -1), (0.2, -1)],
                                 [0.02, 0.1, 0.1, 0.004, 0.004, 0.1, 0.1], [5, 3, 3, 2, 2, 3, 3],
                                 [1, 3, 2, 0, 2, 3, 1], closed=True))
    rings = []
    for s in np.linspace(0, 1, 5):
        le = root_pts[0] + (tip_pts[0] - root_pts[0]) * s
        te = root_pts[1] + (tip_pts[1] - root_pts[1]) * s
        t = t_root + (t_tip - t_root) * s
        rings.append(le[None] + (te - le)[None] * sec[:, 0:1] + np.asarray(thick_dir)[None] * sec[:, 1:2] * t / 2)
    R = np.stack(rings)
    m, n, _ = R.shape
    V = R.reshape(-1, 3)
    F = grid_faces(m, n, True)
    V = np.concatenate([V, [R[0].mean(0), R[-1].mean(0)]])
    F += fan(len(V) - 2, list(range(n)), V, -np.asarray(span_dir))
    F += fan(len(V) - 1, list(range((m - 1) * n, m * n)), V, np.asarray(span_dir))
    V, F = solid(V, F)
    d = np.asarray(span_dir)
    p.add(V, F, kind=kind, pp=np.stack([V[:, 1], (V - root_pts[0]) @ d], 1))
    return p


def tail_fins():
    cant = math.radians(22)
    d = np.array([math.sin(cant), 0, math.cos(cant)])
    tdir = np.array([math.cos(cant), 0, -math.sin(cant)])
    x0 = 0.34
    root = (np.array([x0, -3.72, fuse_top(x0, -3.72) - 0.02]), np.array([x0, -5.46, fuse_top(x0, -5.46) - 0.02]))
    base = np.array([x0, 0, fuse_top(x0, -4.6)])
    tip = (base + d * 0.66 + [0, -4.62, 0], base + d * 0.66 + [0, -5.26, 0])
    return fin_loft(root, tip, d, tdir, 0.075, 0.035, 'fin', 11)


def keel():
    p = Part('keel', 12)
    ys = np.linspace(4.30, -4.95, 30)
    rings = []
    for y in ys:
        k = min(1.0, (4.30 - y) / 0.6, (y + 4.95) / 0.5)
        k = max(0.05, k) ** 0.5
        zb = fuse_bot(0, y)
        rr = rrect(0.17 * (0.5 + 0.5 * k), 0.05, 0.03, 4)
        rings.append(np.stack([rr[:, 0], np.full(len(rr), y), zb + 0.02 - 0.05 * k + rr[:, 1]], 1))
    R = np.stack(rings)
    m, n, _ = R.shape
    V = R.reshape(-1, 3)
    F = grid_faces(m, n, True)
    V = np.concatenate([V, [R[0].mean(0), R[-1].mean(0)]])
    F += fan(len(V) - 2, list(range(n)), V, [0, 1, 0])
    F += fan(len(V) - 1, list(range((m - 1) * n, m * n)), V, [0, -1, 0])
    V, F = solid(V, F)
    p.add(V, F, pp=np.stack([V[:, 1], V[:, 0]], 1))
    return p


def ventral_fin():
    zb = lambda y: fuse_bot(0, y) - 0.02
    root = (np.array([0, -3.90, zb(-3.90) + 0.02]), np.array([0, -5.40, zb(-5.40) + 0.04]))
    tip = (np.array([0, -4.75, zb(-4.75) - 0.30]), np.array([0, -5.30, zb(-5.30) - 0.30]))
    return fin_loft(root, tip, np.array([0, 0, -1.0]), np.array([1.0, 0, 0]), 0.06, 0.03, 'ventral', 13)


def nose_bits():
    p = Part('nose', 14)
    V, F, PP, row = lathe([(7.96, 0.0), (7.93, 0.010), (7.62, 0.012), (7.62, 0.020), (7.45, 0.020), (7.36, 0.028),
                           (7.20, 0.034)], 14, center=(0, 0.0))
    p.add(V, F, kind='dark', pp=PP)
    for sgn in (1, -1):
        y = 5.15
        a, zc, ht, tw, hb, bw = fuse_params(y)
        V, F, PP = rbox((sgn * (a - 0.01), y, zc + 0.01), (0.10, 0.22, 0.13), 0.025)
        p.add(V, F, kind='dark', pp=PP)
    return p


# ------------------------------------------------------------------ stores and accessories
MSL_X, MSL_Z = 3.05, -0.52         # rack centre under each wing
MSL_DX = 0.27                      # the two rounds sit either side of the pylon
MSL_R, MSL_Y0, MSL_Y1 = 0.15, 1.40, -1.95
TANK_X, TANK_Z, TANK_R = 1.92, -0.56, 0.25


def missile(p, cx, cz):
    """One round: ogive nose (warhead band), body, a sensor ring, four swept tail fins set at 45 degrees and a
    dark nozzle. Lathed along +Y (forward)."""
    r = MSL_R
    prof = [(MSL_Y0, 0.0, 'dark'), (MSL_Y0 - 0.06, 0.035, 'dark'), (MSL_Y0 - 0.20, 0.075, 'paint'),
            (MSL_Y0 - 0.42, 0.105, 'paint'), (MSL_Y0 - 0.62, r, 'paint'), (MSL_Y0 - 0.70, r * 1.03, 'dark'),
            (MSL_Y0 - 0.74, r, 'paint'), (MSL_Y1 + 0.18, r, 'paint'), (MSL_Y1 + 0.06, r * 0.88, 'dark'),
            (MSL_Y1, r * 0.72, 'heat'), (MSL_Y1, r * 0.50, 'black'), (MSL_Y1 + 0.10, 0.0, 'black')]
    V, F, PP, row = lathe([(y, rr) for y, rr, k in prof], 20, center=(cx, cz), rref=r)
    p.add(V, F, pp=PP, kinds=[prof[i][2] for i in row])
    for k in range(4):
        a = math.radians(45 + 90 * k)
        d = np.array([math.cos(a), 0, math.sin(a)])
        t = np.array([-math.sin(a), 0, math.cos(a)])
        base = np.array([cx, 0, cz]) + d * (r * 0.9)
        root = (base + [0, MSL_Y1 + 0.62, 0], base + [0, MSL_Y1 + 0.10, 0])
        tip = (base + d * 0.26 + [0, MSL_Y1 + 0.30, 0], base + d * 0.26 + [0, MSL_Y1 + 0.10, 0])
        p.absorb(fin_loft(root, tip, d, t, 0.022, 0.014, 'mfin', p.id))
    # forward canards, small
    for k in range(4):
        a = math.radians(45 + 90 * k)
        d = np.array([math.cos(a), 0, math.sin(a)])
        t = np.array([-math.sin(a), 0, math.cos(a)])
        base = np.array([cx, 0, cz]) + d * (r * 0.92)
        root = (base + [0, MSL_Y0 - 0.80, 0], base + [0, MSL_Y0 - 1.02, 0])
        tip = (base + d * 0.11 + [0, MSL_Y0 - 0.92, 0], base + d * 0.11 + [0, MSL_Y0 - 1.02, 0])
        p.absorb(fin_loft(root, tip, d, t, 0.014, 0.01, 'mcan', p.id))


def stores():
    """Right-hand weapons pylon under the wing: a swept pylon, a twin rack beam with sway braces, two rounds."""
    p = Part('stores', 21)
    x = MSL_X
    le, te = wing_le(x), wing_te(x)
    zw = NAC_Z - 0.028 * (le - te) + 0.02                     # just inside the wing's lower skin
    rings = []
    for z, y0, y1 in ((zw, 0.35, -1.55), (MSL_Z + MSL_R + 0.10, 0.10, -1.35)):
        sec = rrect(0.055, (y0 - y1) / 2, 0.045, 5)
        rings.append(np.stack([x + sec[:, 0], (y0 + y1) / 2 + sec[:, 1], np.full(len(sec), z)], 1))
    R = np.stack(rings)
    m, n, _ = R.shape
    V = R.reshape(-1, 3)
    F = grid_faces(m, n, True)
    V = np.concatenate([V, [R[0].mean(0), R[-1].mean(0)]])
    F += fan(len(V) - 2, list(range(n)), V, [0, 0, 1])
    F += fan(len(V) - 1, list(range((m - 1) * n, m * n)), V, [0, 0, -1])
    V, F = solid(V, F)
    p.add(V, F, pp=np.stack([V[:, 1], V[:, 2]], 1))
    # rack beam and sway braces
    zr = MSL_Z + MSL_R + 0.06
    V, F, PP = rbox((x, -0.40, zr), (2 * MSL_DX + 0.10, 1.40, 0.07), 0.02)
    p.add(V, F, kind='dark', pp=PP)
    for y in (0.05, -0.85):
        for sgn in (1, -1):
            V, F, PP = rbox((x + sgn * (MSL_DX - 0.05), y, zr - 0.07), (0.035, 0.05, 0.10), 0.01, 2)
            p.add(V, F, kind='dark', pp=PP)
    for sgn in (1, -1):
        missile(p, x + sgn * MSL_DX, MSL_Z)
    # inboard drop tank on its own pylon
    xt = TANK_X
    zw = NAC_Z - 0.028 * (wing_le(xt) - wing_te(xt)) + 0.02
    V, F, PP = rbox((xt, -0.30, (zw + TANK_Z + TANK_R) / 2), (0.10, 1.5, zw - TANK_Z - TANK_R + 0.06), 0.035)
    p.add(V, F, pp=PP)
    r, y0, y1 = TANK_R, 1.30, -2.05
    prof = [(y0, 0.0), (y0 - 0.12, r * 0.42), (y0 - 0.45, r * 0.82), (y0 - 0.9, r), (y1 + 0.9, r),
            (y1 + 0.84, r * 1.02), (y1 + 0.78, r), (y1 + 0.35, r * 0.78), (y1 + 0.08, r * 0.30), (y1, 0.0)]
    kinds = ['paint', 'paint', 'paint', 'paint', 'dark', 'dark', 'paint', 'paint', 'dark']
    V, F, PP, row = lathe(prof, 24, center=(xt, TANK_Z), rref=r)
    p.add(V, F, pp=PP, kinds=[kinds[i] for i in row])
    for k, a in enumerate((90, 210, 330)):                   # three small stabiliser fins on the tail cone
        a = math.radians(a)
        d = np.array([math.cos(a), 0, math.sin(a)])
        t = np.array([-math.sin(a), 0, math.cos(a)])
        base = np.array([xt, 0, TANK_Z]) + d * r * 0.55
        root = (base + [0, y1 + 0.55, 0], base + [0, y1 + 0.12, 0])
        tip = (base + d * 0.16 + [0, y1 + 0.28, 0], base + d * 0.16 + [0, y1 + 0.10, 0])
        p.absorb(fin_loft(root, tip, d, t, 0.02, 0.012, 'tfin', p.id))
    return p


def canard():
    """Right-hand foreplane on the chine ahead of the scoops."""
    y_le, y_te = 4.72, 3.98
    a, zc, *_ = fuse_params(4.35)
    root = (np.array([fuse_side(zc, y_le) - 0.03, y_le, zc]), np.array([fuse_side(zc, y_te) - 0.03, y_te, zc]))
    tip = (np.array([a + 0.78, 4.12, zc + 0.05]), np.array([a + 0.78, 3.90, zc + 0.05]))
    return fin_loft(root, tip, unit([1.0, 0, 0.06]), np.array([0, 0, 1.0]), 0.07, 0.025, 'canard', 22)


def chin_turret():
    """A sensor ball under the nose: a gimbal fork, the ball and a dark lens facing forward."""
    p = Part('chin', 23)
    y = 5.55
    zb = fuse_bot(0, y)
    V, F, PP = rbox((0, y + 0.05, zb - 0.03), (0.22, 0.34, 0.10), 0.03)
    p.add(V, F, kind='dark', pp=PP)
    r = 0.15
    c = (0, zb - 0.13 - r * 0.5)
    prof = [(y + r, 0.0), (y + r * 0.92, r * 0.38), (y + r * 0.92, r * 0.52), (y + r * 0.7, r * 0.72),
            (y + r * 0.35, r * 0.94), (y, r), (y - r * 0.5, r * 0.86), (y - r * 0.87, r * 0.5), (y - r, 0.0)]
    kinds = ['black', 'dark', 'dark', 'paint', 'paint', 'paint', 'paint', 'paint']
    V, F, PP, row = lathe(prof, 20, center=c, rref=r)
    p.add(V, F, pp=PP, kinds=[kinds[i] for i in row])
    return p


def antennas():
    """Twin whip antennas aft on the spine and a pitot-static probe pair under the nose."""
    p = Part('antennas', 24)
    for sgn in (1, -1):
        y = -4.05
        base = np.array([sgn * 0.12, y, spine_top(y) - 0.01])
        path = np.array([base, base + [sgn * 0.05, -0.25, 0.45], base + [sgn * 0.09, -0.62, 0.80]])
        V, F, PP = sweep(path, np.tile([1.0, 0, 0], (3, 1)), rrect(0.012, 0.012, 0.0118, 3))
        V, F = solid(V, F)
        p.add(V, F, kind='dark', pp=PP)
        V, F, PP = rbox(tuple(base + [0, 0, 0.015]), (0.06, 0.09, 0.04), 0.012, 2)
        p.add(V, F, kind='dark', pp=PP)
    return p


def rcs_quad(p, c, out):
    """A reaction-control block: a rounded housing with three small nozzles pointing out, up and down."""
    out = unit(out)
    V, F, PP = rbox(tuple(c), (0.13, 0.20, 0.13) if abs(out[0]) > 0.5 else (0.13, 0.13, 0.13), 0.03)
    p.add(V, F, kind='dark', pp=PP)
    for d in (out, np.array([0, 0, 1.0]), np.array([0, 0, -1.0])):
        tip = np.asarray(c) + d * 0.075
        path = np.array([np.asarray(c) + d * 0.04, tip])
        up = np.array([0, 1.0, 0])
        V, F, PP = sweep(path, np.tile(up, (2, 1)), rrect(0.022, 0.022, 0.0215, 3))
        V, F = solid(V, F)
        p.add(V, F, kind='heat', pp=PP)


def rcs():
    """Right-hand RCS blocks: one on the nose, one on the tail."""
    p = Part('rcs', 25)
    for y in (6.05, -4.85):
        a, zc, *_ = fuse_params(y)
        rcs_quad(p, (fuse_side(zc, y) + 0.02, y, zc), [1.0, 0, 0])
    return p



def rocket_pod():
    """Right-hand rocket pod on top of the wing: a faired box on a short pylon, its blunt front a 3 x 2 grid of
    launch tubes, a hazard band and an aft cap. Visible from the chase camera, unlike the under-wing stores."""
    p = Part('rpod', 29)
    x, y0, y1, hw, hh = 2.72, 0.55, -1.70, 0.30, 0.19
    le, te = wing_le(x), wing_te(x)
    zt = NAC_Z + 0.042 * (le - te) - 0.02                      # just inside the wing's upper skin
    zc = zt + 0.08 + hh
    V, F, PP = rbox((x, (y0 + y1) / 2 - 0.10, zt + 0.05), (0.14, (y0 - y1) * 0.7, 0.14), 0.04)
    p.add(V, F, kind='dark', pp=PP)
    rings = []
    for y, k in ((y0, 0.90), (y0 - 0.06, 1.0), (y1 + 0.35, 1.0), (y1 + 0.05, 0.82), (y1, 0.70)):
        rr = rrect(hw * k, hh * k, 0.09 * k, 5)
        rings.append(np.stack([x + rr[:, 0], np.full(len(rr), y), zc + rr[:, 1]], 1))
    R = np.stack(rings)
    m, n, _ = R.shape
    V = R.reshape(-1, 3)
    F = grid_faces(m, n, True)
    V = np.concatenate([V, [R[0].mean(0), R[-1].mean(0)]])
    F += fan(len(V) - 2, list(range(n)), V, [0, 1, 0])
    F += fan(len(V) - 1, list(range((m - 1) * n, m * n)), V, [0, -1, 0])
    V, F = solid(V, F)
    p.add(V, F, pp=np.stack([V[:, 1], V[:, 0] - x + V[:, 2] - zc], 1))
    # launch tubes: short dark bores standing proud of the front face
    for i in range(3):
        for j in range(2):
            cx, cz = x + (i - 1) * 0.18, zc + (j - 0.5) * 0.17
            prof = [(y0 + 0.035, 0.066), (y0 + 0.035, 0.050), (y0 - 0.02, 0.050), (y0 - 0.02, 0.0)]
            V, F, PP, row = lathe(prof, 14, center=(cx, cz), rref=0.07)
            kinds = ['dark', 'black', 'black']
            p.add(V, F, pp=PP, kinds=[kinds[i2] for i2 in row])
            prof = [(y0 + 0.035, 0.066), (y0 - 0.03, 0.066)]
            V, F, PP, row = lathe(prof, 14, center=(cx, cz), rref=0.07)
            p.add(V, F, kind='dark', pp=PP)
    return p


def sensor_dome():
    """A flattened sensor dome on the spine behind the blade antenna."""
    p = Part('dome', 30)
    y, r = -1.10, 0.20
    zb = spine_top(y) - 0.02
    V, F, PP = rbox((0, y, zb + 0.015), (0.44, 0.46, 0.04), 0.015)
    p.add(V, F, kind='dark', pp=PP)
    prof = [(y + r, 0.0)] + [(y + r * math.cos(a), r * math.sin(a)) for a in np.linspace(0.25, np.pi - 0.25, 9)] + [(y - r, 0.0)]
    V, F, PP, row = lathe(prof, 22, center=(0, zb), rref=r)
    V[:, 2] = zb + (V[:, 2] - zb) * np.where(V[:, 2] > zb, 0.55, 0.0)   # flatten; the lower half folds into the base
    p.add(V, F, pp=PP)
    return p


# ------------------------------------------------------------------ glow parts (separate materials)
def disc(name, pid, cx, y, cz, r, facing):
    g = Part(name, pid)
    ring = [[cx + r * math.cos(t), y, cz + r * math.sin(t)] for t in np.linspace(0, 2 * np.pi, 40, endpoint=False)]
    V = np.array([[cx, y, cz]] + ring)
    g.add(V, fan(0, list(range(1, 41)), V, facing), kind='glow')
    return g


def dome(name, pid, c, r, axis):
    """A small lens (half sphere) facing along axis."""
    g = Part(name, pid)
    axis = unit(axis)
    prof = [(r * math.cos(a), r * math.sin(a)) for a in np.linspace(0, np.pi / 2, 6)]
    prof[0] = (r, 0.0)
    V, F, PP, row = lathe(prof, 16, center=(0, 0))
    # lathe builds along +Y; rotate +Y onto axis
    y = np.array([0, 1.0, 0])
    v = np.cross(y, axis)
    s, cth = np.linalg.norm(v), np.dot(y, axis)
    if s < 1e-9:
        Rm = np.eye(3) if cth > 0 else np.diag([1, -1, -1])
    else:
        vx = np.array([[0, -v[2], v[1]], [v[2], 0, -v[0]], [-v[1], v[0], 0]])
        Rm = np.eye(3) + vx + vx @ vx * ((1 - cth) / s ** 2)
    V = V @ Rm.T + np.asarray(c)
    g.add(V, F, kind='glow', pp=PP)
    return g


def build():
    hull = []
    fus = fuselage()
    hull.append(fus)
    hull.append(canopy_frame())
    hull.append(cockpit())
    hull.append(spine())
    s = scoop()
    hull += [s, s.mirrored('scoop_l', 15)]
    w = wing()
    hull += [w, w.mirrored('wing_l', 16)]
    st = strut()
    hull += [st, st.mirrored('strut_l', 17)]
    nac = nacelle()
    hull += [nac, nac.mirrored('nacelle_l', 18)]
    gn = gun()
    hull += [gn, gn.mirrored('gun_l', 19)]
    hull.append(centre_engine())
    fin = tail_fins()
    hull += [fin, fin.mirrored('fin_l', 20)]
    hull.append(keel())
    hull.append(ventral_fin())
    hull.append(nose_bits())
    stc = stores()
    hull += [stc, stc.mirrored('stores_l', 26)]
    cn = canard()
    hull += [cn, cn.mirrored('canard_l', 27)]
    hull.append(chin_turret())
    rp = rocket_pod()
    hull += [rp, rp.mirrored('rpod_l', 31)]
    hull.append(sensor_dome())
    hull.append(antennas())
    rc = rcs()
    hull += [rc, rc.mirrored('rcs_l', 28)]
    glass = canopy()
    glow = {
        'GlowC': disc('GlowC', 91, 0, CEN_THROAT_Y - 0.01, CEN_Z, CEN_THROAT_R + 0.01, [0, -1, 0]),
        'GlowR': disc('GlowR', 92, NAC_X, NAC_THROAT_Y - 0.01, NAC_Z, NAC_THROAT_R + 0.01, [0, -1, 0]),
        'GlowL': disc('GlowL', 93, -NAC_X, NAC_THROAT_Y - 0.01, NAC_Z, NAC_THROAT_R + 0.01, [0, -1, 0]),
        'NavR': dome('NavR', 94, (NAC_X + 0.80, -1.30, NAC_Z + 0.02), 0.035, [1, 0, 0]),
        'NavL': dome('NavL', 95, (-NAC_X - 0.80, -1.30, NAC_Z + 0.02), 0.035, [-1, 0, 0]),
        'Beacon': dome('Beacon', 96, (0, -4.55, spine_top(-4.55) - 0.005), 0.05, [0, 0, 1]),
    }
    cant = math.radians(22)
    for sgn, nm, pid in ((1, 'StrobeR', 97), (-1, 'StrobeL', 98)):
        base = np.array([0.34, 0, fuse_top(0.34, -4.6)])
        tipc = base + np.array([math.sin(cant), 0, math.cos(cant)]) * 0.67 + [0, -5.22, 0]
        tipc[0] *= sgn
        glow[nm] = dome(nm, pid, tipc, 0.03, [0, -1, 0])
    return hull, glass, glow


def anchors():
    """Gameplay anchors in three.js coordinates (x right, y up, z back = -Blender y)."""
    t = lambda x, y, z: [round(x, 3), round(z, 3), round(-y, 3)]
    return {
        'engines': [t(0, CEN_EXIT_Y, CEN_Z), t(-NAC_X, NAC_EXIT_Y, NAC_Z), t(NAC_X, NAC_EXIT_Y, NAC_Z)],
        'engineThroats': [t(0, CEN_THROAT_Y, CEN_Z), t(-NAC_X, NAC_THROAT_Y, NAC_Z), t(NAC_X, NAC_THROAT_Y, NAC_Z)],
        'engineR': [0.46, 0.57, 0.57],
        'guns': [t(-GUN_X, GUN_MUZZLE_Y + 0.05, GUN_Z), t(GUN_X, GUN_MUZZLE_Y + 0.05, GUN_Z)],
        'nav': {'red': t(-NAC_X - 0.83, -1.30, NAC_Z + 0.02), 'green': t(NAC_X + 0.83, -1.30, NAC_Z + 0.02)},
        # collision / close-pass probes (three.js ship space), fitted to the hull above
        'samples': [
            {'p': [0, 0.03, -6.3], 'r': 0.42, 'part': 'nose'}, {'p': [0, 0.08, -4.9], 'r': 0.72, 'part': 'nose'},
            {'p': [0, 0.45, -2.0], 'r': 1.0, 'part': 'hull'}, {'p': [0, 0.1, -0.4], 'r': 1.25, 'part': 'hull'},
            {'p': [0, 0.1, 2.4], 'r': 1.25, 'part': 'hull'}, {'p': [0, 0.1, 4.6], 'r': 1.05, 'part': 'hull'},
            {'p': [0, 0.03, 6.3], 'r': 0.6, 'part': 'hull'},
        ] + [{'p': [sx * NAC_X, NAC_Z, z], 'r': 0.82, 'part': 'wingtip'} for sx in (-1, 1) for z in (-0.9, 1.3, 3.5)]
          + [{'p': [sx * GUN_X, GUN_Z, -3.4], 'r': 0.28, 'part': 'wingtip'} for sx in (-1, 1)]
          + [{'p': [sx * x, NAC_Z, z], 'r': 0.58, 'part': 'wing'} for sx in (-1, 1) for (x, z) in ((2.0, 1.2), (3.2, 0.1), (3.2, 1.6), (3.2, 3.1))]
          # Fitted afterwards against the exported hull (voxelised, spheres grown from the interior, then the
          # extremities by hand: pitot, gun barrels, nozzle bells, fin roots), so no part of the hull sits more
          # than ~0.55 m outside the probes (it was 1.24 m at the pitot tip).
          + [
            {'p': [0.0, 0.155, -3.3], 'r': 0.933, 'part': 'hull'},
            {'p': [1.8, -0.405, 3.42], 'r': 0.34, 'part': 'wing'},
            {'p': [-1.8, -0.405, 3.42], 'r': 0.34, 'part': 'wing'},
            {'p': [-2.12, 0.075, 2.46], 'r': 0.42, 'part': 'wing'},
            {'p': [2.12, 0.075, 2.46], 'r': 0.42, 'part': 'wing'},
            {'p': [-4.28, -0.005, 2.54], 'r': 0.34, 'part': 'wing'},
            {'p': [4.28, -0.005, 2.54], 'r': 0.34, 'part': 'wing'},
            {'p': [1.88, 0.075, -0.02], 'r': 0.457, 'part': 'wing'},
            {'p': [-1.88, 0.075, -0.02], 'r': 0.457, 'part': 'wing'},
            {'p': [-4.44, 0.075, 0.46], 'r': 0.42, 'part': 'wingtip'},
            {'p': [4.44, 0.075, 0.46], 'r': 0.42, 'part': 'wingtip'},
            {'p': [5.56, -0.485, 4.7], 'r': 0.333, 'part': 'wingtip'},
            {'p': [-5.56, -0.485, 4.7], 'r': 0.333, 'part': 'wingtip'},
            {'p': [0.0, 0.155, 0.78], 'r': 1.008, 'part': 'hull'},
            {'p': [4.92, 0.475, 4.62], 'r': 0.333, 'part': 'wingtip'},
            {'p': [-4.92, 0.475, 4.62], 'r': 0.333, 'part': 'wingtip'},
            {'p': [0, 0.01, -6.85], 'r': 0.3, 'part': 'nose'},
            {'p': [0, 0, -7.4], 'r': 0.12, 'part': 'nose'},
            {'p': [0, 0, -7.8], 'r': 0.1, 'part': 'nose'},
            {'p': [-6.02, 0.42, -2.6], 'r': 0.16, 'part': 'wingtip'},
            {'p': [-6.02, 0.42, -4.0], 'r': 0.14, 'part': 'wingtip'},
            {'p': [-6.02, 0.42, -4.5], 'r': 0.14, 'part': 'wingtip'},
            {'p': [6.02, 0.42, -2.6], 'r': 0.16, 'part': 'wingtip'},
            {'p': [6.02, 0.42, -4.0], 'r': 0.14, 'part': 'wingtip'},
            {'p': [6.02, 0.42, -4.5], 'r': 0.14, 'part': 'wingtip'},
            {'p': [-5.72, 0.3, 4.78], 'r': 0.24, 'part': 'wingtip'},
            {'p': [-5.14, 0.74, 0.18], 'r': 0.2, 'part': 'wingtip'},
            {'p': [5.72, 0.3, 4.78], 'r': 0.24, 'part': 'wingtip'},
            {'p': [5.14, 0.74, 0.18], 'r': 0.2, 'part': 'wingtip'},
            # fitted again after the stores, pods and foreplanes were added
            {'p': [-1.94, -0.563, -0.683], 'r': 0.43, 'part': 'wing'},
            {'p': [1.94, -0.563, -0.683], 'r': 0.43, 'part': 'wing'},
            {'p': [3.291, -0.563, -0.806], 'r': 0.335, 'part': 'wing'},
            {'p': [-3.291, -0.563, -0.806], 'r': 0.335, 'part': 'wing'},
            {'p': [-1.325, 0.052, -4.129], 'r': 0.231, 'part': 'wing'},
            {'p': [1.325, 0.052, -4.129], 'r': 0.231, 'part': 'wing'},
            {'p': [-0.771, 0.114, -2.16], 'r': 0.624, 'part': 'hull'},
            {'p': [0.771, 0.114, -2.16], 'r': 0.624, 'part': 'hull'},
            {'p': [5.998, 0.36, 0.117], 'r': 0.354, 'part': 'wingtip'},
            {'p': [-5.998, 0.36, 0.117], 'r': 0.354, 'part': 'wingtip'},
            {'p': [5.137, 0.791, 2.394], 'r': 0.262, 'part': 'wingtip'},
            {'p': [-5.137, 0.791, 2.394], 'r': 0.262, 'part': 'wingtip'},
            {'p': [5.26, -0.748, 2.332], 'r': 0.231, 'part': 'wingtip'},
            {'p': [-5.26, -0.748, 2.332], 'r': 0.231, 'part': 'wingtip'},
            {'p': [5.568, -0.686, 0.24], 'r': 0.231, 'part': 'wingtip'},
            {'p': [-5.568, -0.686, 0.24], 'r': 0.231, 'part': 'wingtip'},
          ],
    }
