# Mesh helpers for the Astra Adventures asset builds (Blender 5.0, used as the `bpy` Python module).
# Blender axes: +X right, +Y forward (the nose), +Z up. The glTF export turns +Y-forward into three.js -Z.
#
# Every part carries two attributes that the texture bake reads back:
#   kind (face, float)          0 paint, 1 dark metal, 2 heat metal, 3 black, 4 glass, 5 glow
#   pp   (point, float vector)  panel coordinates in metres (u, v) + a part id in z. Panel lines, rivets and
#                               markings are laid out in (u, v), so they run continuously across UV seams.
import math
import numpy as np
import bpy
import bmesh

KIND = {'paint': 0, 'dark': 1, 'heat': 2, 'black': 3, 'glass': 4, 'glow': 5}


def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)


def unit(v):
    v = np.asarray(v, float)
    n = np.linalg.norm(v, axis=-1, keepdims=True)
    return v / np.maximum(n, 1e-12)


# ---------------------------------------------------------------- 2D profiles
def rounded_chain(P, R, K, E, closed=False):
    """Fillet a polyline. P: (n,2) vertices; R: radius per vertex (0 = keep the vertex); K: arc points per
    vertex; E: extra points on each edge. Point counts depend only on K and E, never on the geometry, so
    sections built from the same recipe always loft together."""
    P = np.asarray(P, float)
    n = len(P)
    corners = []
    for i in range(n):
        if not closed and (i == 0 or i == n - 1) or R[i] <= 0 or K[i] <= 1:
            corners.append(np.array([P[i]]))
            continue
        A, V, B = P[i - 1], P[i], P[(i + 1) % n]
        u1, u2 = unit(A - V), unit(B - V)
        th = math.acos(float(np.clip(np.dot(u1, u2), -1, 1)))
        if th > math.radians(179.5):
            corners.append(np.repeat(V[None], K[i], 0))
            continue
        t = R[i] / math.tan(th / 2)
        t = min(t, 0.45 * np.linalg.norm(A - V), 0.45 * np.linalg.norm(B - V))
        r = t * math.tan(th / 2)
        T1, T2 = V + u1 * t, V + u2 * t
        C = V + unit(u1 + u2) * (r / math.sin(th / 2))
        a1 = math.atan2(*(T1 - C)[::-1])
        a2 = math.atan2(*(T2 - C)[::-1])
        d = (a2 - a1 + math.pi) % (2 * math.pi) - math.pi
        s = np.linspace(0, 1, K[i])
        corners.append(np.stack([C[0] + r * np.cos(a1 + d * s), C[1] + r * np.sin(a1 + d * s)], 1))
    out = []
    m = n if closed else n - 1
    for i in range(n):
        out.append(corners[i])
        if i < m:
            a, b = corners[i][-1], corners[(i + 1) % n][0]
            e = E[i]
            if e > 0:
                s = np.linspace(0, 1, e + 2)[1:-1, None]
                out.append(a + (b - a) * s)
    return np.concatenate(out, 0)


def arclen(pts, closed=False):
    d = np.linalg.norm(np.diff(pts, axis=0), axis=1)
    return np.concatenate([[0], np.cumsum(d)])


# ---------------------------------------------------------------- surfaces
def grid_faces(m, n, closed=True, flip=False):
    """Quads between m consecutive rings of n points."""
    faces = []
    nn = n if closed else n - 1
    for i in range(m - 1):
        for j in range(nn):
            j1 = (j + 1) % n
            f = [i * n + j, i * n + j1, (i + 1) * n + j1, (i + 1) * n + j]
            faces.append(f[::-1] if flip else f)
    return faces


def fan(center_idx, ring_idx, verts, want):
    """Triangle fan from a centre vertex to a ring, wound so the normal points along `want`."""
    faces = []
    n = len(ring_idx)
    for j in range(n):
        a, b = ring_idx[j], ring_idx[(j + 1) % n]
        f = [center_idx, a, b]
        nrm = np.cross(verts[a] - verts[center_idx], verts[b] - verts[center_idx])
        if np.dot(nrm, want) < 0:
            f = [center_idx, b, a]
        faces.append(f)
    return faces


