"""Author Monument Square's five sculptures, exports and transparent card portraits.

Blender --background --python scripts/create-monument-assets.py -- /absolute/repo
Game coordinates: Y up, front +Z. Meshes retain named mechanism pivots.
"""
import bpy
import math
import sys
from pathlib import Path
from mathutils import Vector

sys.path.insert(0, str(Path(__file__).resolve().parent))
from blender_assets import AssetPack, vec

ROOT = Path(sys.argv[sys.argv.index('--') + 1])
art = AssetPack(ROOT, 'monuments')
STONE, LIGHT, SHADOW = '#d9ceb4', '#efe5cc', '#827967'
BRONZE, GOLD, DARK, PATINA = '#a87543', '#d6af68', '#493d32', '#567d73'
PORTRAITS = ROOT / 'public' / 'art' / 'monuments'
PORTRAITS.mkdir(parents=True, exist_ok=True)


def mesh(name, points, faces, color, smooth=False):
    data = bpy.data.meshes.new(name)
    data.from_pydata([vec(p) for p in points], [], faces)
    data.update()
    obj = bpy.data.objects.new(name, data)
    bpy.context.collection.objects.link(obj)
    for face in data.polygons:
        face.use_smooth = smooth
    return art.finish(obj, name, color)


def lathe(name, profile, color, sides=32, center=(0, 0, 0), smooth=True):
    points, faces = [], []
    for y, rx, rz in profile:
        for i in range(sides):
            a = math.tau * i / sides
            points.append((center[0] + rx * math.cos(a), center[1] + y,
                           center[2] + rz * math.sin(a)))
    for j in range(len(profile)-1):
        for i in range(sides):
            a, b = j*sides+i, j*sides+(i+1)%sides
            faces.append((a, a+sides, b+sides, b))
    faces += [tuple(range(sides)),
              tuple(reversed(range((len(profile)-1)*sides, len(profile)*sides)))]
    return mesh(name, points, faces, color, smooth)


def tube(name, points, radius, color, taper=0):
    curve = bpy.data.curves.new(name, 'CURVE')
    curve.dimensions, curve.resolution_u = '3D', 8
    curve.bevel_depth, curve.bevel_resolution = radius, 2
    spline = curve.splines.new('BEZIER')
    spline.bezier_points.add(len(points)-1)
    for index, (point, pos) in enumerate(zip(spline.bezier_points, points)):
        point.co = vec(pos)
        point.radius = 1-taper*index/(len(points)-1)
        point.handle_left_type = point.handle_right_type = 'AUTO'
    obj = bpy.data.objects.new(name, curve)
    bpy.context.collection.objects.link(obj)
    return art.finish(obj, name, color)


def ball(name, size, pos, color):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=24, ring_count=12, radius=1, location=vec(pos))
    obj = bpy.context.object
    obj.scale = (size[0], size[2], size[1])
    for polygon in obj.data.polygons:
        polygon.use_smooth = True
    return art.finish(obj, name, color)


def torus(name, center, radius, thickness, color, tilt=(0, 0, 0)):
    bpy.ops.mesh.primitive_torus_add(major_segments=64, minor_segments=8,
                                   major_radius=radius, minor_radius=thickness,
                                   location=vec(center))
    obj = bpy.context.object
    obj.rotation_euler = tilt
    for polygon in obj.data.polygons:
        polygon.use_smooth = True
    return art.finish(obj, name, color)


def feather(name, start, end, width, color, depth=.12, facing=1):
    # A pointed, cambered blade with a raised central quill, not a scaled primitive.
    start, end = Vector(start), Vector(end)
    direction = (end-start).normalized()
    cross = Vector((-direction.y, direction.x, 0)).normalized()
    points, faces = [], []
    for t, w in [(0, .28), (.18, .82), (.46, 1), (.75, .65), (1, .02)]:
        c = start.lerp(end, t)
        camber = math.sin(t*math.pi)*depth
        for side in [-1, 0, 1]:
            p = c + cross*width*w*side
            p.z += facing*(camber + (depth if side == 0 else 0))
            points.append(tuple(p))
    for row in range(4):
        for col in range(2):
            a = row*3+col
            face = (a+3, a+4, a+1, a)
            faces.append(face if facing > 0 else tuple(reversed(face)))
    obj = mesh(name, points, faces, color)
    solid = obj.modifiers.new('Cast feather thickness', 'SOLIDIFY')
    solid.thickness = .065
    return obj


