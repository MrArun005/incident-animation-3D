# Six asteroids for Astra Adventures, built analytically in numpy (no Blender needed).
#   /tmp/bvenv/bin/python rocks.py [--res 2048] [--only potato,shard] [--preview]
#
# Every asteroid is star-shaped: a radius r(d) along each direction d from its centre. That buys three things:
#   * one octahedral texture (direction -> texel) serves every LOD, so the LODs never need their own bakes;
#   * the normal map is OBJECT-space and exact (from the full-detail surface), whatever mesh draws it;
#   * the game collides against a radial table sampled from the same surface it draws.
# Shapes follow real small bodies: an Eros-like potato, a Bennu-like rubble pile, a fractured shard,
# an Itokawa-like contact binary, a Ryugu-like spinning top and a lumpy Ida-like body.
#
# Axes are three.js axes (y up). Outputs in ../assets:
#   rocks.glb                       6 variants x 3 LODs (POSITION, NORMAL, TEXCOORD_0 = octahedral uv)
#   rock-<name>-albedo.jpg          sRGB albedo with cavity occlusion
#   rock-<name>-normal.jpg          object-space normal (rgb = n * 0.5 + 0.5)
#   rock-detail.jpg                 tileable close-up detail: rg = tangent normal xy, b = albedo modulation
#   rocks.json                      per variant: mean/max radius, LOD face counts, radial table (lat x lon)
import sys, os, math, json, struct, time
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import numpy as np
from scipy.spatial import cKDTree
from PIL import Image
from noise import perlin3, fbm, ridged

args = sys.argv[1:]
RES = int(args[args.index('--res') + 1]) if '--res' in args else 2048
ONLY = args[args.index('--only') + 1].split(',') if '--only' in args else None
OUT = os.environ.get('ROCKS_OUT') or os.path.join(HERE, '..', 'assets')
os.makedirs(OUT, exist_ok=True)
T0 = time.time()
LODS = (48, 24, 11)                     # octasphere subdivisions: 18432, 4608, 968 triangles
TAB_LAT, TAB_LON = 64, 128


def log(*a):
    print(f'[{time.time() - T0:6.1f}s]', *a, flush=True)


def unit(v):
    return v / np.maximum(np.linalg.norm(v, axis=-1, keepdims=True), 1e-12)


def sstep(a, b, x):
    t = np.clip((x - a) / (b - a), 0, 1)
    return t * t * (3 - 2 * t)


def srgb2lin(c):
    c = np.asarray(c, np.float32)
    return np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)


def lin2srgb(c):
    c = np.clip(c, 0, 1)
    return np.where(c <= 0.0031308, c * 12.92, 1.055 * np.power(c, 1 / 2.4) - 0.055)


# ------------------------------------------------------------------ octahedral mapping (y is the pole)
def oct_enc(d):
    p = d / np.abs(d).sum(-1, keepdims=True)
    x, y, z = p[..., 0], p[..., 1], p[..., 2]
    sx, sz = np.where(x >= 0, 1.0, -1.0), np.where(z >= 0, 1.0, -1.0)
    u = np.where(y >= 0, x, (1 - np.abs(z)) * sx)
    v = np.where(y >= 0, z, (1 - np.abs(x)) * sz)
    return np.stack([u, v], -1) * 0.5 + 0.5


def oct_dec(uv):
    f = uv * 2 - 1
    x, z = f[..., 0], f[..., 1]
    y = 1 - np.abs(x) - np.abs(z)
    t = np.clip(-y, 0, None)
    x = x + np.where(x >= 0, -t, t)
    z = z + np.where(z >= 0, -t, t)
    return unit(np.stack([x, y, z], -1))


