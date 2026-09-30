# Stage C: bake the painted height into a tangent-space normal map, wire the PBR materials and export the GLB.
#   /tmp/bvenv/bin/python ship_export.py [--out ../assets] [--size 4096]
# Reads build/ship.blend + build/tex_*.{png,npy}; writes <out>/jupiter.glb, <out>/jupiter-vega.jpg,
# <out>/jupiter.json (gameplay anchors) and build/ship_final.blend (for look renders).
import sys, os, math, json, time, shutil
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import bpy
import numpy as np
from PIL import Image

args = sys.argv[1:]
OUT = os.path.abspath(args[args.index('--out') + 1]) if '--out' in args else os.path.join(HERE, '..', 'assets')
SIZE = int(args[args.index('--size') + 1]) if '--size' in args else 2048
BUMP = float(args[args.index('--bump') + 1]) if '--bump' in args else 6.0
# The ship is modelled at 1:1 of the original design and exported larger: a heavier fighter that fills more of
# the frame. Geometry and every gameplay anchor (engines, guns, collision probes) scale together.
SCALE = float(args[args.index('--scale') + 1]) if '--scale' in args else 1.3
B = os.path.join(HERE, 'build')
os.makedirs(OUT, exist_ok=True)
t0 = time.time()
bpy.ops.wm.open_mainfile(filepath=os.path.join(B, 'ship.blend'))
sc = bpy.context.scene
sc.render.engine = 'CYCLES'
sc.cycles.device = 'CPU'
hull = bpy.data.objects['Hull']


def image_from_array(name, arr, float_buffer=True, colorspace='Non-Color'):
    h, w = arr.shape[:2]
    img = bpy.data.images.new(name, w, h, alpha=True, float_buffer=float_buffer)
    img.colorspace_settings.name = colorspace
    a = np.ones((h, w, 4), np.float32)
    if arr.ndim == 2:
        a[..., 0] = a[..., 1] = a[..., 2] = arr
    else:
        a[..., :3] = arr[..., :3]
    img.pixels.foreach_set(a[::-1].ravel())
    return img


def load_png(path, name, colorspace):
    img = bpy.data.images.load(path)
    img.name = name
    img.colorspace_settings.name = colorspace
    return img


# ---------------------------------------------------------------- normal bake from the painted height
hm = np.load(os.path.join(B, 'tex_height.npy'))
RES = hm.shape[0]
himg = image_from_array('height', hm)
mat = bpy.data.materials.new('bakeN')
mat.use_nodes = True
nt = mat.node_tree
bsdf = nt.nodes['Principled BSDF']
ti = nt.nodes.new('ShaderNodeTexImage')
ti.image = himg
ti.interpolation = 'Linear'
bump = nt.nodes.new('ShaderNodeBump')
bump.inputs['Strength'].default_value = 1.0
bump.inputs['Distance'].default_value = BUMP
nt.links.new(ti.outputs['Color'], bump.inputs['Height'])
nt.links.new(bump.outputs['Normal'], bsdf.inputs['Normal'])
nimg = bpy.data.images.new('normal', RES, RES, alpha=False, float_buffer=True)
nimg.colorspace_settings.name = 'Non-Color'
tn = nt.nodes.new('ShaderNodeTexImage')
tn.image = nimg
nt.nodes.active = tn
hull.data.materials.clear()
hull.data.materials.append(mat)
for o in bpy.data.objects:
    o.hide_render = o.name != 'Hull'
    o.select_set(o.name == 'Hull')
bpy.context.view_layer.objects.active = hull
sc.cycles.samples = 4
bpy.ops.object.bake(type='NORMAL', normal_space='TANGENT', use_clear=True, margin=14, margin_type='ADJACENT_FACES')
a = np.empty(RES * RES * 4, np.float32)
nimg.pixels.foreach_get(a)
nrm = a.reshape(RES, RES, 4)[::-1, :, :3]
Image.fromarray((np.clip(nrm, 0, 1) * 255 + 0.5).astype(np.uint8)).save(os.path.join(B, 'tex_normal.png'))
print(f'normal baked ({time.time() - t0:.0f}s): mean {nrm.reshape(-1, 3).mean(0)}')
for o in bpy.data.objects:
    o.hide_render = False


# ---------------------------------------------------------------- final materials
def resized(src, name, size):
    im = Image.open(os.path.join(B, src))
    if im.size[0] != size:
        im = im.resize((size, size), Image.LANCZOS)
    p = os.path.join(B, name)
    im.save(p)
    return p


alb = load_png(resized('tex_albedo_lead.png', 'final_albedo.png', SIZE), 'jupiter_albedo', 'sRGB')
orm = load_png(resized('tex_orm.png', 'final_orm.png', min(SIZE, 2048)), 'jupiter_orm', 'Non-Color')
nor = load_png(resized('tex_normal.png', 'final_normal.png', SIZE), 'jupiter_normal', 'Non-Color')

gl = bpy.data.node_groups.get('glTF Material Output') or bpy.data.node_groups.new('glTF Material Output', 'ShaderNodeTree')
if not gl.interface.items_tree:
    gl.interface.new_socket('Occlusion', in_out='INPUT', socket_type='NodeSocketFloat')
    gl.interface.new_socket('Thickness', in_out='INPUT', socket_type='NodeSocketFloat')