def revolve(profile, n=48, center=(0.0, 0.0), axis='y', theta0=0.0, rref=None):
    """Surface of revolution about an axis parallel to Y through (x, z) = center.
    profile: (m, 2) of (y, r). A profile that runs backward (-y) on the outside faces outward; one that runs
    forward on the inside faces the axis, so a duct is visible from within.
    Returns verts (m*n, 3), faces, pp (u = y, v = arc length at rref)."""
    prof = np.asarray(profile, float)
    th = theta0 + np.linspace(0, 2 * np.pi, n, endpoint=False)
    cx, cz = center
    y = prof[:, 0][:, None].repeat(n, 1)
    r = prof[:, 1][:, None]
    V = np.stack([cx + r * np.cos(th)[None], y, cz + r * np.sin(th)[None]], -1).reshape(-1, 3)
    rr = rref if rref is not None else float(prof[:, 1].max())
    # seam of v at theta = -90 degrees (the underside); v measured symmetrically from the top
    ang = (th - np.pi / 2 + np.pi) % (2 * np.pi) - np.pi
    pp = np.stack([y, (ang * rr)[None].repeat(len(prof), 0)], -1).reshape(-1, 2)
    return V, grid_faces(len(prof), n, True), pp


def lathe(profile, n=48, center=(0.0, 0.0), theta0=0.0, rref=None):
    """Like revolve(), but a profile point with r == 0 becomes a single pole vertex (fanned), so spheres,
    cones and spinners close without degenerate quads. Also returns the profile segment index of every
    face, so kinds can be assigned per segment."""
    prof = np.asarray(profile, float)
    cx, cz = center
    th = theta0 + np.linspace(0, 2 * np.pi, n, endpoint=False)
    rr = rref if rref is not None else float(prof[:, 1].max())
    ang = (th - np.pi / 2 + np.pi) % (2 * np.pi) - np.pi
    V, PP, idx = [], [], []
    for (y, r) in prof:
        if r <= 1e-9:
            idx.append([len(V)])
            V.append((cx, y, cz))
            PP.append((y, 0.0))
        else:
            idx.append(list(range(len(V), len(V) + n)))
            for t, a in zip(th, ang):
                V.append((cx + r * math.cos(t), y, cz + r * math.sin(t)))
                PP.append((y, a * rr))
    V = np.array(V)
    F, row = [], []
    for i in range(len(prof) - 1):
        A, B = idx[i], idx[i + 1]
        if len(A) == 1 and len(B) == 1:
            continue
        if len(A) == 1 or len(B) == 1:
            pole, ring = (A[0], B) if len(A) == 1 else (B[0], A)
            for j in range(n):
                a, b = ring[j], ring[(j + 1) % n]
                # same winding rule as the quads: ring direction x profile direction
                f = [pole, b, a] if len(A) == 1 else [a, b, pole]
                F.append(f)
                row.append(i)
            continue
        for j in range(n):
            j1 = (j + 1) % n
            F.append([A[j], A[j1], B[j1], B[j]])
            row.append(i)
    return V, F, np.array(PP), np.array(row)


def sweep(path, ups, prof, closed_path=False, caps=True):
    """Sweep a closed 2D profile (k,2) along a 3D path with per-point up vectors. Profile x runs along the
    side vector, profile y along up. Returns verts, faces, pp (u = distance along path, v = profile arc)."""
    path = np.asarray(path, float)
    ups = np.asarray(ups, float)
    m = len(path)
    if closed_path:
        T = unit(np.roll(path, -1, 0) - np.roll(path, 1, 0))
    else:
        T = unit(np.gradient(path, axis=0))
    U = unit(ups - (ups * T).sum(1, keepdims=True) * T)
    S = np.cross(T, U)
    prof = np.asarray(prof, float)
    V = path[:, None, :] + prof[None, :, 0:1] * S[:, None, :] + prof[None, :, 1:2] * U[:, None, :]
    k = len(prof)
    verts = V.reshape(-1, 3)
    faces = grid_faces(m, k, True)
    if closed_path:
        for j in range(k):
            j1 = (j + 1) % k
            faces.append([(m - 1) * k + j, (m - 1) * k + j1, j1, j])
    s = arclen(path)
    pv = arclen(np.concatenate([prof, prof[:1]]))[:-1]
    pp = np.stack([s[:, None].repeat(k, 1), pv[None].repeat(m, 0)], -1).reshape(-1, 2)
    if caps and not closed_path:
        verts = np.concatenate([verts, path[:1], path[-1:]])
        c0, c1 = len(verts) - 2, len(verts) - 1
        faces += fan(c0, list(range(k)), verts, -T[0])
        faces += fan(c1, list(range((m - 1) * k, m * k)), verts, T[-1])
        pp = np.concatenate([pp, pp[:1], pp[-1:]])
    return verts, faces, pp


