"""Blender source and deterministic mesh export for aviation, broadcast and connected-city assets.

Run Blender --background --python this-file.py -- /absolute/repository/path
Coordinates in authoring helpers use the game's X/Y-up/Z convention.
"""
import bpy
import json
import math
import sys
from pathlib import Path
from mathutils import Vector

ROOT = Path(sys.argv[sys.argv.index('--') + 1])
SOURCE = ROOT / 'art' / 'future'
OUTPUT = ROOT / 'src' / 'assets'
SOURCE.mkdir(parents=True, exist_ok=True)
OUTPUT.mkdir(parents=True, exist_ok=True)
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
materials = {}
models = {}
active = None
joint = 'body'
pivot = (0, 0, 0)

def vec(p):
    return Vector((p[0], -p[2], p[1]))

def material(color):
    if color not in materials:
        m = bpy.data.materials.new(color)
        rgb = [int(color[i:i+2], 16) / 255 for i in (1, 3, 5)]
        rgb = [v / 12.92 if v <= .04045 else ((v + .055) / 1.055) ** 2.4 for v in rgb]
        m.diffuse_color = (*rgb, 1)
        m.use_nodes = True
        m.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value = (*rgb, 1)
        m.node_tree.nodes['Principled BSDF'].inputs['Roughness'].default_value = .88
        m['gameColor'] = color
        materials[color] = m
    return materials[color]

def model(name):
    global active, joint, pivot
    active = bpy.data.objects.new(name, None)
    bpy.context.collection.objects.link(active)
    models[name] = active
    joint, pivot = 'body', (0, 0, 0)

def finish(obj, name, color):
    obj.name = name
    obj.parent = active
    obj.data.materials.append(material(color))
    obj['joint'] = joint
    obj['pivot'] = pivot
    return obj

def box(name, size, pos, color, bevel=.035):
    bpy.ops.mesh.primitive_cube_add(size=1, location=vec(pos))
    obj = bpy.context.object
    obj.scale = (size[0], size[2], size[1])
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    if bevel:
        mod = obj.modifiers.new('Soft timber edges', 'BEVEL')
        mod.width, mod.segments = bevel, 1
        bpy.ops.object.modifier_apply(modifier=mod.name)
    return finish(obj, name, color)

def ball(name, size, pos, color):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=12, ring_count=6, radius=1, location=vec(pos))
    obj = bpy.context.object
    obj.scale = (size[0], size[2], size[1])
    for face in obj.data.polygons:
        face.use_smooth = True
    return finish(obj, name, color)

def rod(name, start, end, radius, color):
    a, b = vec(start), vec(end)
    bpy.ops.mesh.primitive_cylinder_add(vertices=8, radius=radius, depth=(b-a).length, location=(a+b)/2)
    obj = bpy.context.object
    obj.rotation_euler = (b-a).to_track_quat('Z', 'Y').to_euler()
    return finish(obj, name, color)

def loft(name, rings, color):
    # A shaped, connected surface; each ring is center X/Y/Z and horizontal/vertical radii.
    vertices, faces = [], []
    for x, y, z, rx, ry in rings:
        for i in range(12):
            a = i * math.tau / 12
            vertices.append(tuple(vec((x + math.cos(a)*rx, y + math.sin(a)*ry, z))))
    for ring in range(len(rings)-1):
        for i in range(12):
            a, b = ring*12+i, ring*12+(i+1)%12
            faces.append((a, b, b+12, a+12))
    faces.extend([tuple(reversed(range(12))), tuple(range((len(rings)-1)*12, len(rings)*12))])
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    for face in mesh.polygons:
        face.use_smooth = True
    return finish(obj, name, color)


cream, teal, glass, charcoal = '#e1cfab', '#648d89', '#85b8c8', '#435764'
coral, gold = '#c97868', '#e5bc77'