def octasphere(n):
    """Eight triangular patches; returns directions (V,3), faces (F,3), octahedral uv (V,2). Patch borders
    are duplicated, so the lower-hemisphere seams of the octahedral map get their own uvs."""
    V, F, SG = [], [], []
    for sx in (1, -1):
        for sy in (1, -1):
            for sz in (1, -1):
                A, Bv, C = np.array([sx, 0, 0.0]), np.array([0, sy, 0.0]), np.array([0, 0, sz * 1.0])
                base = len(V)
                idx = {}
                for i in range(n + 1):
                    for j in range(n + 1 - i):
                        k = n - i - j
                        idx[i, j] = len(V)
                        V.append((A * i + Bv * j + C * k) / n)
                        SG.append((sx, sy, sz))
                for i in range(n):
                    for j in range(n - i):
                        tris = [(idx[i, j], idx[i + 1, j], idx[i, j + 1])]
                        if i + j < n - 1:
                            tris.append((idx[i + 1, j], idx[i + 1, j + 1], idx[i, j + 1]))
                        for t in tris:
                            a, b, c = (np.array(V[q]) for q in t)
                            if np.dot(np.cross(b - a, c - a), a + b + c) < 0:
                                t = (t[0], t[2], t[1])
                            F.append(t)
    P = np.array(V)
    # uv straight from each patch's own octant signs: a vertex on a lower-hemisphere seam has x or z = -0.0,
    # which oct_enc() would read as positive and send to the opposite edge of the map
    S = np.array(SG)
    x, y, z = P[:, 0], P[:, 1], P[:, 2]
    u = np.where(S[:, 1] > 0, x, (1 - np.abs(z)) * S[:, 0])
    v = np.where(S[:, 1] > 0, z, (1 - np.abs(x)) * S[:, 2])
    uv = np.stack([u, v], 1) * 0.5 + 0.5
    return unit(P), np.array(F, np.int32), uv


# ------------------------------------------------------------------ the shapes
def rand_dirs(rng, n):
    return unit(rng.standard_normal((n, 3)))


def smin(a, b, k):
    h = np.clip(0.5 + 0.5 * (b - a) / k, 0, 1)
    return b + (a - b) * h - k * h * (1 - h)


def smax(a, b, k):
    return -smin(-a, -b, k)