def rrect(hw, hh, r, k=4):
    """Closed rounded rectangle, counter-clockwise, (4k,2)."""
    r = min(r, hw * 0.999, hh * 0.999)
    pts = []
    for cx, cy, a0 in ((hw - r, hh - r, 0), (-hw + r, hh - r, 90), (-hw + r, -hh + r, 180), (hw - r, -hh + r, 270)):
        for t in np.linspace(0, 90, k):
            a = math.radians(a0 + t)
            pts.append((cx + r * math.cos(a), cy + r * math.sin(a)))
    return np.array(pts)


def rbox(center, size, r, seg=3):
    """Rounded box via bmesh bevel. size = full extents (x, y, z). Returns verts, faces, pp."""
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    for v in bm.verts:
        v.co.x *= size[0]
        v.co.y *= size[1]
        v.co.z *= size[2]
    if r > 0:
        bmesh.ops.bevel(bm, geom=list(bm.edges), offset=min(r, min(size) * 0.49), segments=seg,
                        profile=0.5, affect='EDGES', clamp_overlap=True)
    verts = np.array([v.co[:] for v in bm.verts]) + np.asarray(center, float)
    faces = [[v.index for v in f.verts] for f in bm.faces]
    bm.free()
    pp = np.stack([verts[:, 1], verts[:, 0] + verts[:, 2]], 1)
    return verts, faces, pp


def solid(verts, faces):
    """Wind a closed solid outward (flip every face when the signed volume comes out negative)."""
    verts = np.asarray(verts, float)
    if signed_volume(verts, faces) < 0:
        faces = [f[::-1] for f in faces]
    return verts, faces


def slab(top, nrm, thick):
    """Closed plate from a (a, b, 3) grid of top-surface points and their normals, `thick` deep."""
    a, b, _ = top.shape
    bot = top - nrm * thick
    V = np.concatenate([top.reshape(-1, 3), bot.reshape(-1, 3)])
    o = a * b
    F = []
    for i in range(a - 1):
        for j in range(b - 1):
            q = [i * b + j, i * b + j + 1, (i + 1) * b + j + 1, (i + 1) * b + j]
            F.append(q)
            F.append([o + k for k in q[::-1]])
    ring = [(0, j) for j in range(b)] + [(i, b - 1) for i in range(1, a)] + \
           [(a - 1, j) for j in range(b - 2, -1, -1)] + [(i, 0) for i in range(a - 2, 0, -1)]
    for k in range(len(ring)):
        p, q = ring[k], ring[(k + 1) % len(ring)]
        i0, i1 = p[0] * b + p[1], q[0] * b + q[1]
        F.append([i0, o + i0, o + i1, i1])
    return solid(V, F)


def signed_volume(verts, faces):
    c = verts.mean(0)
    vol = 0.0
    for f in faces:
        a = verts[f[0]] - c
        for i in range(1, len(f) - 1):
            vol += np.dot(a, np.cross(verts[f[i]] - c, verts[f[i + 1]] - c))
    return vol / 6


