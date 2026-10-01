# An old upright arcade cabinet for "Clawd: Coming Up": the film opens by pushing into its screen and ends
# back in front of it. Side panels from an extruded profile, a bezel and screen recess, a control panel with a
# joystick and buttons, a coin door with lit slots, a marquee box (the sign is a separate mesh so the film can
# light it), a kick plate and T-molding. The screen is its own mesh, `Screen`, with 0..1 UVs, so the film can
# play the inside world on it. Units: metres, Z up, the front faces -Y (three.js +Z after the glTF export).
#   /tmp/bvenv/bin/python tools/blender_cabinet.py   -> assets/comingup/cabinet.glb
import math
import os
import bpy
import bmesh

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, '..', 'assets', 'comingup', 'cabinet.glb')
bpy.ops.wm.read_factory_settings(use_empty=True)


def mat(name, rgb, rough, metal=0.0, emit=None, strength=1.0):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value = (*rgb, 1)
    b.inputs['Roughness'].default_value = rough
    b.inputs['Metallic'].default_value = metal
    if emit:
        b.inputs['Emission Color'].default_value = (*emit, 1)
        b.inputs['Emission Strength'].default_value = strength
    return m


WOOD = mat('CabBody', (0.035, 0.03, 0.04), 0.55)
ART = mat('CabArt', (0.60, 0.22, 0.12), 0.45)
TRIM = mat('CabTrim', (0.02, 0.02, 0.02), 0.35, 0.3)
CHROME = mat('CabChrome', (0.8, 0.8, 0.82), 0.2, 1.0)
BEZEL = mat('CabBezel', (0.01, 0.01, 0.012), 0.6)
PANEL = mat('CabPanel', (0.08, 0.06, 0.12), 0.5)
RED = mat('BtnRed', (0.8, 0.05, 0.04), 0.3, emit=(0.9, 0.08, 0.05), strength=0.4)
BLUE = mat('BtnBlue', (0.05, 0.25, 0.9), 0.3, emit=(0.1, 0.3, 1.0), strength=0.4)
YEL = mat('BtnYellow', (0.95, 0.75, 0.1), 0.3, emit=(1.0, 0.75, 0.1), strength=0.4)
COIN = mat('CoinLight', (1.0, 0.3, 0.2), 0.4, emit=(1.0, 0.25, 0.15), strength=3.0)
MARQ = mat('Marquee', (1.0, 0.75, 0.55), 0.4, emit=(1.0, 0.62, 0.40), strength=4.0)
SCREEN = mat('Screen', (0.0, 0.0, 0.0), 0.15, emit=(0.2, 0.2, 0.3), strength=1.0)
GLASS = mat('ScreenGlass', (0.01, 0.01, 0.015), 0.05)


def obj(name, bm, material, smooth=False):
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    ob = bpy.data.objects.new(name, me)
    bpy.context.collection.objects.link(ob)
    me.materials.append(material)
    if smooth:
        for p in me.polygons:
            p.use_smooth = True
    return ob


def box(name, c, s, material, bevel=0.0):
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    for v in bm.verts:
        v.co.x, v.co.y, v.co.z = c[0] + v.co.x * s[0], c[1] + v.co.y * s[1], c[2] + v.co.z * s[2]
    ob = obj(name, bm, material)
    if bevel:
        m = ob.modifiers.new('b', 'BEVEL'); m.width = bevel; m.segments = 3; m.limit_method = 'ANGLE'
        bpy.context.view_layer.objects.active = ob; ob.select_set(True)
        bpy.ops.object.modifier_apply(modifier='b'); ob.select_set(False)
        for p in ob.data.polygons:
            p.use_smooth = True
    return ob