def plinth(radius=2.8):
    lathe('Dressed stone footing', [(0.6, radius, radius), (.82, radius, radius),
          (.94, radius-.18, radius-.18)], STONE, 16, smooth=False)
    lathe('Recessed bronze plinth band', [(.94, radius-.28, radius-.28),
          (1.12, radius-.28, radius-.28)], DARK, 16, smooth=False)
    lathe('Chamfered plinth cap', [(1.12, radius-.15, radius-.15),
          (1.32, radius-.15, radius-.15), (1.46, radius-.4, radius-.4)], LIGHT, 16, smooth=False)


def owl():
    art.model('guardian')
    plinth(2.65)
    lathe('Perch pedestal', [(1.4, 1.72, 1.32), (1.65, 1.52, 1.15),
          (2.25, 1.36, 1.04), (2.5, 1.72, 1.25)], PATINA, 12, smooth=False)
    tube('Bronze branch perch', [(-2, 2.72, .4), (-.8, 2.8, .55),
         (.8, 2.72, .55), (2, 2.95, .25)], .24, BRONZE)
    # Continuous pear-shaped body and head, with a broad brow and tapered abdomen.
    lathe('Cast bronze owl body', [(2.85, .7, .6), (3.25, 1.15, .9),
          (4.1, 1.65, 1.22), (5.3, 1.91, 1.38), (6.35, 1.85, 1.3),
          (7.1, 1.55, 1.12), (7.4, 1.1, .8)], BRONZE)
    lathe('Sculpted owl head', [(6.7, 1.25, .94), (7.05, 1.75, 1.24),
          (7.8, 2.0, 1.38), (8.55, 1.91, 1.28), (8.95, 1.55, 1.03),
          (9.04, .9, .72), (9.12, .05, .05)], BRONZE)
    for side in [-1, 1]:
        # Cast feather tufts grow directly out of the skull, sweeping outward.
        feather('Swept ear feather', (side*1.1, 8.35, -.05),
                (side*1.9, 10, -.2), .55, BRONZE, .22)
        feather('Inner ear feather', (side*1.15, 8.45, .04),
                (side*1.72, 9.65, .1), .25, GOLD)
        ball('Recessed facial disc', (.99, 1.12, .29), (side*.94, 7.96, 1.16), DARK)
        ball('Bronze facial ruff', (.87, 1.0, .25), (side*.94, 7.98, 1.34), GOLD)
        ball('Patinated eye socket', (.49, .52, .14), (side*.91, 8.12, 1.57), DARK)
        ball('Amber iris inlay', (.32, .34, .1), (side*.91, 8.13, 1.69), '#bf8e42')
        ball('Obsidian eye', (.19, .24, .07), (side*.91, 8.14, 1.77), '#252e2c')
        ball('Small eye catchlight', (.065, .065, .025), (side*.91-.06, 8.25, 1.83), LIGHT)
        tube('Arched feather brow', [(side*.08, 8.55, 1.45),
             (side*.75, 8.94, 1.42), (side*1.57, 8.65, 1.21)], .14, BRONZE)
        for n in range(7):
            a = -.2 + n*.45
            tube('Facial disc chasing', [(side*.94+math.cos(a)*.73, 7.98+math.sin(a)*.85, 1.5),
                 (side*.94+math.cos(a)*.83, 7.98+math.sin(a)*.95, 1.44)], .025, BRONZE)
        for toe in range(3):
            x = side*.8 + (toe-1)*.24
            tube('Curled bronze talon', [(x, 3.18, .65), (x, 2.86, .96),
                 (x, 2.53, .75), (x, 2.55, .44)], .085, GOLD)
        art.joint, art.pivot = f'wing-{side}', (side*1.6, 6.25, 0)
        feather('Shaped wing mantle', (side*1.48, 6.8, .05),
                (side*4.55, 4.18, -.1), .91, BRONZE, .26)
        for n in range(8):
            feather('Overlapping primary flight feather',
                    (side*(1.65+n*.24), 6.4-n*.17, .19),
                    (side*(2.5+n*.29), 3.25+n*.15, .35),
                    .27, GOLD if n%3 == 0 else BRONZE, .12)
        for n in range(5):
            feather('Layered wing covert', (side*(1.7+n*.35), 6.65-n*.24, .38),
                    (side*(2.18+n*.4), 5.45-n*.28, .5), .3,
                    GOLD if n%2 else BRONZE)
        art.joint, art.pivot = 'body', (0, 0, 0)
    feather('Hooked beak', (0, 8.0, 1.65), (0, 7.18, 1.94), .28, DARK, .24)
    for n in range(5):
        feather('Tapered tail feather', ((n-2)*.2,3.9,-.7),
                ((n-2)*.24,2.65,-1.35),.2,BRONZE,.07,-1)
    for row in range(5):
        y = 6.8-row*.64
        span = [1.25,1.5,1.5,1.25,.9][row]
        for n in range(5):
            x = (n-2)*span*.4
            z = -[1.1,1.28,1.35,1.22,1.02][row]*math.sqrt(max(.1,1-(x/1.95)**2))
            feather('Layered back mantle', (x,y,z), (x*.93,y-.76,z-.035),
                    .24,BRONZE,.055,-1)
    for row in range(5):
        y = 6.7-row*.6
        span = [1.3, 1.55, 1.5, 1.25, .9][row]
        for n in range(5):
            x = (n-2)*span*.41
            z = [1.14,1.31,1.36,1.25,1.04][row]*math.sqrt(max(.1, 1-(x/1.95)**2))
            feather('Chased breast plumage', (x, y, z), (x*.92, y-.66, z+.04),
                    .23, '#bb8a50' if (row+n)%4 == 0 else BRONZE, .05)