# ---------------------------------------------------------------- part accumulator
class Part:
    """Collects pieces for one Blender object; each piece has its own kind(s) and panel coordinates."""

    def __init__(self, name, part_id):
        self.name, self.id = name, part_id
        self.V, self.F, self.K, self.PP = [], [], [], []
        self.nv = 0

    def add(self, verts, faces, kind='paint', pp=None, kinds=None, flip=False):
        verts = np.asarray(verts, float).reshape(-1, 3)
        if pp is None:
            pp = np.stack([verts[:, 1], verts[:, 0]], 1)
        self.V.append(verts)
        self.PP.append(np.asarray(pp, float).reshape(-1, 2))
        for fi, f in enumerate(faces):
            f = [self.nv + i for i in f]
            self.F.append(f[::-1] if flip else f)
            self.K.append(KIND[kinds[fi]] if kinds is not None and isinstance(kinds[fi], str)
                          else (kinds[fi] if kinds is not None else KIND[kind]))
        self.nv += len(verts)
        return self

    def mirrored(self, name, part_id):
        """A copy mirrored across X (left <-> right), windings reversed so normals stay outward."""
        m = Part(name, part_id)
        for V, PP in zip(self.V, self.PP):
            V2 = V.copy()
            V2[:, 0] *= -1
            m.V.append(V2)
            m.PP.append(PP.copy())
        m.F = [f[::-1] for f in self.F]
        m.K = list(self.K)
        m.nv = self.nv
        return m

    def build(self, smooth=True, sharp_deg=None, collection=None):
        V = np.concatenate(self.V, 0)
        PP = np.concatenate(self.PP, 0)
        me = bpy.data.meshes.new(self.name)
        me.from_pydata(V.tolist(), [], self.F)
        me.update()
        assert len(me.polygons) == len(self.F), (self.name, len(me.polygons), len(self.F))
        a = me.attributes.new('kind', 'FLOAT', 'FACE')
        a.data.foreach_set('value', np.asarray(self.K, np.float32))
        pa = np.zeros((len(V), 3), np.float32)
        pa[:, :2] = PP
        pa[:, 2] = self.id
        b = me.attributes.new('pp', 'FLOAT_VECTOR', 'POINT')
        b.data.foreach_set('vector', pa.ravel())
        if smooth:
            me.shade_smooth()
        if sharp_deg is not None:
            me.set_sharp_from_angle(angle=math.radians(sharp_deg))
        ob = bpy.data.objects.new(self.name, me)
        (collection or bpy.context.scene.collection).objects.link(ob)
        return ob


def join(objs, name):
    bpy.ops.object.select_all(action='DESELECT')
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    bpy.ops.object.join()
    ob = bpy.context.view_layer.objects.active
    ob.name = name
    ob.data.name = name
    return ob


# ---------------------------------------------------------------- UV packing
def uv_islands(bm, uvl):
    """Faces grouped into UV islands (connected through edges whose UVs match on both sides)."""
    bm.faces.ensure_lookup_table()
    parent = list(range(len(bm.faces)))

    def find(i):
        while parent[i] != i:
            parent[i] = parent[parent[i]]
            i = parent[i]
        return i
    for e in bm.edges:
        lf = e.link_faces
        if len(lf) != 2:
            continue
        a, b = lf
        ua = {l.vert.index: l[uvl].uv for l in a.loops if l.vert in e.verts}
        ub = {l.vert.index: l[uvl].uv for l in b.loops if l.vert in e.verts}
        if len(ua) == 2 and all((ua[k] - ub[k]).length < 1e-6 for k in ua):
            ra, rb = find(a.index), find(b.index)
            if ra != rb:
                parent[ra] = rb
    isl = {}
    for f in bm.faces:
        isl.setdefault(find(f.index), []).append(f)
    return list(isl.values())