def glazing(x,y,z,width,height):
    box('Window ribbon',(width,height,.06),(x,y,z),glass,0)
    for dx in [-width/2,0,width/2]:
        box('Glazing mullion',(.045,height,.09),(x+dx,y,z+.015),cream,0)

def signboard(x,y,z,w,h,digital=False):
    box('Screen surround',(w+.18,h+.18,.18),(x,y,z),charcoal)
    box('Screen face',(w,h,.04),(x,y,z+.12),'#387d9a' if digital else coral,0)
    for i in range(4):
        box('Display graphic',(w*(.3+i*.1),.06,.02),(x,y+h*.3-i*h*.2,z+.15),cream,0)

def tower(height=10):
    for x in [-.7,.7]:
        for z in [-.7,.7]:
            rod('Tapered lattice mast',(x,0,z),(x*.12,height,z*.12),.07,coral)
    for i in range(int(height)):
        w=.7*(1-i/height)
        for side in [-1,1]:
            rod('Cross bracing',(-w,i,side*w),(w*.85,i+1,side*w*.85),.035,cream)
            rod('Cross bracing',(side*w,i,-w),(side*w*.85,i+1,w*.85),.035,cream)
    rod('Broadcast antenna',(0,height,0),(0,height+2,0),.055,charcoal)
    for y in [height+.5,height+1,height+1.5]:rod('Aerial element',(-.55,y,0),(.55,y,0),.035,charcoal)

model('airport')
box('Regional airfield apron',(20,.14,40),(0,.02,0),'#9baba2',0)
box('North south runway',(4.8,.055,38),(-5,.12,0),'#657777',0)
for z in range(-16,18,4):box('Runway center stripe',(.12,.012,1.6),(-5,.155,z),cream,0)
for z in [-17.5,17.5]:
    for x in [-6.5,-5.9,-5.3,-4.7,-4.1,-3.5]:box('Threshold piano key',(.3,.013,1.6),(x,.155,z),cream,0)
for x in [-7.6,-2.4]:
    for z in range(-18,20,3):
        box('Runway edge light',(.15,.13,.15),(x,.2,z),gold,0)
box('Taxiway',(4,.06,2.2),(-.6,.13,7), '#788b87',0)
box('Terminal concourse',(6.4,2.3,9),(4.3,1.3,-2),cream)
box('Cantilever terminal roof',(7.2,.22,10),(4.1,2.6,-2),teal)
for z in [-5,-3,-1,1]:
    box('Airside terminal glazing',(.08,1.5,1.7),(1.06,1.5,z),glass,0)
    box('Terminal bay pier',(.2,2.25,.15),(.95,1.28,z+1),cream)
box('Control tower shaft',(1.6,5.8,1.8),(5.6,3.1,-8),cream)
box('Panoramic control room',(2.8,1.25,2.6),(5.6,6.3,-8),glass,.16)
box('Control tower roof',(3.1,.2,2.9),(5.6,7.05,-8),teal)
rod('Control aerial',(5.6,7.1,-8),(5.6,8.3,-8),.045,charcoal)
# Connected arched hangar surface.
loft('Barrel hangar shell',[(4.5,1.4,8,3,1.8),(4.5,1.4,13,3,1.8)],teal)
box('Hangar door',(5.7,2.7,.12),(4.5,1.5,7.9),charcoal)
for x in [2,3,4,5,6,7]:box('Hangar door rib',(.04,2.65,.04),(x,1.5,7.8),cream,0)

model('airport-wing')
box('Expanded passenger lounge',(6,1.9,3),(4.2,1.12,4.3),glass)
box('Lounge roof',(6.6,.18,3.4),(4.2,2.15,4.3),cream)
model('airport-finish')
for z in [-11,-6,0,5]:
    rod('Apron lamp',(8.5,.15,z),(8.5,3.8,z),.065,teal)
    box('Apron floodlight',(.6,.15,.3),(8.5,3.85,z),gold)

