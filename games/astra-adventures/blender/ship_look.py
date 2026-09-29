# Cycles look renders of the finished ship (build/ship_final.blend).
#   /tmp/bvenv/bin/python ship_look.py out_prefix views [spp]
import sys, os, math
HERE = os.path.dirname(os.path.abspath(__file__))
import bpy
import numpy as np
from mathutils import Vector

out, views = sys.argv[1], sys.argv[2].split(',')
spp = int(sys.argv[3]) if len(sys.argv) > 3 else 48
bpy.ops.wm.open_mainfile(filepath=os.path.join(HERE, 'build', 'ship_final.blend'))
sc = bpy.context.scene
sc.render.engine = 'CYCLES'
sc.cycles.samples = spp
sc.cycles.use_denoising = True
sc.render.resolution_x, sc.render.resolution_y = 1280, 720
sc.view_settings.view_transform = 'AgX'
sc.view_settings.look = 'AgX - Medium High Contrast'
w = bpy.data.worlds.new('w')
sc.world = w
w.use_nodes = True
nt = w.node_tree
bg = nt.nodes['Background']
tc = nt.nodes.new('ShaderNodeTexCoord')
sep = nt.nodes.new('ShaderNodeSeparateXYZ')
ramp = nt.nodes.new('ShaderNodeValToRGB')
nt.links.new(tc.outputs['Generated'], sep.inputs[0])
ramp.color_ramp.elements[0].position = 0.35
ramp.color_ramp.elements[0].color = (0.010, 0.012, 0.018, 1)
ramp.color_ramp.elements[1].position = 0.62
ramp.color_ramp.elements[1].color = (0.06, 0.075, 0.11, 1)
nt.links.new(sep.outputs['Z'], ramp.inputs['Fac'])
nt.links.new(ramp.outputs['Color'], bg.inputs['Color'])
bg.inputs['Strength'].default_value = 1.0
sun = bpy.data.objects.new('sun', bpy.data.lights.new('sun', 'SUN'))
sun.data.energy = 5.0
sun.data.angle = math.radians(0.8)
sun.data.color = (1.0, 0.96, 0.9)
sun.rotation_euler = (math.radians(52), math.radians(-28), math.radians(38))
sc.collection.objects.link(sun)
rim = bpy.data.objects.new('rim', bpy.data.lights.new('rim', 'AREA'))
rim.data.energy = 2500
rim.data.size = 8
rim.data.color = (0.7, 0.8, 1.0)
rim.location = (-14, -16, 7)
rim.rotation_euler = (math.radians(70), 0, math.radians(-40))
sc.collection.objects.link(rim)
cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam'))
sc.collection.objects.link(cam)
sc.camera = cam
VIEWS = {
    'hero': ((19.0, 16.5, 9.0), 38, (0, -0.3, 0.1)),
    'rear': ((-11.0, -26.0, 9.5), 34, (0, -0.3, 0.1)),
    'side': ((26.0, 0.5, 1.2), 34, (0, -0.3, 0.1)),
    'top': ((0.01, -0.5, 30.0), 36, (0, -0.3, 0.1)),
    'chase': ((0.0, -25.0, 5.0), 62, (0, 6.0, 1.0)),
    'nose': ((3.4, 9.2, 2.2), 42, (0, 3.5, 0.6)),
    'wing': ((7.5, -2.0, 4.2), 50, (3.5, -1.2, 0.0)),
    'engine': ((6.5, -11.0, 2.4), 36, (2.0, -5.0, 0.0)),
    'close': ((2.8, 4.8, 2.4), 46, (0.4, 2.4, 0.7)),
}
for v in views:
    loc, fov, tgt = VIEWS[v]
    cam.location = loc
    cam.data.angle = math.radians(fov)
    cam.rotation_euler = (Vector(tgt) - Vector(loc)).to_track_quat('-Z', 'Y').to_euler()
    sc.render.filepath = f'{out}-{v}.png'
    bpy.ops.render.render(write_still=True)
    print('wrote', sc.render.filepath)