class Rock:
    def __init__(self, spec):
        self.s = spec
        rng = np.random.default_rng(spec['seed'])
        self.rng = rng
        # craters: Pareto sizes, a handful of big basins placed explicitly
        nc = spec.get('craters', 150)
        rmin, rmax, alpha = 0.014, spec.get('crater_max', 0.40), 1.7
        u = rng.random(nc)
        rho = rmin * (1 - u * (1 - (rmin / rmax) ** alpha)) ** (-1 / alpha)
        nb = spec.get('basins', 3)
        rho[:nb] = rng.uniform(0.22, rmax, nb)
        self.c_dir = rand_dirs(rng, nc)
        self.c_rho = rho
        self.c_depth = rho * rng.uniform(0.14, 0.30, nc) * spec.get('crater_depth', 1.0)
        self.c_fresh = rng.random(nc) < 0.22
        self.c_depth *= np.where(self.c_fresh, 1.15, rng.uniform(0.35, 1.0, nc))
        self.c_rim = np.where(self.c_fresh, 0.24, 0.12)
        # boulders
        nbld = spec.get('boulders', 0)
        bu = rng.random(nbld)
        self.b_dir = rand_dirs(rng, nbld)
        ba = spec.get('boulder_alpha', 2.2)
        self.b_rho = 0.006 * (1 - bu * (1 - (0.006 / spec.get('boulder_max', 0.06)) ** ba)) ** (-1 / ba)
        self.b_h = self.b_rho * rng.uniform(*spec.get('boulder_h', (0.35, 0.8)), nbld)
        self.b_tone = rng.uniform(0.75, 1.3, nbld)
        # shape parameters
        if spec['shape'] == 'poly':
            k = spec.get('planes', 12)
            self.pl_n = rand_dirs(rng, k)
            self.pl_h = rng.uniform(0.72, 1.0, k)
        self.warp = rng.uniform(-50, 50, 3)
        self.scale = 1.0

    # --- base body (no small features)
    def body(self, d):
        s = self.s
        if s['shape'] == 'ellipsoid':
            a, b, c = s['axes']
            r = 1 / np.sqrt((d[:, 0] / a) ** 2 + (d[:, 1] / b) ** 2 + (d[:, 2] / c) ** 2)
        elif s['shape'] == 'poly':
            r = np.full(len(d), 1.6, np.float32)
            for n, h in zip(self.pl_n, self.pl_h):
                dn = d @ n
                t = np.where(dn > 1e-3, h / np.maximum(dn, 1e-3), 3.0)
                r = smin(r, t, 0.08)
            a, b, c = s['axes']
            r = r / np.sqrt((d[:, 0] / a) ** 2 + (d[:, 1] / b) ** 2 + (d[:, 2] / c) ** 2) ** 0.5
        elif s['shape'] == 'lobes':
            rs = []
            for (c0, e) in s['lobes']:
                c0, e = np.asarray(c0, float), np.asarray(e, float)
                de, ce = d / e, c0 / e
                A = (de * de).sum(1)
                Bq = de @ ce
                C = ce @ ce - 1
                rs.append((Bq + np.sqrt(np.maximum(Bq * Bq - A * C, 0))) / A)
            r = smax(rs[0], rs[1], 0.18)
        elif s['shape'] == 'top':
            ay = np.abs(d[:, 1])
            r = 0.80 + 0.30 * (1 - ay) ** 1.7 - 0.06 * ay ** 4
            a, b, c = s['axes']
            r = r * np.sqrt(1 / ((d[:, 0] / a) ** 2 + (d[:, 1] / b) ** 2 + (d[:, 2] / c) ** 2))
        # domain-warped lumps
        q = d * 1.25 + self.warp
        w = np.stack([fbm(q, 1.0, 2, self.s['seed'] + 100 + i) for i in range(3)], 1)
        r = r * (1 + s.get('lumps', 0.06) * fbm(d * 1.4 + w * 0.6 + self.warp, 1.0, 3, s['seed'] + 7))
        return r.astype(np.float32)

    # --- craters and boulders, in units of the local radius
    def features(self, d, rho_min, tree=None, want_masks=False):
        n = len(d)
        h = np.zeros(n, np.float32)
        fresh = np.zeros(n, np.float32)
        bt = np.ones(n, np.float32)
        bm = np.zeros(n, np.float32)
        floor = np.zeros(n, np.float32)
        rimm = np.zeros(n, np.float32)
        tree = tree or cKDTree(d)
        for c, rho, dep, rim, fr in zip(self.c_dir, self.c_rho, self.c_depth, self.c_rim, self.c_fresh):
            if rho < rho_min:
                continue
            reach = min(np.pi, rho * 2.4)
            idx = np.asarray(tree.query_ball_point(c, 2 * math.sin(reach / 2)), np.int64)
            if len(idx) == 0:
                continue
            ang = np.arccos(np.clip(d[idx] @ c, -1, 1))
            t = ang / rho
            ff = 0.35 if rho > 0.2 else 0.12
            tt2 = 0.5 * (t * t + ff * ff + np.sqrt((t * t - ff * ff) ** 2 + 0.01))    # smooth max(t, ff)^2: a flat floor, no ring
            bowl = (tt2 - 1) / (1 - ff * ff) * (1 - sstep(0.78, 1.18, t))           # eases into the rim: no crease
            rimh = rim * np.exp(-((t - 1.0) / 0.32) ** 2)
            ej = 0.06 * np.exp(-np.maximum(t - 1, 0) * 2.2) * sstep(0.85, 1.2, t) * (1 - sstep(1.7, 2.35, t))   # no step at the rim
            rimh = rimh * (1 - sstep(1.9, 2.35, t))
            h[idx] += (dep * (bowl + rimh + ej)).astype(np.float32)
            if want_masks:
                floor[idx] = np.maximum(floor[idx], (1 - t) * (1 - sstep(0.55, 0.9, t)))
                rimm[idx] = np.maximum(rimm[idx], np.exp(-((t - 1.02) / 0.12) ** 2) * (dep / max(rho, 1e-6) > 0.12))
                if fr:
                    fresh[idx] = np.maximum(fresh[idx], np.exp(-((t - 0.95) / 0.7) ** 2) * (1 - sstep(1.8, 2.35, t)))
        for c, rho, bh, tone in zip(self.b_dir, self.b_rho, self.b_h, self.b_tone):
            if rho < rho_min:
                continue
            idx = np.asarray(tree.query_ball_point(c, 2 * math.sin(rho * 1.1 / 2)), np.int64)
            if len(idx) == 0:
                continue
            t = np.arccos(np.clip(d[idx] @ c, -1, 1)) / rho
            dome = np.clip(1 - t * t, 0, 1) ** 0.55
            h[idx] = np.maximum(h[idx], h[idx] * (1 - dome) + bh * dome)
            if want_masks:
                bm[idx] = np.maximum(bm[idx], dome)
                bt[idx] = np.where(dome > 0.2, tone, bt[idx])
        if want_masks:
            return h, dict(fresh=fresh, boulder=bm, btone=bt, floor=floor, rim=rimm)
        return h

    def r(self, d, level, tree=None, want_masks=False):
        base = self.body(d)
        rho_min = {'low': 0.10, 'mid': 0.045, 'high': 0.0}[level]
        out = self.features(d, rho_min, tree, want_masks)
        h, masks = out if want_masks else (out, None)
        r = base * (1 + h)
        if level != 'low':
            rg = self.s.get('ridge', 0.01)
            r = r * (1 + rg * 0.6 * (fbm(d * 3.0 + self.warp, 1.0, 3, self.s['seed'] + 40) * 0.5))
        if level == 'high':
            rg = self.s.get('ridge', 0.01)
            r = r * (1 + rg * (ridged(d * 7.0 + self.warp, 1.0, 5, self.s['seed'] + 50) - 0.35) +
                     0.0025 * fbm(d * 60.0, 1.0, 3, self.s['seed'] + 60))
        r = r * self.scale
        return (r, masks) if want_masks else r