def stone_arch():
    art.model('founders-arch')
    for side in [-1, 1]:
        x = side*3.65
        for y, w, h, depth, c in [(1, 3, .8, 3.5, SHADOW), (1.5, 2.8, .22, 3.3, LIGHT),
                (3.9, 2.32, 4.6, 2.9, STONE), (6.3, 2.8, .35, 3.3, LIGHT),
                (6.64, 2.95, .3, 3.45, SHADOW)]:
            art.box('Dressed pier masonry', (w, h, depth), (x, y, 0), c, .06)
        for y in [2.25, 3.25, 4.25, 5.25]:
            art.box('Pier ashlar joint', (2.34, .055, 2.92), (x, y, 0), SHADOW, .01)
        for dx in [-.81, .81]:
            for z in [-1.54, 1.54]:
                lathe('Engaged fluted column', [(1.65, .25, .25), (1.9, .31, .31),
                      (2.1, .22, .22), (5.8, .19, .19), (6.02, .32, .32),
                      (6.13, .32, .32)], LIGHT, 12, (x+dx, 0, z))
        art.box('Inset bronze dedication', (.92, 1.2, .09), (x, 4, 1.5), PATINA, .06)
        for y in [3.75, 3.93, 4.11, 4.29]:
            art.box('Dedication relief line', (.56, .045, .03), (x, y, 1.56), GOLD, 0)
    for i in range(17):
        a, b = i*math.pi/17+.007, (i+1)*math.pi/17-.007
        points = [(r*math.cos(t), 6.6+r*math.sin(t), z)
                  for z in [-1.34, 1.34] for r,t in [(2.48,a),(3.56,a),(3.56,b),(2.48,b)]]
        mesh('Radial arch voussoir', points,
             [(0,3,2,1),(4,5,6,7),(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7)],
             LIGHT if i%3 == 0 else STONE)
    for z in [-1.4, 1.4]:
        tube('Carved arch outer moulding', [(3.65*math.cos(a*math.pi/24),
             6.6+3.65*math.sin(a*math.pi/24), z) for a in range(25)], .105, LIGHT)
        tube('Bronze inner arch fillet', [(2.46*math.cos(a*math.pi/24),
             6.6+2.46*math.sin(a*math.pi/24), z) for a in range(25)], .045, GOLD)
    art.box('Raised central keystone', (.72, 1.3, 2.98), (0, 9.6, 0), LIGHT, .065)
    art.joint, art.pivot = 'sun', (0, 10.65, 0)
    art.ball('Bronze sun medallion', (.65, .65, .18), (0, 10.65, 0), GOLD)
    for i in range(12):
        a = math.tau*i/12
        feather('Sunwheel tapered ray', (.72*math.sin(a),10.65+.72*math.cos(a),0),
                (1.15*math.sin(a),10.65+1.15*math.cos(a),0), .105, GOLD, .04)
    art.joint, art.pivot = 'body', (0, 0, 0)