m = bpy.data.materials.new('JupiterHull')
m.use_nodes = True
nt = m.node_tree
bsdf = nt.nodes['Principled BSDF']
n_alb = nt.nodes.new('ShaderNodeTexImage')
n_alb.image = alb
n_orm = nt.nodes.new('ShaderNodeTexImage')
n_orm.image = orm
n_nor = nt.nodes.new('ShaderNodeTexImage')
n_nor.image = nor
sep = nt.nodes.new('ShaderNodeSeparateColor')
nm = nt.nodes.new('ShaderNodeNormalMap')
nt.links.new(n_alb.outputs['Color'], bsdf.inputs['Base Color'])
nt.links.new(n_orm.outputs['Color'], sep.inputs['Color'])
nt.links.new(sep.outputs['Green'], bsdf.inputs['Roughness'])
nt.links.new(sep.outputs['Blue'], bsdf.inputs['Metallic'])
nt.links.new(n_nor.outputs['Color'], nm.inputs['Color'])
nt.links.new(nm.outputs['Normal'], bsdf.inputs['Normal'])
go = nt.nodes.new('ShaderNodeGroup')
go.node_tree = gl
nt.links.new(sep.outputs['Red'], go.inputs['Occlusion'])
hull.data.materials.clear()
hull.data.materials.append(m)

g = bpy.data.materials.new('JupiterGlass')
g.use_nodes = True
b = g.node_tree.nodes['Principled BSDF']
b.inputs['Base Color'].default_value = (0.012, 0.016, 0.022, 1)
b.inputs['Roughness'].default_value = 0.04
b.inputs['Alpha'].default_value = 0.42
g.surface_render_method = 'BLENDED'
bpy.data.objects['Glass'].data.materials.clear()
bpy.data.objects['Glass'].data.materials.append(g)
GLOWC = {'GlowC': (1.0, 0.62, 0.30), 'GlowL': (1.0, 0.62, 0.30), 'GlowR': (1.0, 0.62, 0.30),
         'NavR': (0.2, 1.0, 0.35), 'NavL': (1.0, 0.12, 0.08), 'Beacon': (1.0, 0.15, 0.1),
         'StrobeR': (1, 1, 1), 'StrobeL': (1, 1, 1)}
for name, c in GLOWC.items():
    mm = bpy.data.materials.new('Glow_' + name)
    mm.use_nodes = True
    bb = mm.node_tree.nodes['Principled BSDF']
    bb.inputs['Base Color'].default_value = (*c, 1)
    bb.inputs['Emission Color'].default_value = (*c, 1)
    bb.inputs['Emission Strength'].default_value = 4.0
    o = bpy.data.objects[name]
    o.data.materials.clear()
    o.data.materials.append(mm)
for o in bpy.data.objects:
    if o.type == 'MESH':
        for attr in ('kind', 'pp'):
            if attr in o.data.attributes and o.name != 'Hull':
                o.data.attributes.remove(o.data.attributes[attr])
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(B, 'ship_final.blend'))

# ---------------------------------------------------------------- export (attributes stripped from the copy)
hm_ = bpy.data.objects['Hull'].data
for attr in ('kind', 'pp'):
    if attr in hm_.attributes:
        hm_.attributes.remove(hm_.attributes[attr])
from mathutils import Matrix
for o in bpy.data.objects:
    if o.type == 'MESH':
        o.data.transform(Matrix.Scale(SCALE, 4))
bpy.ops.object.select_all(action='SELECT')
glb = os.path.join(OUT, 'jupiter.glb')
bpy.ops.export_scene.gltf(filepath=glb, export_format='GLB', export_image_format='JPEG', export_jpeg_quality=90,
                          export_tangents=True, export_yup=True, export_apply=True, export_texcoords=True,
                          export_normals=True, export_materials='EXPORT', export_cameras=False, export_lights=False,
                          use_selection=False, export_extras=False)
im = Image.open(os.path.join(B, 'tex_albedo_vega.png'))
if im.size[0] != SIZE:
    im = im.resize((SIZE, SIZE), Image.LANCZOS)
im.convert('RGB').save(os.path.join(OUT, 'jupiter-vega.jpg'), quality=90, optimize=True)
anc = json.load(open(os.path.join(B, 'anchors.json')))
sc3 = lambda v: [round(c * SCALE, 3) for c in v]
anc['scale'] = SCALE
for k in ('engines', 'engineThroats', 'guns'):
    anc[k] = [sc3(v) for v in anc[k]]
anc['engineR'] = [round(r * SCALE, 3) for r in anc['engineR']]
anc['nav'] = {k: sc3(v) for k, v in anc['nav'].items()}
anc['samples'] = [dict(q, p=sc3(q['p']), r=round(q['r'] * SCALE, 3)) for q in anc['samples']]
json.dump(anc, open(os.path.join(OUT, 'jupiter.json'), 'w'), indent=1)
print(f'exported {glb}: {os.path.getsize(glb) / 1e6:.1f} MB ({time.time() - t0:.0f}s)')
