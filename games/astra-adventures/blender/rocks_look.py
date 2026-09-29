# Cycles look render of the asteroids from ../assets (rocks.glb + textures), all six side by side.
#   /tmp/bvenv/bin/python rocks_look.py out.png [lod] [close]
import sys, os, math, json
HERE = os.path.dirname(os.path.abspath(__file__))
import bpy
from mathutils import Vector

out = sys.argv[1]
lod = int(sys.argv[2]) if len(sys.argv) > 2 else 0
close = len(sys.argv) > 3
A = os.path.join(HERE, '..', 'assets')
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=os.path.join(A, 'rocks.glb'))
info = json.load(open(os.path.join(A, 'rocks.json')))
names = [r['name'] for r in info['rocks']]
sc = bpy.context.scene


def material(name):
    m = bpy.data.materials.new('rock_' + name)
    m.use_nodes = True
    nt = m.node_tree
    b = nt.nodes['Principled BSDF']
    b.inputs['Roughness'].default_value = 0.92
    ta = nt.nodes.new('ShaderNodeTexImage')
    ta.image = bpy.data.images.load(os.path.join(A, f'rock-{name}-albedo.jpg'))
    ta.extension = 'EXTEND'
    tn = nt.nodes.new('ShaderNodeTexImage')
    tn.image = bpy.data.images.load(os.path.join(A, f'rock-{name}-normal.jpg'))
    tn.image.colorspace_settings.name = 'Non-Color'
    tn.extension = 'EXTEND'
    nt.links.new(ta.outputs['Color'], b.inputs['Base Color'])
    # the map is in glTF (y-up) object space; the importer turned the mesh to Blender's z-up: swizzle
    sep = nt.nodes.new('ShaderNodeSeparateXYZ')
    nt.links.new(tn.outputs['Color'], sep.inputs[0])
    comb = nt.nodes.new('ShaderNodeCombineXYZ')
    nt.links.new(sep.outputs['X'], comb.inputs['X'])
    inv = nt.nodes.new('ShaderNodeMath')
    inv.operation = 'SUBTRACT'
    inv.inputs[0].default_value = 1.0
    nt.links.new(sep.outputs['Z'], inv.inputs[1])
    nt.links.new(inv.outputs[0], comb.inputs['Y'])
    nt.links.new(sep.outputs['Y'], comb.inputs['Z'])
    nm = nt.nodes.new('ShaderNodeNormalMap')
    nm.space = 'OBJECT'
    nt.links.new(comb.outputs[0], nm.inputs['Color'])
    nt.links.new(nm.outputs['Normal'], b.inputs['Normal'])
    return m


for i, nm in enumerate(names):
    for o in bpy.data.objects:
        if o.name.startswith(f'{nm}_lod'):
            keep = o.name == f'{nm}_lod{lod}'
            o.hide_render = not keep
            o.data.materials.clear()
            o.data.materials.append(material(nm))
            o.location = ((i % 3) * 3.4 - 3.4, 0, -(i // 3) * 3.2 + 1.6) if not close else (0, 0, 0)
            if close and i != 0:
                o.hide_render = True
            o.rotation_euler = (0.3 * i, 0.5 * i, 0.2 * i)
sc.render.engine = 'CYCLES'
sc.cycles.samples = 32
sc.cycles.use_denoising = True
sc.render.resolution_x, sc.render.resolution_y = 1400, 900
sc.view_settings.view_transform = 'AgX'
w = bpy.data.worlds.new('w')
sc.world = w
w.use_nodes = True
w.node_tree.nodes['Background'].inputs['Color'].default_value = (0.004, 0.005, 0.009, 1)
sun = bpy.data.objects.new('sun', bpy.data.lights.new('sun', 'SUN'))
sun.data.energy = 6.0
sun.data.angle = math.radians(0.5)
sun.rotation_euler = (math.radians(58), math.radians(8), math.radians(-52))
sc.collection.objects.link(sun)
cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam'))
sc.collection.objects.link(cam)
sc.camera = cam
cam.location = (0, -14, 1.5) if not close else (0.5, -2.4, 0.6)
cam.data.angle = math.radians(40 if not close else 50)
cam.rotation_euler = (Vector((0, 0, 0)) - cam.location).to_track_quat('-Z', 'Y').to_euler()
sc.render.filepath = out
bpy.ops.render.render(write_still=True)
print('wrote', out)