def crystal(name, pos, radius, height, color, lean=0):
    x,y,z = pos
    # Hexagonal prismatic shaft, lower bevel and six clean termination facets.
    points = []
    for h, r in [(0, .72), (.3, 1), (height*.74, 1), (height, .015)]:
        for i in range(6):
            a = math.tau*i/6+.2
            points.append((x+math.cos(a)*radius*r+lean*h, y+h, z+math.sin(a)*radius*r))
    faces = []
    for row in range(3):
        for i in range(6):
            a,b = row*6+i,row*6+(i+1)%6
            faces.append((a+6,b+6,b,a))
    faces.append(tuple(range(6)))
    return mesh(name, points, faces, color)


def crystals():
    art.model('crystal-spire')
    plinth(4.15)
    for x,z,r,h,c,lean in [(0,-.6,1.36,11.4,'#9388bd',0),
            (-2.2,.1,1,6.8,'#518d8c',-.15),(2.1,-.2,1.1,8.1,'#b8aed4',.1),
            (-1.15,2, .78,4.5,'#8ab7bd',-.14),(1.75,2,.82,5.1,'#6e77a7',.12),
            (.7,-2.3,.67,6.3,'#576990',.04),(-2.8,-1.5,.56,3.2,'#b8aed4',-.1)]:
        crystal('Terminated hexagonal crystal', (x,1.4,z), r,h,c,lean)
        for i in range(3):
            a = math.tau*i/3+.2
            tube('Crystal facet edge inlay', [(x+math.cos(a)*r,1.7,z+math.sin(a)*r),
                 (x+math.cos(a)*r+lean*h*.74,1.4+h*.74,z+math.sin(a)*r)],
                 .025, '#d2d2e4')
    torus('Bronze crystal garden rim', (0,1.45,0), 3.8,.09,GOLD)
    art.joint, art.pivot = 'motes', (0, 6, 0)
    for n in range(7):
        a = math.tau*n/7
        crystal('Suspended mineral mote', (math.cos(a)*4.3,5.6+math.sin(a*2)*1.1,
                math.sin(a)*3.3), .14,.55,GOLD)
    art.joint, art.pivot = 'body', (0,0,0)


