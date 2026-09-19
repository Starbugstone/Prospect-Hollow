"""Blender source and deterministic mesh export for aviation, broadcast and connected-city assets.

Run Blender --background --python this-file.py -- /absolute/repository/path
Coordinates in authoring helpers use the game's X/Y-up/Z convention.
"""
import bpy
import math
import json
import sys
from pathlib import Path
from mathutils import Vector

# Blender --python does not consistently include this script's directory on sys.path.
sys.path.insert(0, str(Path(__file__).resolve().parent))
from blender_assets import AssetPack, vec

art = AssetPack(Path(sys.argv[sys.argv.index('--') + 1]), 'future')
SOURCE, OUTPUT = art.source, art.output
model, box, ball, rod, loft, finish = art.model, art.box, art.ball, art.rod, art.loft, art.finish
models = art.models
airport_layout = json.loads((art.output.parent / 'data' / 'airportLayout.json').read_text())


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

def airport(style):
    hangar = airport_layout['hangar']
    front, back, center_z, radius = (hangar[k] for k in ['frontX','backX','centerZ','roofRadius'])
    center_x = (front + back) / 2
    depth = back - front
    model(style['asset'])
    box('Airfield grass verge',(20,.14,40),(0,.02,0),'#91a66e',0)
    box('Terminal and hangar apron',(10.2,.05,27),(3.8,.115,1.5),'#9baba2',0)
    box('North south runway',(4.8,.055,38),(-5,.12,0),'#657777',0)
    for z in range(-16,18,4):box('Runway center stripe',(.12,.012,1.6),(-5,.155,z),cream,0)
    for z in [-17.5,17.5]:
        for x in [-6.5,-5.9,-5.3,-4.7,-4.1,-3.5]:box('Threshold piano key',(.3,.013,1.6),(x,.155,z),cream,0)
    for x in [-7.6,-2.4]:
        for z in range(-18,20,3):
            box('Runway edge light',(.15,.13,.15),(x,.2,z),gold,0)
    # A runway-facing hangar exits west; the lounge stays north of its wing envelope.
    box('Hangar taxiway',(front+5.2,.06,radius*2-.3),((front-4.8)/2,.13,center_z), '#788b87',0)
    box('Hangar taxiway centerline',(front+5.2,.012,.09),((front-4.8)/2,.168,center_z),gold,0)
    for z in [center_z-radius+.2,center_z+radius-.2]:
        box('Taxiway edge stripe',(front+5.2,.012,.06),((front-4.8)/2,.168,z),cream,0)
    box('Passenger forecourt',(7.1,.12,11),(4.65,.2,-2.4),cream)
    box('Terminal plinth',(6.2,.27,7.8),(4.5,.37,-3),teal)
    box('Terminal concourse',(6,2.2,7.6),(4.5,1.55,-3),glass if style['curtainWall'] else style['wall'])
    box('Terminal roof fascia',(6.5,.18,8.1),(4.5,2.72,-3),style['frame'])
    box('Cantilever terminal roof',(6.7,.19,8.3),(4.5,2.89,-3),style['roof'],.06)
    # Repeated framed bays on both long elevations read from either orbit direction.
    for x in [1.46,7.54]:
        for z in [-5.65,-3.3,-.95]:
            box('Recessed terminal bay',(.055,1.5,1.92),(x,1.65,z),charcoal,0)
            box('Terminal glass',(.07,1.3,1.74),(x,1.66,z),glass,0)
            box('Terminal window mullion',(.09,1.42,.065),(x,1.66,z),cream,0)
            box('Terminal window sill',(.18,.1,2),(x,1,z),cream,0)
    glazing(4.5,1.65,.835,4.6,1.45)
    box('Entrance door frame',(1.3,1.9,.08),(4.5,1.42,.9),teal,0)
    glazing(4.5,1.44,.95,1.08,1.7)
    box('Entrance canopy',(5.2,.17,1.25),(4.5,2.36,1.3),teal)
    for x in [2.15,6.85]:
        box('Canopy column',(.13,2.1,.13),(x,1.31,1.78),cream)
    box('Entrance step',(5.2,.12,1.2),(4.5,.23,1.45),cream)
    # The tower grows from the terminal's north corner, with a framed lookout cabin.
    box('Control tower base',(2.05,.26,2.25),(5.8,.34,-6.2),teal)
    box('Control tower shaft',(1.85,4.65,2.05),(5.8,2.7,-6.2),style['wall'],.06)
    for y in [3.4,4.25]:
        glazing(5.8,y,-5.155,.65,.42)
    box('Control cabin sill',(2.8,.2,2.8),(5.8,5.08,-6.2),teal)
    box('Panoramic control room',(2.5,1.05,2.5),(5.8,5.7,-6.2),glass,.06)
    for x in [4.54,5.8,7.06]:
        for z in [-7.46,-4.94]:
            box('Control room frame',(.09,1.13,.09),(x,5.7,z),cream,0)
    for x in [4.54,7.06]:
        box('Side cabin mullion',(.09,1.13,.09),(x,5.7,-6.2),cream,0)
    box('Control tower roof',(2.95,.2,2.95),(5.8,6.33,-6.2),style['roof'],.06)
    rod('Control aerial',(5.8,6.43,-6.2),(5.8,7.3,-6.2),.035,charcoal)
    ball('Tower beacon',(.09,.09,.09),(5.8,7.32,-6.2),coral)

    # Rotate the barrel hangar by 90 degrees: its open west end faces the
    # runway, not the passenger lounge. The 9.1-wide opening fits the actual
    # 8.2-wide aircraft, and separate walls leave a usable interior.
    profile = [(3.05+math.sin(i*math.pi/12)*1.25,
                center_z+math.cos(i*math.pi/12)*radius) for i in range(13)]
    vertices = [tuple(vec((x,y,z))) for x in [front,back] for y,z in profile]
    # Reversed winding compared with the former north/south vault.
    faces = [(i+13,i+14,i+1,i) for i in range(12)]
    faces += [tuple(range(13)),tuple(reversed(range(13,26))), (12,25,13,0)]
    mesh = bpy.data.meshes.new('Runway-facing barrel roof')
    mesh.from_pydata(vertices,[],faces)
    mesh.update()
    obj = bpy.data.objects.new('Runway-facing barrel roof',mesh)
    bpy.context.collection.objects.link(obj)
    finish(obj,'Runway-facing barrel roof',style['roof'])

    box('Flush hangar floor',(depth+.1,.04,radius*2),(center_x,.14,center_z),'#9baba2',0)
    for z in [center_z-radius+.12,center_z+radius-.12]:
        box('Hangar side wall',(depth,2.89,.24),(center_x,1.605,z),style['wall'])
    box('Hangar rear wall',(.2,2.89,radius*2),(back-.1,1.605,center_z),style['wall'])
    box('Shaded hangar interior',(.02,2.7,radius*2-.5),(back-.21,1.59,center_z),'#526865',0)
    for x in [front-.025,back+.025]:
        for i in range(12):
            y,z=profile[i]; next_y,next_z=profile[i+1]
            rod('Hangar arch trim',(x,y,z),(x,next_y,next_z),.045,cream)
    box('Hangar door lintel',(.22,.2,radius*2),(front-.02,2.95,center_z),cream)
    # Concertina leaves are folded against the jambs, not painted onto a solid wall.
    for side in [-1,1]:
        for n in range(4):
            leaf=box('Folded hangar door',(.7,2.6,.1),(front-.27,1.55,center_z+side*(radius-.33+n*.085)),teal,0)
            leaf.rotation_euler.z=side*(.12 if n%2 else -.12)
        box('Hangar door jamb',(.22,2.7,.18),(front-.02,1.56,center_z+side*(radius-.13)),cream,0)
    box('Hangar interior centerline',(depth-.25,.012,.09),(center_x-.125,.168,center_z),gold,0)

    # Era architecture is baked into the base, not floated above a historic roof.
    if style['clerestory']:
        box('Stepped departure hall',(5.2,1.15,4.5),(4.5,3.5,-2.8),style['wall'])
        glazing(4.5,3.55,-.52,4.7,.7)
        for x in [1.88,7.12]:
            box('Clerestory ribbon',(.07,.65,3.9),(x,3.55,-2.8),glass,0)
            for z in [-4.4,-3.3,-2.2,-1.1]:
                box('Clerestory frame',(.1,.75,.075),(x,3.55,z),charcoal,0)
        box('Departure hall parapet',(5.65,.22,4.9),(4.5,4.13,-2.8),style['roof'])
        box('Period coral fascia',(5.7,.12,5),(4.5,3.97,-2.8),style['frame'])
    if style['curtainWall']:
        for x in [1.43,7.57]:
            for z in [-6.5,-5.3,-4.1,-2.9,-1.7,-.5,.65]:
                box('Curtain wall fin',(.22,2.15,.085),(x,1.58,z),cream,0)
        box('Floating roof cap',(6.95,.13,8.5),(4.5,3.1,-3),cream)
    if style['skylights']:
        for z in [-3.8,-1.8]:
            box('Rooflight upstand',(3.5,.18,1.25),(4.5,3.22,z),charcoal)
            box('Blue glass rooflight',(3.3,.12,1.08),(4.5,3.36,z),glass)
            for x in [3.4,4.5,5.6]:
                box('Rooflight glazing bar',(.065,.14,1.12),(x,3.37,z),cream,0)

    model(style['asset']+'-wing')
    box('Lounge plinth',(6.2,.22,2.6),(4.5,.29,3.6),teal)
    box('Expanded passenger lounge',(6,1.65,2.5),(4.5,1.21,3.6),glass if style['curtainWall'] else style['wall'])
    glazing(4.5,1.28,4.88,5.4,1.18)
    for x in [1.46,7.54]:
        box('Lounge side glazing',(.06,1.18,2),(x,1.28,3.6),glass,0)
        box('Lounge side mullion',(.09,1.3,.065),(x,1.28,3.6),cream,0)
    box('Lounge roof fascia',(6.45,.13,2.85),(4.5,2.09,3.6),style['frame'])
    box('Lounge roof',(6.6,.18,3),(4.5,2.24,3.6),style['roof'])
    model(style['asset']+'-finish')
    for z in [-9.5,5.8]:
        rod('Apron lamp',(8.3,.15,z),(8.3,3.3,z),.065,teal)
        box('Apron floodlight',(.65,.15,.35),(8.3,3.35,z),gold)
    for z in [-3.8,-.8]:
        box('Forecourt planter',(.6,.38,1.5),(8.15,.37,z),cream)
        box('Clipped forecourt shrub',(.5,.45,1.35),(8.15,.75,z),'#91a66e',.13)
    # A small period windsock provides an aviation cue without cluttering the roofline.
    rod('Windsock mast',(7.9,.15,16),(7.9,3,16),.045,cream)
    loft('Windsock',[(7.9,2.95,16,.22,.22),(7.9,2.92,16.4,.18,.18)],coral)
    loft('Windsock band',[(7.9,2.92,16.4,.18,.18),(7.9,2.86,16.8,.13,.13)],cream)
    loft('Windsock tip',[(7.9,2.86,16.8,.13,.13),(7.9,2.78,17.2,.07,.07)],coral)

    if style['clerestory'] or style['curtainWall']:
        rod('Departures board post',(8.1,.2,3.6),(8.1,1.65,3.6),.06,charcoal)
        signboard(8.1,1.85,3.6,1.1,.7,style['curtainWall'])