def skyline_pack(sizes, W=1.0, H=1.0):
    """Bottom-left skyline packing of (w, h) rectangles into W x H, trying both orientations.
    Returns [(x, y, rotated)] or None if they don't all fit."""
    n = len(sizes)
    order = sorted(range(n), key=lambda i: -max(sizes[i]))
    X, Y, Wd = [0.0], [0.0], [W]
    out = [None] * n
    for i in order:
        best = None
        for rot in (0, 1):
            w, h = (sizes[i][1], sizes[i][0]) if rot else sizes[i]
            if w > W + 1e-12 or h > H + 1e-12:
                continue
            ns = len(X)
            for j in range(ns):
                x = X[j]
                if x + w > W + 1e-9:
                    break
                y, k, end = Y[j], j + 1, x + w - 1e-12
                while k < ns and X[k] < end:
                    if Y[k] > y:
                        y = Y[k]
                    k += 1
                top = y + h
                if top > H + 1e-9:
                    continue
                if best is None or top < best[0] - 1e-12 or (abs(top - best[0]) <= 1e-12 and x < best[1]):
                    best = (top, x, y, w, h, rot)
        if best is None:
            return None
        top, x, y, w, h, rot = best
        out[i] = (x, y, rot)
        segs = []
        for sx, sy, sw in zip(X, Y, Wd):
            ex = sx + sw
            if ex <= x + 1e-12 or sx >= x + w - 1e-12:
                segs.append((sx, sy, sw))
                continue
            if sx < x:
                segs.append((sx, sy, x - sx))
            if ex > x + w:
                segs.append((x + w, sy, ex - (x + w)))
        segs.append((x, top, w))
        segs.sort()
        X, Y, Wd = [], [], []
        for sx, sy, sw in segs:
            if X and abs(Y[-1] - sy) < 1e-12 and abs(X[-1] + Wd[-1] - sx) < 1e-9:
                Wd[-1] += sw
            else:
                X.append(sx)
                Y.append(sy)
                Wd.append(sw)
    return out


def pack_uvs(obj, weight, margin=0.003, iters=10):
    """Re-pack an object's UV islands with a skyline packer (Blender's own packer, run as a module, leaves most
    of the texture empty). weight(faces) -> linear texel-density multiplier per island. Call in edit mode."""
    import bmesh
    bm = bmesh.from_edit_mesh(obj.data)
    uvl = bm.loops.layers.uv.active
    islands = uv_islands(bm, uvl)
    info = []
    for faces in islands:
        uv = np.array([l[uvl].uv[:] for f in faces for l in f.loops])
        lo, hi = uv.min(0), uv.max(0)
        wgt = weight(faces)
        info.append((lo, np.maximum(hi - lo, 1e-6), wgt))
    tot = sum(float(sz[0] * sz[1]) * w * w for lo, sz, w in info)

    def attempt(g):
        return skyline_pack([(float(sz[0] * w * g + margin), float(sz[1] * w * g + margin)) for lo, sz, w in info])
    g_lo, g_hi = 0.5 / math.sqrt(tot), 1.0 / math.sqrt(tot)
    best = attempt(g_lo)
    while best is None:
        g_lo *= 0.8
        best = attempt(g_lo)
    for _ in range(iters):
        g = (g_lo + g_hi) / 2
        r = attempt(g)
        if r is not None:
            g_lo, best = g, r
        else:
            g_hi = g
    g = g_lo
    for (x, y, rot), (lo, sz, w), faces in zip(best, info, islands):
        s = w * g
        x0, y0 = x + margin / 2, y + margin / 2
        for f in faces:
            for l in f.loops:
                q = (np.array(l[uvl].uv[:]) - lo) * s
                if rot:
                    q = np.array([q[1], sz[0] * s - q[0]])
                l[uvl].uv = (x0 + q[0], y0 + q[1])
    bmesh.update_edit_mesh(obj.data)
    return len(islands), tot * g * g


def uv_area(o):
    """Area of an object's active UV map (fraction of the unit square covered by its faces)."""
    me = o.data
    uv = np.zeros(len(me.loops) * 2)
    me.uv_layers.active.data.foreach_get('uv', uv)
    uv = uv.reshape(-1, 2)
    li = np.zeros(len(me.polygons), np.int64)
    lt = np.zeros(len(me.polygons), np.int64)
    me.polygons.foreach_get('loop_start', li)
    me.polygons.foreach_get('loop_total', lt)
    A = 0.0
    for s0, n in zip(li, lt):
        q = uv[s0:s0 + n]
        A += 0.5 * abs(np.dot(q[:, 0], np.roll(q[:, 1], 1)) - np.dot(q[:, 1], np.roll(q[:, 0], 1)))
    return A