def world_tree():
    art.model('world-tree')
    plinth(3.25)
    # Tapering sculptural trunk follows an S curve with visible roots and bifurcations.
    for i in range(7):
        a = math.tau*i/7
        tube('Exposed copper root', [(math.cos(a)*3.1,1.46,math.sin(a)*2.8),
             (math.cos(a)*1.45,1.62,math.sin(a)*1.35),(.12,2.8,0)], .16, BRONZE)
    for i in range(3):
        a = math.tau*i/3
        tube('Twisted copper trunk', [(math.cos(a)*.35,1.5,math.sin(a)*.35),
             (-.38+math.cos(a+.7)*.4,3.7,math.sin(a+.7)*.4),
             (.24+math.cos(a+1.2)*.28,6,math.sin(a+1.2)*.28),
             (-.1,8.7,-.2)], .28 if i == 0 else .23, BRONZE, .6)
    for i in range(15):
        a = math.tau*i/11
        reach = 3.45 if i < 11 else 1.35
        x,z = math.cos(a)*reach,math.sin(a)*reach*.75
        y = 7.5+math.sin(a*3)*.6+(i%3)*.5+(1.3 if i >= 11 else 0)
        tube('Tapered spreading bough', [(-.2,4.7+i%3*.65,0),
             (x*.45,6.3,z*.45),(x,y,z)], .2, BRONZE, .75)
        for j in range(3):
            angle = a+(j-1)*.5
            ex,ez = x+math.cos(angle)*1.2,z+math.sin(angle)*.95
            tube('Copper twig', [(x*.8,y-.6,z*.8),(x,y,z),(ex,y+.5,ez)], .065, GOLD, .7)
            # Folded lanceolate leaves build a broad airy canopy with gaps between boughs.
            for k in range(4):
                turn = angle+(k-1.5)*1.05
                lx,lz = ex+math.cos(turn)*.25,ez+math.sin(turn)*.25
                ly = y+.25+math.sin(i*2+j*3+k)*.28
                feather('Folded verdigris copper leaf',
                        (lx,ly,lz), (lx+math.cos(turn)*.95,ly+.8+math.sin(turn)*.25,
                                    lz+math.sin(turn)*.85),
                        .3+(k%2)*.09, PATINA if (i+j+k)%3 else '#7e9b7c', .1)
        if i < 11 and i%2 == 0:
            art.joint,art.pivot = f'pendant-{i}',(x,y-.1,z)
            tube('Hanging ornament chain',[(x,y-.1,z),(x,y-1.1,z)],.026,GOLD)
            crystal('Copper tree lantern',(x,y-1.8,z),.19,.65,GOLD)
            art.joint,art.pivot = 'body',(0,0,0)
    torus('Tree root court inlay',(0,1.46,0),3,.07,GOLD)


def sphere():
    art.model('celestial-sphere')
    plinth(3.25)
    lathe('Octagonal astronomical pedestal',[(1.4,1.65,1.65),(1.7,1.4,1.4),
          (2.7,1.12,1.12),(2.95,1.5,1.5),(3.15,1.5,1.5)], PATINA,8,smooth=False)
    for side in [-1,1]:
        tube('Swept armillary cradle',[(side*.8,2.8,0),(side*2.3,3.9,0),
             (side*2.9,5.3,0)], .16, GOLD)
    art.rod('Polar spindle',(0,3.05,0),(0,11.3,0),.11,GOLD)
    ball('Deep blue celestial globe',(1.65,1.65,1.65),(0,7.25,0),'#385975')
    for i in range(4):
        torus('Globe engraved meridian',(0,7.25,0),1.67,.025,GOLD,
              (math.pi/2,0,i*math.pi/4))
    for offset in [-.8,.8]:
        torus('Globe latitude inlay',(0,7.25+offset,0),math.sqrt(1.65**2-offset**2),.025,GOLD)
    for i in range(18):
        a, b = i*2.4, -.8+(i%5)*.4
        r = math.sqrt(1.67**2-b*b)
        art.ball('Celestial chart star',(.055,.055,.055),(math.cos(a)*r,7.25+b,math.sin(a)*r),LIGHT)
    for i, tilt in enumerate([.4,1.05,1.6]):
        art.joint,art.pivot = f'orbit-{i}',(0,7.25,0)
        torus('Solid brass orbital band',(0,7.25,0),3.5+i*.28,.095,GOLD,(tilt,0,i*.8))
        # Planet follows the same tilted plane as its band.
        a = .65+i*1.9
        r = 3.5+i*.28
        v = Vector((r*math.cos(a),r*math.sin(a),0))
        from mathutils import Euler
        v.rotate(Euler((tilt,0,i*.8)))
        # One metal per mechanism lets each ring and its planet merge into one draw.
        ball('Orbiting brass planet',(.31,.31,.31),(v.x,7.25+v.z,-v.y),GOLD)
        art.joint,art.pivot = 'body',(0,0,0)
    torus('Inclined graduated zodiac hoop',(0,7.25,0),4.45,.14,BRONZE,(.82,0,.3))
    for i in range(48):
        a = math.tau*i/48
        # Horizontal compass rose underneath the moving armillary.
        art.rod('Compass graduation',(math.cos(a)*2.65,1.48,math.sin(a)*2.65),
                (math.cos(a)*(3.05 if i%4 == 0 else 2.82),1.48,
                 math.sin(a)*(3.05 if i%4 == 0 else 2.82)),.025,GOLD)
    crystal('Polar finial',(0,11.15,0),.22,.8,GOLD)