SPECS = [
    dict(name='potato', seed=11, shape='ellipsoid', axes=(1.0, 0.60, 0.56), lumps=0.10, craters=240, basins=4,
         ridge=0.010, col=((0.34, 0.31, 0.27), (0.42, 0.38, 0.33))),
    dict(name='rubble', seed=12, shape='ellipsoid', axes=(1.0, 0.90, 0.83), lumps=0.05, craters=40, basins=1,
         crater_depth=0.6, boulders=1100, boulder_max=0.15, boulder_alpha=1.45, boulder_h=(0.45, 0.95), ridge=0.004, col=((0.26, 0.26, 0.26), (0.33, 0.32, 0.31))),
    dict(name='shard', seed=13, shape='poly', planes=13, axes=(1.0, 0.8, 0.7), lumps=0.03, craters=100, basins=2,
         boulders=60, ridge=0.020, col=((0.36, 0.28, 0.23), (0.44, 0.35, 0.28))),
    dict(name='binary', seed=14, shape='lobes', lobes=[((-0.42, 0.0, 0.0), (0.78, 0.64, 0.62)),
                                                      ((0.55, 0.05, 0.03), (0.66, 0.56, 0.52))],
         lumps=0.05, craters=160, basins=2, boulders=260, ridge=0.008, col=((0.33, 0.32, 0.30), (0.41, 0.39, 0.35))),
    dict(name='top', seed=15, shape='top', axes=(1.0, 1.0, 0.96), lumps=0.03, craters=70, basins=2, crater_depth=0.8,
         boulders=800, boulder_max=0.11, boulder_alpha=1.6, boulder_h=(0.4, 0.85), ridge=0.005, col=((0.27, 0.25, 0.23), (0.34, 0.31, 0.28))),
    dict(name='lumpy', seed=16, shape='ellipsoid', axes=(1.0, 0.78, 0.70), lumps=0.17, craters=230, basins=3,
         boulders=160, boulder_max=0.08, ridge=0.006, col=((0.35, 0.34, 0.32), (0.43, 0.41, 0.38))),
]