model('airplane')
loft('Tapered passenger fuselage',[(0,.8,-3.2,.1,.13),(0,.9,-2,.48,.48),(0,.9,1.9,.5,.5),(0,.82,2.8,.24,.28),(0,.8,3.15,.02,.04)],cream)
# Wings are a single shaped mesh each, with swept trailing edges and tapered tips.
for side in [-1,1]:
    verts=[(.3*side,.82,.8),(4.1*side,.74,-.1),(4.1*side,.68,-.55),(.3*side,.7,-.65)]
    mesh=bpy.data.meshes.new('Tapered wing');mesh.from_pydata([vec(p) for p in verts],[],[(0,1,2,3) if side<0 else (3,2,1,0)]);mesh.update()
    obj=bpy.data.objects.new('Wing',mesh);bpy.context.collection.objects.link(obj)
    mod=obj.modifiers.new('Wing thickness','SOLIDIFY');mod.thickness=.09
    bpy.context.view_layer.objects.active=obj;bpy.ops.object.modifier_apply(modifier=mod.name)
    finish(obj,'Swept tapered wing',teal)
    loft('Engine nacelle',[(side*1.8,.7,-.2,.18,.2),(side*1.8,.7,1.3,.2,.2),(side*1.8,.7,1.5,.1,.12)],charcoal)
    joint = 'propellerLeft' if side < 0 else 'propellerRight'
    pivot = (side*1.8,.7,1.62)
    ball('Propeller spinner',(.13,.13,.2),pivot,coral)
    rod('Propeller horizontal blade',(side*1.8-.65,.7,1.62),(side*1.8+.65,.7,1.62),.045,charcoal)
    rod('Propeller vertical blade',(side*1.8,.05,1.62),(side*1.8,1.35,1.62),.045,charcoal)
    joint, pivot = 'body', (0,0,0)
    for z in [-1.6,-1,-.4,.2,.8,1.4]:ball('Cabin porthole',(.018,.095,.12),(side*.49,1.03,z),glass)
    box('Tailplane',(1.6,.09,.65),(side*.9,1,-2.55),teal)
    rod('Landing strut',(side*.8,.72,0),(side*.8,.25,0),.04,charcoal)
    rod('Landing wheel',(side*.8-.07,.2,0),(side*.8+.07,.2,0),.18,charcoal)
box('Tail fin',(.12,1.15,.95),(0,1.53,-2.5),coral)
box('Cockpit windshield',(.6,.22,.08),(0,1.1,2.61),glass)

model('radio');tower(10)
box('Radio equipment house',(3,1.8,2.3),(0,1,1.2),cream)
box('Station canopy',(3.5,.15,2.6),(0,1.98,1.2),teal)
model('concert')
box('Concert plaza',(6,.16,5.5),(0,.08,0),cream)
box('Auditorium',(5.4,2.8,3.8),(0,1.55,-.4),coral)
for i in range(5):
    roof=box('Sculpted acoustic roof',(1.18,.2,4.3),(-2.25+i*1.12,3.2+(.4 if i%2 else 0),-.4),teal)
    roof.rotation_euler.y=(-.22 if i%2 else .22)
glazing(0,1.4,1.54,4.8,1.8)
signboard(0,2.7,1.7,3.1,.6)
for x in [-2,2]:
    box('Concert speaker',(.5,1,.4),(x,.7,2.25),charcoal)
    for y in [.5,.9]:ball('Speaker cone',(.16,.16,.04),(x,y,2.48),'#71868d')