def extrude_profile(name, pts, x0, x1, material):
    """A side panel: the profile (y, z) points, extruded along X from x0 to x1."""
    bm = bmesh.new()
    a = [bm.verts.new((x0, y, z)) for y, z in pts]
    b = [bm.verts.new((x1, y, z)) for y, z in pts]
    bm.faces.new(a[::-1])
    bm.faces.new(b)
    n = len(pts)
    for i in range(n):
        j = (i + 1) % n
        bm.faces.new((a[i], a[j], b[j], b[i]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return obj(name, bm, material)


# Side profile (y forward is negative = toward the player; z up). Classic upright: tall back, sloped screen,
# control-panel shelf, straight front below.
W = 0.68                                     # cabinet width
PROF = [(0.32, 0.0), (0.32, 1.86), (0.12, 1.86), (-0.06, 1.62), (-0.12, 1.60), (-0.16, 1.22), (-0.40, 1.06),
        (-0.40, 0.96), (-0.20, 0.92), (-0.20, 0.0)]
for sx, nm in ((-1, 'SideL'), (1, 'SideR')):
    extrude_profile(nm, PROF, W / 2 if sx > 0 else -W / 2 - 0.025, W / 2 + 0.025 if sx > 0 else -W / 2, WOOD)
# orange side art stripes (thin slabs just outside each side panel)
for sx in (-1, 1):
    for k, (z0, z1) in enumerate(((0.30, 0.36), (0.40, 0.43))):
        box(f'Stripe{sx}{k}', (sx * (W / 2 + 0.028), 0.05, (z0 + z1) / 2), (0.004, 0.46, z1 - z0), ART)
# the body between the sides
box('Back', (0, 0.30, 0.93), (W, 0.04, 1.86), WOOD)
box('Front', (0, -0.20, 0.46), (W, 0.03, 0.92), WOOD)
box('Kick', (0, -0.215, 0.06), (W, 0.01, 0.12), TRIM)
# coin door with two lit slots
box('CoinDoor', (0, -0.22, 0.52), (0.26, 0.012, 0.30), CHROME, bevel=0.006)
for x in (-0.06, 0.06):
    box(f'CoinSlot{x}', (x, -0.228, 0.60), (0.03, 0.006, 0.05), COIN)
    box(f'CoinRet{x}', (x, -0.228, 0.46), (0.05, 0.008, 0.04), TRIM)
# control panel: a sloped shelf
cp = bmesh.new()
pts = [(-0.40, 0.96), (-0.40, 1.06), (-0.16, 1.22), (-0.16, 1.18), (-0.20, 0.92)]
a = [cp.verts.new((-W / 2, y, z)) for y, z in pts]
b = [cp.verts.new((W / 2, y, z)) for y, z in pts]
cp.faces.new(a[::-1]); cp.faces.new(b)
for i in range(len(pts)):
    j = (i + 1) % len(pts)
    cp.faces.new((a[i], a[j], b[j], b[i]))
bmesh.ops.recalc_face_normals(cp, faces=cp.faces)
obj('ControlPanel', cp, PANEL)
# panel top surface frame: joystick and buttons sit on the slope from (-0.40, 1.06) to (-0.16, 1.22)
slope = math.atan2(1.22 - 1.06, -0.16 + 0.40)


def on_panel(u, x):
    """A point on the control panel's top at fraction u along the slope, x across."""
    return (x, -0.40 + u * 0.24, 1.06 + u * 0.16)


jx, jy, jz = on_panel(0.45, -0.17)
bm = bmesh.new()
bmesh.ops.create_cone(bm, cap_ends=True, segments=16, radius1=0.008, radius2=0.008, depth=0.10)
for v in bm.verts:
    v.co.z += 0.05
    v.co.x += jx; v.co.y += jy; v.co.z += jz
obj('JoyShaft', bm, CHROME, smooth=True)
bm = bmesh.new()
bmesh.ops.create_uvsphere(bm, u_segments=20, v_segments=12, radius=0.028)
for v in bm.verts:
    v.co.x += jx; v.co.y += jy; v.co.z += jz + 0.11
obj('JoyBall', bm, RED, smooth=True)
for k, (x, m) in enumerate(((0.02, RED), (0.09, BLUE), (0.16, YEL), (0.055, BLUE), (0.125, YEL))):
    u = 0.38 if k < 3 else 0.64
    bx, by, bz = on_panel(u, x)
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, segments=20, radius1=0.018, radius2=0.016, depth=0.016)
    for v in bm.verts:
        v.co.x += bx; v.co.y += by; v.co.z += bz + 0.008
    obj(f'Button{k}', bm, m, smooth=True)
# screen bezel: a dark frame on the slope from (-0.16, 1.22) to (-0.06, 1.62), the screen set into it
sy0, sz0, sy1, sz1 = -0.155, 1.25, -0.075, 1.58
tilt = math.atan2(sz1 - sz0, sy1 - sy0)


def slab_on_screen(name, w, h, inset, material, uv=False):
    """A rectangle on the screen's slope, centred, inset behind the bezel face by `inset`."""
    cy, cz = (sy0 + sy1) / 2, (sz0 + sz1) / 2
    ny, nz = math.sin(tilt), -math.cos(tilt)            # the slope's outward normal (toward the player)
    ty, tz = math.cos(tilt), math.sin(tilt)             # up the slope
    bm = bmesh.new()
    uvl = bm.loops.layers.uv.new('UVMap')
    corners = [(-w / 2, -h / 2, 0, 0), (w / 2, -h / 2, 1, 0), (w / 2, h / 2, 1, 1), (-w / 2, h / 2, 0, 1)]
    vs = [bm.verts.new((x, cy + ty * v + ny * -inset, cz + tz * v + nz * -inset)) for x, v, _, _ in corners]
    f = bm.faces.new(vs)
    for loop, (_, _, u, vv) in zip(f.loops, corners):
        loop[uvl].uv = (u, vv)
    bmesh.ops.recalc_face_normals(bm, faces=[f])
    if f.normal.y > 0:                                   # face the player
        f.normal_flip()
    return obj(name, bm, material)


L = math.hypot(sy1 - sy0, sz1 - sz0)
box('BezelBack', (0, (sy0 + sy1) / 2 + 0.03, (sz0 + sz1) / 2), (W - 0.02, 0.04, L + 0.06), BEZEL)
slab_on_screen('Screen', 0.52, 0.39, 0.012, SCREEN, uv=True)
slab_on_screen('ScreenGlass', 0.60, 0.46, -0.004, GLASS)
# marquee box at the top: the lit sign is its own mesh
box('MarqueeBox', (0, 0.10, 1.76), (W, 0.10, 0.18), WOOD)
slab = bmesh.new()
uvl = slab.loops.layers.uv.new('UVMap')
cs = [(-0.30, 1.69, 0, 0), (0.30, 1.69, 1, 0), (0.30, 1.83, 1, 1), (-0.30, 1.83, 0, 1)]
vs = [slab.verts.new((x, 0.045, z)) for x, z, _, _ in cs]
f = slab.faces.new(vs)
for loop, (_, _, u, v) in zip(f.loops, cs):
    loop[uvl].uv = (u, v)
bmesh.ops.recalc_face_normals(slab, faces=[f])
if f.normal.y > 0:
    f.normal_flip()
obj('Marquee', slab, MARQ)
# T-molding along the front edges of both sides
for sx in (-1, 1):
    for (y0, z0), (y1, z1) in zip(PROF[2:-1], PROF[3:]):
        bm = bmesh.new()
        L2 = math.hypot(y1 - y0, z1 - z0)
        bmesh.ops.create_cube(bm, size=1.0)
        ang = math.atan2(z1 - z0, y1 - y0)
        for v in bm.verts:
            ly, lz = v.co.y * L2, v.co.z * 0.012
            v.co.x = sx * (W / 2 + 0.012) + v.co.x * 0.03
            v.co.y = (y0 + y1) / 2 + ly * math.cos(ang) - lz * math.sin(ang)
            v.co.z = (z0 + z1) / 2 + ly * math.sin(ang) + lz * math.cos(ang)
        obj(f'TMold{sx}', bm, ART)

os.makedirs(os.path.dirname(OUT), exist_ok=True)
bpy.ops.export_scene.gltf(filepath=OUT, export_format='GLB', export_yup=True, export_apply=True,
                          export_materials='EXPORT', export_cameras=False, export_lights=False, export_texcoords=True)
print('wrote', OUT, os.path.getsize(OUT), 'bytes', len(bpy.data.objects), 'objects')