# ------------------------------------------------------------------ GLB writer
def write_glb(path, meshes):
    """meshes: list of (name, positions (n,3) f32, normals (n,3) f32, uv (n,2) f32, indices (m,) u32)."""
    bin_ = bytearray()
    bviews, accs, gmeshes, nodes = [], [], [], []

    def view(arr, target):
        nonlocal bin_
        while len(bin_) % 4:
            bin_ += b'\0'
        off = len(bin_)
        bin_ += arr.tobytes()
        bviews.append({'buffer': 0, 'byteOffset': off, 'byteLength': arr.nbytes, 'target': target})
        return len(bviews) - 1
    for name, pos, nrm, uv, idx in meshes:
        pos, nrm, uv = pos.astype(np.float32), nrm.astype(np.float32), uv.astype(np.float32)
        it = np.uint16 if len(pos) < 65536 else np.uint32
        idx = idx.astype(it)
        a = {}
        accs.append({'bufferView': view(pos, 34962), 'componentType': 5126, 'count': len(pos), 'type': 'VEC3',
                     'min': pos.min(0).tolist(), 'max': pos.max(0).tolist()})
        a['POSITION'] = len(accs) - 1
        accs.append({'bufferView': view(nrm, 34962), 'componentType': 5126, 'count': len(nrm), 'type': 'VEC3'})
        a['NORMAL'] = len(accs) - 1
        accs.append({'bufferView': view(uv, 34962), 'componentType': 5126, 'count': len(uv), 'type': 'VEC2'})
        a['TEXCOORD_0'] = len(accs) - 1
        accs.append({'bufferView': view(idx, 34963), 'componentType': 5123 if it == np.uint16 else 5125,
                     'count': len(idx), 'type': 'SCALAR'})
        gmeshes.append({'name': name, 'primitives': [{'attributes': a, 'indices': len(accs) - 1}]})
        nodes.append({'name': name, 'mesh': len(gmeshes) - 1})
    while len(bin_) % 4:
        bin_ += b'\0'
    gl = {'asset': {'version': '2.0', 'generator': 'astra rocks.py'}, 'scene': 0,
          'scenes': [{'nodes': list(range(len(nodes)))}], 'nodes': nodes, 'meshes': gmeshes,
          'accessors': accs, 'bufferViews': bviews, 'buffers': [{'byteLength': len(bin_)}]}
    js = json.dumps(gl, separators=(',', ':')).encode()
    while len(js) % 4:
        js += b' '
    with open(path, 'wb') as f:
        f.write(struct.pack('<III', 0x46546C67, 2, 12 + 8 + len(js) + 8 + len(bin_)))
        f.write(struct.pack('<II', len(js), 0x4E4F534A) + js)
        f.write(struct.pack('<II', len(bin_), 0x004E4942) + bytes(bin_))


# ------------------------------------------------------------------ per rock
def surface_normals(d, rfun, eps=2e-3):
    """Normals of the surface r(d) d by finite differences along two tangents."""
    t1 = unit(np.cross(d, np.where(np.abs(d[:, 1:2]) < 0.9, [[0, 1, 0]], [[1, 0, 0]])))
    t2 = np.cross(d, t1)
    p0 = rfun(d)[:, None] * d
    da, db = unit(d + t1 * eps), unit(d + t2 * eps)
    pa = rfun(da)[:, None] * da
    pb = rfun(db)[:, None] * db
    n = unit(np.cross(pa - p0, pb - p0))
    return np.where((n * d).sum(1, keepdims=True) < 0, -n, n)