model('television')
box('Television studio',(4.4,3,3.8),(0,1.6,0),cream)
box('Studio roof',(4.7,.2,4.1),(0,3.2,0),charcoal)
signboard(0,2,1.96,3.6,1.5)
rod('Satellite support',(.6,3.3,0),(.6,4.1,0),.1,teal)
bpy.ops.mesh.primitive_uv_sphere_add(segments=16,ring_count=8,radius=1,location=vec((.6,4.3,0)))
o=bpy.context.object;o.scale=(1,.2,.9);o.rotation_euler.x=.4;finish(o,'Studio satellite dish',cream)
rod('Dish receiver',(.6,4.3,0),(.6,4.8,1),.04,coral)
model('skyline')
for x,z,h,w in [(-.6,-.3,9,2.5),(1.35,.3,6,1.1)]:
    box('Stepped office tower',(w,h,2.9),(x,h/2+.2,z),charcoal)
    for y in range(1,h):glazing(x,y+.2,z+1.47,w-.2,.56)
    box('Tower crown',(w+.15,.22,3.05),(x,h+.35,z),teal)
rod('Skyline aerial',(-.6,9.5,-.3),(-.6,11,-.3),.05,coral)
model('digital-research')
box('Technology campus podium',(5.5,1.1,4.6),(0,.65,0),cream)
for x,h in [(-1.4,5.8),(1.2,4.3)]:
    box('Glass campus tower',(2.2,h,3.4),(x,h/2+1.2,0),glass)
    for y in range(2,int(h)+2):box('Floor band',(2.3,.12,3.5),(x,y,0),charcoal)
box('Server room glazing',(2,1,.06),(0,.72,2.34),charcoal)
for x in [-.7,0,.7]:
    for y in [.4,.65,.9]:box('Server status light',(.18,.035,.02),(x,y,2.39),'#83c7be',0)
signboard(0,1.65,2.5,2.2,.55,True)
model('digital-culture')
box('Internet cafe',(4.4,2.6,3.4),(0,1.4,0),cream)
glazing(0,1.4,1.74,4,1.8)
box('Internet canopy',(4.9,.17,1.1),(0,2.7,1.9),teal)
for x in [-1.3,0,1.3]:
    box('Computer desk',(.95,.12,.65),(x,.85,1.45),charcoal)
    box('LCD monitor',(.6,.43,.09),(x,1.21,1.66),charcoal)
    box('Computer screen',(.52,.35,.025),(x,1.21,1.72),'#7dbcca')
signboard(0,3,1.8,2,.55,True)
# Era details augment inherited service buildings without changing their footprint.
model('aviation-detail')
box('Streamlined entrance canopy',(3.6,.12,.65),(0,2.35,2),coral)
rod('Rooftop radio antenna',(1.4,3.3,0),(1.4,4.65,0),.035,charcoal)
for y in [4.1,4.5]:rod('Aerial crossbar',(.9,y,0),(1.9,y,0),.025,charcoal)
model('broadcast-detail')
signboard(.6,2.4,1.85,1.9,.65)
rod('TV aerial mast',(-1.3,3.3,0),(-1.3,4.7,0),.03,charcoal)
for z in [-.5,-.2,.1,.4]:rod('TV aerial dipole',(-1.7,4.6,z),(-.9,4.6,z),.025,charcoal)
model('digital-detail')
signboard(.8,2.4,1.85,1.6,.7,True)
box('Street internet kiosk',(.42,1.45,.36),(-2.7,.8,1.7),charcoal)
box('Kiosk screen',(.32,.48,.04),(-2.7,1.05,1.91),glass)
model('landmark-wing')
box('Public entrance extension',(1.1,1.8,2.3),(-2.65,1,.1),cream)
glazing(-2.65,1.2,1.29,.8,1)
model('landmark-finish')
for x in [-2.7,2.7]:
    rod('City lamp',(x,.1,2.3),(x,2.7,2.3),.055,charcoal)
    box('City lamp head',(.6,.1,.25),(x,2.75,2.3),gold)