airport_styles = json.loads((art.output.parent / 'data' / 'airportStyles.json').read_text())
for style in airport_styles.values():
    airport(style)

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
    art.joint = 'propellerLeft' if side < 0 else 'propellerRight'
    art.pivot = (side*1.8,.7,1.62)
    ball('Propeller spinner',(.13,.13,.2),art.pivot,coral)
    rod('Propeller horizontal blade',(side*1.8-.65,.7,1.62),(side*1.8+.65,.7,1.62),.045,charcoal)
    rod('Propeller vertical blade',(side*1.8,.05,1.62),(side*1.8,1.35,1.62),.045,charcoal)
    art.joint, art.pivot = 'body', (0,0,0)
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

payload = art.export(OUTPUT / 'future-meshes.json')
if '--meshes-only' in sys.argv:
    raise SystemExit(0)

# Retain a standard interchange export as well as the compact runtime export.
bpy.ops.export_scene.gltf(filepath=str(SOURCE / 'future.glb'), export_format='GLB')
airport_names = {style['asset']: i for i, style in enumerate(airport_styles.values())}
other_index = 0
for name, root in models.items():
    airport_name = next((base for base in airport_names if name in [base,base+'-wing',base+'-finish']), None)
    if airport_name:
        root.location = vec((airport_names[airport_name]*25-25,0,-20))
    else:
        root.location = vec((other_index%5*12-25,0,15+other_index//5*13))
        other_index += 1

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
camera.data.ortho_scale = 125
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
