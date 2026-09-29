# Quick Cycles look at the ship geometry with flat per-kind materials.
#   /tmp/bvenv/bin/python preview.py out_prefix [views]
import sys, os, math
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bpy
import numpy as np
from lib import reset, KIND
import ship_geo

out = sys.argv[1]
views = sys.argv[2].split(',') if len(sys.argv) > 2 else ['hero', 'rear', 'side', 'top']
reset()
hull, glass, glow = ship_geo.build()
objs = [p.build(sharp_deg=38) for p in hull]
gobj = glass.build(sharp_deg=None)
glow_objs = [g.build() for g in glow.values()]
print('hull tris', sum(sum(len(pl.vertices) - 2 for pl in o.data.polygons) for o in objs))


def mat(name, col, rough, metal=0.0, emit=None, alpha=1.0):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value = (*col, 1)
    b.inputs['Roughness'].default_value = rough
    b.inputs['Metallic'].default_value = metal
    if emit:
        b.inputs['Emission Color'].default_value = (*emit, 1)
        b.inputs['Emission Strength'].default_value = 12
    if alpha < 1:
        b.inputs['Alpha'].default_value = alpha
    return m


M = [mat('paint', (0.80, 0.78, 0.72), 0.42), mat('dark', (0.05, 0.055, 0.06), 0.38, 0.85),
     mat('heat', (0.40, 0.37, 0.33), 0.30, 1.0), mat('black', (0.015, 0.015, 0.017), 0.6),
     mat('glass', (0.02, 0.025, 0.03), 0.03, 0.0, None, 0.35), mat('glow', (1, 0.6, 0.3), 0.5, 0, (1.0, 0.55, 0.25))]
for o in objs + [gobj] + glow_objs:
    for m in M:
        o.data.materials.append(m)
    k = np.zeros(len(o.data.polygons), np.float32)
    o.data.attributes['kind'].data.foreach_get('value', k)
    o.data.polygons.foreach_set('material_index', k.astype(np.int32))

sc = bpy.context.scene
sc.render.engine = 'CYCLES'
sc.cycles.samples = int(os.environ.get('SPP', 48))
sc.cycles.use_denoising = True
sc.render.resolution_x, sc.render.resolution_y = 1280, 720
sc.view_settings.view_transform = 'AgX'
w = bpy.data.worlds.new('w')
sc.world = w
w.use_nodes = True
w.node_tree.nodes['Background'].inputs['Color'].default_value = (0.035, 0.045, 0.07, 1)
w.node_tree.nodes['Background'].inputs['Strength'].default_value = 0.6
sun = bpy.data.objects.new('sun', bpy.data.lights.new('sun', 'SUN'))
sun.data.energy = 4.5
sun.data.angle = math.radians(1.5)
sun.rotation_euler = (math.radians(50), math.radians(-25), math.radians(35))
sc.collection.objects.link(sun)
rim = bpy.data.objects.new('rim', bpy.data.lights.new('rim', 'AREA'))
rim.data.energy = 3000
rim.data.size = 6
rim.location = (-12, -14, 6)
rim.rotation_euler = (math.radians(70), 0, math.radians(-40))
sc.collection.objects.link(rim)
cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam'))
sc.collection.objects.link(cam)
sc.camera = cam
VIEWS = {
    'hero': ((19.0, 16.5, 9.0), 38),
    'rear': ((-11.0, -26.0, 9.5), 34),
    'side': ((26.0, 0.5, 1.2), 34),
    'top': ((0.01, -0.5, 30.0), 36),
    'chase': ((0.0, -25.0, 5.0), 62),
    'nose': ((3.2, 9.5, 1.8), 40),
    'engine': ((4.0, -10.5, 1.5), 36),
}
for v in views:
    loc, fov = VIEWS[v]
    cam.location = loc
    cam.data.angle = math.radians(fov)
    d = -np.array(loc) + np.array([0, -0.3, 0.1])
    from mathutils import Vector
    cam.rotation_euler = Vector(d).to_track_quat('-Z', 'Y').to_euler()
    sc.render.filepath = f'{out}-{v}.png'
    bpy.ops.render.render(write_still=True)
    print('wrote', sc.render.filepath)
