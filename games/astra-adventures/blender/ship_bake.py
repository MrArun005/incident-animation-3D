# Stage A: build the ship, UV-unwrap the hull, and bake the geometry buffers the texture synthesis reads.
#   /tmp/bvenv/bin/python ship_bake.py [res]
# Writes build/ship.blend and build/buf_*.npy (float16):
#   pos   object-space position        nrm   shading normal
#   pp    panel coords u, v + part id   misc  kind, bevel edge mask, ambient occlusion
import sys, os, math, time, json
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import bpy
import numpy as np
from lib import reset, join
import ship_geo

RES = int(sys.argv[1]) if len(sys.argv) > 1 else 4096
OUT = os.path.join(HERE, 'build')
os.makedirs(OUT, exist_ok=True)
t0 = time.time()
reset()
hull_parts, glass, glow = ship_geo.build()
objs = [p.build(sharp_deg=38) for p in hull_parts]
hull = join(objs, 'Hull')
gobj = glass.build()
glow_objs = [g.build() for g in glow.values()]
print(f'hull: {len(hull.data.polygons)} faces, {len(hull.data.vertices)} verts ({time.time()-t0:.1f}s)')

# ---- UVs: smart project, equalise texel density, pack with rotation
bpy.ops.object.select_all(action='DESELECT')
hull.select_set(True)
bpy.context.view_layer.objects.active = hull
bpy.ops.object.mode_set(mode='EDIT')
bpy.ops.mesh.select_all(action='SELECT')
bpy.ops.uv.smart_project(angle_limit=math.radians(52), island_margin=0.0, area_weight=0.0, correct_aspect=True,
                         scale_to_bounds=False, rotate_method='AXIS_ALIGNED')
bpy.ops.uv.average_islands_scale()
# texel priority: the painted skin gets the most texels, the insides of ducts and the cockpit the fewest.
import bmesh
from lib import pack_uvs
_bm = bmesh.from_edit_mesh(hull.data)
_kl = _bm.faces.layers.float.get('kind')
_pl = _bm.verts.layers.float_vector.get('pp')
PRI = {0: 1.10, 1: 0.85, 2: 0.95, 3: 0.55}


def weight(faces):
    w = {}
    for f in faces:
        k = int(round(f[_kl]))
        key = 3 if int(round(f.verts[0][_pl].z)) == 3 else k
        w[key] = w.get(key, 0) + f.calc_area()
    return PRI.get(max(w, key=w.get), 1.0)


n_isl, used = pack_uvs(hull, weight, margin=0.0032)
print(f'uv islands {n_isl}, {used*100:.1f}% of the texture covered')
bpy.ops.object.mode_set(mode='OBJECT')
from lib import uv_area
print(f'uv done ({time.time()-t0:.1f}s), polygon area {uv_area(hull):.3f}')
hull.select_set(False)
for o in [gobj] + glow_objs:
    o.select_set(True)
    bpy.context.view_layer.objects.active = o
    bpy.ops.object.mode_set(mode='EDIT')
    bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.uv.smart_project(angle_limit=math.radians(66), island_margin=0.02)
    bpy.ops.object.mode_set(mode='OBJECT')
    o.select_set(False)
hull.select_set(True)
bpy.context.view_layer.objects.active = hull

# ---- bake setup
sc = bpy.context.scene
sc.render.engine = 'CYCLES'
sc.cycles.device = 'CPU'
sc.render.bake.margin = 14
sc.render.bake.margin_type = 'ADJACENT_FACES'
for o in [gobj] + glow_objs:
    o.hide_render = True
mat = bpy.data.materials.new('bake')
mat.use_nodes = True
nt = mat.node_tree
for n in list(nt.nodes):
    nt.nodes.remove(n)
outn = nt.nodes.new('ShaderNodeOutputMaterial')
emit = nt.nodes.new('ShaderNodeEmission')
nt.links.new(emit.outputs[0], outn.inputs['Surface'])
imgn = nt.nodes.new('ShaderNodeTexImage')
hull.data.materials.clear()
hull.data.materials.append(mat)
nt.nodes.active = imgn


def bake(name, color_socket, spp, res):
    img = bpy.data.images.new(name, res, res, alpha=False, float_buffer=True)
    img.colorspace_settings.name = 'Non-Color'
    imgn.image = img
    for l in list(emit.inputs['Color'].links):
        nt.links.remove(l)
    nt.links.new(color_socket, emit.inputs['Color'])
    sc.cycles.samples = spp
    t = time.time()
    bpy.ops.object.bake(type='EMIT', use_clear=True, margin=14, margin_type='ADJACENT_FACES')
    a = np.empty(res * res * 4, np.float32)
    img.pixels.foreach_get(a)
    a = a.reshape(res, res, 4)[::-1, :, :3]            # row 0 = top of the texture (v = 1)
    np.save(os.path.join(OUT, f'buf_{name}.npy'), a if name in ('pos', 'pp') else a.astype(np.float16))
    print(f'baked {name} {res}px {spp}spp in {time.time()-t:.1f}s')
    bpy.data.images.remove(img)


geo = nt.nodes.new('ShaderNodeNewGeometry')
bake('pos', geo.outputs['Position'], 1, RES)
bake('nrm', geo.outputs['Normal'], 1, RES)
attr = nt.nodes.new('ShaderNodeAttribute')
attr.attribute_name = 'pp'
bake('pp', attr.outputs['Vector'], 1, RES)
# misc: kind (face attribute), bevel edge mask, ambient occlusion
ka = nt.nodes.new('ShaderNodeAttribute')
ka.attribute_name = 'kind'
bev = nt.nodes.new('ShaderNodeBevel')
bev.samples = 8
bev.inputs['Radius'].default_value = 0.014
dot = nt.nodes.new('ShaderNodeVectorMath')
dot.operation = 'DOT_PRODUCT'
nt.links.new(bev.outputs['Normal'], dot.inputs[0])
nt.links.new(geo.outputs['Normal'], dot.inputs[1])
edge = nt.nodes.new('ShaderNodeMath')
edge.operation = 'SUBTRACT'
edge.inputs[0].default_value = 1.0
nt.links.new(dot.outputs['Value'], edge.inputs[1])
ao = nt.nodes.new('ShaderNodeAmbientOcclusion')
ao.samples = 12
ao.inputs['Distance'].default_value = 0.9
comb = nt.nodes.new('ShaderNodeCombineXYZ')
nt.links.new(ka.outputs['Fac'], comb.inputs[0])
nt.links.new(edge.outputs['Value'], comb.inputs[1])
nt.links.new(ao.outputs['AO'], comb.inputs[2])
bake('misc', comb.outputs['Vector'], 10, RES)

hull.data.materials.clear()
for o in [gobj] + glow_objs:
    o.hide_render = False
print('uv area before save', round(uv_area(hull), 3))
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(OUT, 'ship.blend'))
json.dump(ship_geo.anchors(), open(os.path.join(OUT, 'anchors.json'), 'w'), indent=1)
print(f'saved ({time.time()-t0:.1f}s)')