def build_rock(spec, tex_res):
    rk = Rock(spec)
    # normalise: mean radius of the mid surface = 1
    probe = rand_dirs(np.random.default_rng(1), 20000)
    rk.scale = 1.0 / float(rk.r(probe, 'mid').mean())
    # texture grid
    g = (np.arange(tex_res) + 0.5) / tex_res
    uu, vv = np.meshgrid(g, g)
    D = oct_dec(np.stack([uu, vv], -1)).reshape(-1, 3)
    tree = cKDTree(D)
    rh, M = rk.r(D, 'high', tree, want_masks=True)
    rm = rk.r(D, 'mid', tree)
    rl = rk.r(D, 'low', tree)
    log(spec['name'], 'surface evaluated')
    S = (rh[:, None] * D).reshape(tex_res, tex_res, 3)
    # normals from texel neighbours (central differences; one-sided on the octahedral border)
    Su = np.zeros_like(S)
    Sv = np.zeros_like(S)
    Su[:, 1:-1] = S[:, 2:] - S[:, :-2]
    Su[:, 0] = S[:, 1] - S[:, 0]
    Su[:, -1] = S[:, -1] - S[:, -2]
    Sv[1:-1] = S[2:] - S[:-2]
    Sv[0] = S[1] - S[0]
    Sv[-1] = S[-1] - S[-2]
    Nn = unit(np.cross(Su, Sv)).reshape(-1, 3)
    Nn = np.where((Nn * D).sum(1, keepdims=True) < 0, -Nn, Nn)
    # occlusion from how far the surface sits below its smoothed versions
    cav1 = np.clip((rl - rh) / rl, 0, None)
    cav2 = np.clip((rm - rh) / rm, 0, None)
    ao = (1 - 0.65 * sstep(0.0, 0.08, cav1)) * (1 - 0.5 * sstep(0.0, 0.018, cav2))
    slope = (Nn * D).sum(1)
    # albedo
    cA, cB = srgb2lin(spec['col'][0]), srgb2lin(spec['col'][1])
    mix = np.clip(fbm(D * 2.2 + rk.warp, 1.0, 3, spec['seed'] + 70) * 0.9 + 0.5, 0, 1)[:, None]
    col = cA * (1 - mix) + cB * mix
    col *= (1 + 0.14 * fbm(D * 12.0, 1.0, 3, spec['seed'] + 71))[:, None]
    dust = sstep(0.82, 0.96, slope)[:, None]              # flat ground holds pale regolith, steep faces are rock
    col = col * (0.82 + 0.28 * dust) * np.array([1.0, 0.99, 0.97])[None]
    col = col * (1 + 0.35 * M['fresh'][:, None]) * (1 - 0.2 * sstep(0.1, 0.55, M['floor'])[:, None]) * (1 + 0.1 * M['rim'][:, None])
    col = col * np.where(M['boulder'][:, None] > 0.25, M['btone'][:, None], 1.0)
    col = col * (0.45 + 0.55 * ao[:, None])
    alb = lin2srgb(col).reshape(tex_res, tex_res, 3)
    nrm = (Nn * 0.5 + 0.5).reshape(tex_res, tex_res, 3)
    Image.fromarray((alb * 255 + 0.5).astype(np.uint8)).save(os.path.join(OUT, f'rock-{spec["name"]}-albedo.jpg'),
                                                            quality=90, optimize=True)
    Image.fromarray((nrm * 255 + 0.5).astype(np.uint8)).save(os.path.join(OUT, f'rock-{spec["name"]}-normal.jpg'),
                                                            quality=94, optimize=True, subsampling=0)   # 4:4:4: direction lives in chroma
    for kind, arr, q in (('albedo', alb, 88), ('normal', nrm, 90)):       # half-size copies for phones
        im = Image.fromarray((arr * 255 + 0.5).astype(np.uint8)).resize((tex_res // 2, tex_res // 2), Image.LANCZOS)
        im.save(os.path.join(OUT, f'rock-{spec["name"]}-{kind}-1k.jpg'), quality=q, optimize=True, **({'subsampling': 0} if kind == 'normal' else {}))
    log(spec['name'], 'textures written')
    # meshes (the mid surface), normals of the mid surface
    meshes = []
    fn = lambda dd: rk.r(dd, 'mid')
    for li, n in enumerate(LODS):
        dirs, F, uv = octasphere(n)
        r = fn(dirs)
        pos = r[:, None] * dirs
        nr = surface_normals(dirs, fn)
        meshes.append((f'{spec["name"]}_lod{li}', pos, nr, uv, F.ravel()))
    # radial collision table on a lat/lon grid (outermost surface = mid surface)
    lat = (np.arange(TAB_LAT) + 0.5) / TAB_LAT * np.pi - np.pi / 2
    lon = np.arange(TAB_LON) / TAB_LON * 2 * np.pi
    LA, LO = np.meshgrid(lat, lon, indexing='ij')
    dirs = np.stack([np.cos(LA) * np.cos(LO), np.sin(LA), np.cos(LA) * np.sin(LO)], -1).reshape(-1, 3)
    table = fn(dirs).reshape(TAB_LAT, TAB_LON)
    rmax = float(max(table.max(), np.max([np.linalg.norm(m[1], axis=1).max() for m in meshes])))
    info = {'name': spec['name'], 'rmean': 1.0, 'rmax': round(rmax, 4), 'rmin': round(float(table.min()), 4),
            'lods': [8 * n * n for n in LODS],
            'table': (np.round(table.ravel() / rmax * 65535)).astype(np.uint16).tobytes().hex()}
    return meshes, info


def detail_texture(res=1024):
    """Tileable close-up detail: grit, pits and cracks. rg = tangent normal xy, b = albedo modulation."""
    rng = np.random.default_rng(99)
    fy = np.fft.fftfreq(res)[:, None] * res
    fx = np.fft.fftfreq(res)[None, :] * res
    f = np.sqrt(fx * fx + fy * fy) + 1e-6
    h = np.zeros((res, res), np.float32)
    for c, a in ((6, 1.0), (18, 0.55), (48, 0.3), (130, 0.15)):
        w = np.fft.fft2(rng.standard_normal((res, res)))
        band = np.real(np.fft.ifft2(w * np.exp(-(np.log(f / c) ** 2) / 0.5))).astype(np.float32)
        h += a * band / band.std()
    # pits: a few hundred small round dimples (wrapped for tiling)
    yy, xx = np.mgrid[0:res, 0:res]
    for _ in range(420):
        cx, cy, r = rng.random() * res, rng.random() * res, rng.gamma(2.0, 3.5)
        dx = (xx - cx + res / 2) % res - res / 2
        dy = (yy - cy + res / 2) % res - res / 2
        rr = np.sqrt(dx * dx + dy * dy) / r
        m = rr < 1.6
        h[m] -= 1.6 * np.clip(1 - rr[m] ** 2, 0, 1) - 0.25 * np.exp(-((rr[m] - 1) / 0.25) ** 2)
    h = (h - h.mean()) / h.std()
    gx = (np.roll(h, -1, 1) - np.roll(h, 1, 1)) * 0.5
    gy = (np.roll(h, -1, 0) - np.roll(h, 1, 0)) * 0.5
    k = 0.9
    n = unit(np.stack([-gx * k, -gy * k, np.ones_like(h)], -1))      # the game samples it with flipY off: t runs down the rows
    alb = np.clip(0.5 + 0.13 * h, 0, 1)
    img = np.stack([n[..., 0] * 0.5 + 0.5, n[..., 1] * 0.5 + 0.5, alb], -1)
    Image.fromarray((img * 255 + 0.5).astype(np.uint8)).save(os.path.join(OUT, 'rock-detail.jpg'), quality=92, subsampling=0)


if __name__ == '__main__':
    all_meshes, infos = [], []
    for sp in SPECS:
        if ONLY and sp['name'] not in ONLY:
            continue
        m, info = build_rock(sp, RES)
        all_meshes += m
        infos.append(info)
        log(sp['name'], f"rmax {info['rmax']:.3f} rmin {info['rmin']:.3f}")
    if not ONLY:
        write_glb(os.path.join(OUT, 'rocks.glb'), all_meshes)
        json.dump({'lat': TAB_LAT, 'lon': TAB_LON, 'rocks': infos}, open(os.path.join(OUT, 'rocks.json'), 'w'))
        detail_texture()
        log('rocks.glb, rocks.json, rock-detail.jpg written')
