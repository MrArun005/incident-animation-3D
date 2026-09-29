# Cycles beauty stills of the finished ship under the game's own sky (assets/sky.jpg) and sun.
#   /tmp/bvenv/bin/python ship_beauty.py out_prefix views [spp] [WxH]
import sys, os, math
HERE = os.path.dirname(os.path.abspath(__file__))
import bpy
from mathutils import Vector

out, views = sys.argv[1], sys.argv[2].split(',')
spp = int(sys.argv[3]) if len(sys.argv) > 3 else 96
W, H = (int(v) for v in (sys.argv[4] if len(sys.argv) > 4 else '1600x900').split('x'))
bpy.ops.wm.open_mainfile(filepath=os.path.join(HERE, 'build', 'ship_final.blend'))
sc = bpy.context.scene
sc.render.engine = 'CYCLES'
sc.cycles.samples = spp
sc.cycles.use_denoising = True
sc.render.resolution_x, sc.render.resolution_y = W, H
sc.view_settings.view_transform = 'AgX'
sc.view_settings.look = 'AgX - Punchy'
w = bpy.data.worlds.new('sky')
sc.world = w
w.use_nodes = True
nt = w.node_tree
env = nt.nodes.new('ShaderNodeTexEnvironment')
env.image = bpy.data.images.load(os.path.join(HERE, '..', 'assets', 'sky.jpg'))
mp = nt.nodes.new('ShaderNodeMapping')
tc = nt.nodes.new('ShaderNodeTexCoord')
mp.inputs['Rotation'].default_value = (0, 0, math.pi)          # three.js and Blender equirects differ by 180 degrees
nt.links.new(tc.outputs['Generated'], mp.inputs['Vector'])
nt.links.new(mp.outputs['Vector'], env.inputs['Vector'])
nt.links.new(env.outputs['Color'], nt.nodes['Background'].inputs['Color'])
nt.nodes['Background'].inputs['Strength'].default_value = 1.6
sun_dir = Vector((0.72, -0.52, 0.46)).normalized()             # the game's SUN_DIR in Blender axes
sun = bpy.data.objects.new('sun', bpy.data.lights.new('sun', 'SUN'))
sun.data.energy = 4.2
sun.data.angle = math.radians(0.6)
sun.data.color = (1.0, 0.95, 0.88)
sun.rotation_euler = (-sun_dir).to_track_quat('-Z', 'Y').to_euler()
sc.collection.objects.link(sun)
for name, c in (('GlowC', (1.0, 0.6, 0.3)), ('GlowL', (1.0, 0.6, 0.3)), ('GlowR', (1.0, 0.6, 0.3))):
    m = bpy.data.objects[name].data.materials[0]
    m.node_tree.nodes['Principled BSDF'].inputs['Emission Strength'].default_value = 30
cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam'))
sc.collection.objects.link(cam)
sc.camera = cam
VIEWS = {   # camera location, lens fov, look-at (Blender axes: +y is the nose)
    'hero': ((15.5, 13.5, 5.0), 34, (0.3, 0.6, 0.2)),
    'rear': ((-10.0, -22.0, 7.0), 30, (0.0, -0.5, 0.2)),
    'low': ((9.0, 11.0, -3.8), 38, (0.0, 0.0, 0.2)),
    'top': ((6.0, -9.0, 16.0), 38, (0.0, -0.2, 0.0)),
    'cockpit': ((3.6, 6.2, 2.4), 44, (0.0, 2.1, 0.8)),
    'engines': ((5.0, -12.5, 1.6), 38, (1.2, -4.2, 0.0)),
}
for v in views:
    loc, fov, tgt = VIEWS[v]
    cam.location = loc
    cam.data.angle = math.radians(fov)
    cam.rotation_euler = (Vector(tgt) - Vector(loc)).to_track_quat('-Z', 'Y').to_euler()
    sc.render.filepath = f'{out}-{v}.png'
    bpy.ops.render.render(write_still=True)
    print('wrote', sc.render.filepath, flush=True)