owl()
stone_arch()
crystals()
world_tree()
sphere()
payload = art.export(ROOT / 'src' / 'assets' / 'monuments-meshes.json')
print('MONUMENT_EXPORT', {name: {'triangles': sum(len(p['indices'])//3 for p in parts),
      'parts': len(parts)} for name,parts in payload['models'].items()}, flush=True)
# Convert curves for the interchange export; the runtime export already evaluated them.
bpy.ops.object.select_all(action='DESELECT')
for root in art.models.values():
    for obj in root.children:
        if obj.type == 'CURVE':
            obj.select_set(True)
            bpy.context.view_layer.objects.active = obj
bpy.ops.object.convert(target='MESH')
bpy.ops.export_scene.gltf(filepath=str(art.source / 'monuments.glb'),export_format='GLB')

scene = bpy.context.scene
scene.render.engine = 'CYCLES'
scene.cycles.samples = 32
scene.render.resolution_x = scene.render.resolution_y = 640
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = 'PNG'
scene.render.film_transparent = True
scene.view_settings.view_transform = 'Standard'
scene.world.use_nodes = True
scene.world.node_tree.nodes['Background'].inputs['Color'].default_value = (.65,.7,.8,1)
scene.world.node_tree.nodes['Background'].inputs['Strength'].default_value = .8
bpy.ops.object.light_add(type='AREA',location=(4,-9,17))
bpy.context.object.data.energy, bpy.context.object.data.size = 1700,10
bpy.ops.object.light_add(type='AREA',location=(-8,2,12))
bpy.context.object.data.energy, bpy.context.object.data.size = 1100,8
bpy.ops.object.camera_add(location=(15,-28,20))
camera = bpy.context.object
camera.rotation_euler = (vec((0,5.8,0))-camera.location).to_track_quat('-Z','Y').to_euler()
camera.data.type, camera.data.ortho_scale = 'ORTHO',16.5
scene.camera = camera
for name,root in art.models.items():
    for other in art.models.values():
        for obj in other.children:
            obj.hide_render = other != root
    scene.render.filepath = str(PORTRAITS / f'{name}.png')
    bpy.ops.render.render(write_still=True)
for i,root in enumerate(art.models.values()):
    for obj in root.children:
        obj.hide_render = False
    root.location = vec(((i-2)*15,0,0))
camera.location = (34,-66,42)
camera.rotation_euler = (vec((0,5,0))-camera.location).to_track_quat('-Z','Y').to_euler()
camera.data.ortho_scale = 77
scene.render.resolution_x,scene.render.resolution_y = 2400,850
scene.render.film_transparent = False
scene.render.filepath = str(art.source / 'review.png')
bpy.context.preferences.filepaths.save_version = 0
bpy.ops.wm.save_as_mainfile(filepath=str(art.source / 'monuments.blend'))
bpy.ops.render.render(write_still=True)