# Explicit export: bake evaluated Blender meshes, retaining small animation pivots.
# The game supplies its own shared materials, batching, shadows and lifetime.
bpy.context.view_layer.update()
payload = {'format': 1, 'generator': 'Blender', 'models': {}}
depsgraph = bpy.context.evaluated_depsgraph_get()
for name, root in models.items():
    parts = []
    for obj in root.children:
        evaluated = obj.evaluated_get(depsgraph)
        mesh = evaluated.to_mesh()
        mesh.calc_loop_triangles()
        origin = list(obj['pivot'])
        positions, normals = [], []
        transform = obj.matrix_world
        normal_matrix = transform.to_3x3().inverted().transposed()
        for triangle in mesh.loop_triangles:
            for index in triangle.vertices:
                p = transform @ mesh.vertices[index].co
                normal = mesh.vertices[index].normal if mesh.polygons[triangle.polygon_index].use_smooth else triangle.normal
                n = (normal_matrix @ normal).normalized()
                positions.extend(round(v, 5) for v in (p.x-origin[0], p.z-origin[1], -p.y-origin[2]))
                normals.extend(round(v, 5) for v in (n.x,n.z,-n.y))
        parts.append({'name': obj.name, 'joint': obj['joint'], 'pivot': origin,
                      'color': obj.data.materials[0]['gameColor'], 'positions': positions, 'normals': normals})
        evaluated.to_mesh_clear()
    # Join by joint/material, then index shared vertices. This retains animation
    # pivots and eliminates duplicated triangle data and tiny runtime draw calls.
    buckets = {}
    for part in parts:
        key = (part['joint'], part['color'])
        if key not in buckets:
            buckets[key] = {**part, 'positions': [], 'normals': []}
        buckets[key]['positions'].extend(part['positions'])
        buckets[key]['normals'].extend(part['normals'])
    for part in buckets.values():
        positions, normals, indices, seen = [], [], [], {}
        for i in range(0, len(part['positions']), 3):
            key = tuple(part['positions'][i:i+3] + part['normals'][i:i+3])
            if key not in seen:
                seen[key] = len(positions)//3
                positions.extend(key[:3])
                normals.extend(key[3:])
            indices.append(seen[key])
        part.update(positions=positions, normals=normals, indices=indices)
    payload['models'][name] = list(buckets.values())
(OUTPUT / 'future-meshes.json').write_text(json.dumps(payload, separators=(',', ':')), encoding='utf-8')

# Retain a standard interchange export as well as the compact runtime export.
bpy.ops.export_scene.gltf(filepath=str(SOURCE / 'future.glb'), export_format='GLB')
for i, (name, root) in enumerate(models.items()):
    root.location = vec(((-26 if i == 0 else (i-1)%4*12-10), 0, (0 if i == 0 else (i-1)//4*13-20)))

bpy.ops.object.light_add(type='AREA', location=(0,-8,35))
bpy.context.object.data.energy = 15000
bpy.context.object.data.shape = 'DISK'
bpy.context.object.data.size = 35
bpy.context.scene.world.use_nodes = True
bpy.context.scene.world.node_tree.nodes['Background'].inputs['Color'].default_value = (.65,.65,.65,1)
bpy.context.scene.world.node_tree.nodes['Background'].inputs['Strength'].default_value = .8
bpy.ops.object.light_add(type='SUN', rotation=(.4,-.5,-.4))
bpy.context.object.data.energy = 2
bpy.ops.object.camera_add(location=(40,-60,65))
camera = bpy.context.object
camera.rotation_euler = (Vector((0,0,.5))-camera.location).to_track_quat('-Z','Y').to_euler()
camera.data.type = 'ORTHO'
camera.data.ortho_scale = 100
scene = bpy.context.scene
scene.camera = camera
scene.render.engine = 'CYCLES'
scene.cycles.samples = 12
scene.render.resolution_x = 2200
scene.render.resolution_y = 1650
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = 'PNG'
scene.render.film_transparent = False
scene.view_settings.view_transform = 'Standard'
scene.render.filepath = str(SOURCE / 'review.png')
bpy.context.preferences.filepaths.save_version = 0
bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE / 'future.blend'))
bpy.ops.render.render(write_still=True)
print('FUTURE_EXPORT', {name: sum(len(p['indices'])//3 for p in parts) for name,parts in payload['models'].items()})
