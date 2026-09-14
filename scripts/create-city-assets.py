"""Blender source and deterministic mesh export for the Post-war and Contemporary city families.

Run Blender --background --python this-file.py -- /absolute/repository/path
Coordinates in authoring helpers use the game's X/Y-up/Z convention.
"""
import bpy
import math
import sys
from pathlib import Path
from mathutils import Vector

# Blender --python does not consistently include this script's directory on sys.path.
sys.path.insert(0, str(Path(__file__).resolve().parent))
from blender_assets import AssetPack, vec

art = AssetPack(Path(sys.argv[sys.argv.index('--') + 1]), 'city', teal='#638b88', green='#8fa773')
SOURCE, OUTPUT = art.source, art.output
model, box, ball, rod, loft, finish = art.model, art.box, art.ball, art.rod, art.loft, art.finish
tree, bench = art.tree, art.bench
models = art.models

# Reusable architectural families retain each landmark's footprint and service cues.
# Brick rebuilding courtyards in 1920; timber screens, glass and planted roofs in 2005.
cream, teal, brick, glass, timber, green = '#ddd1ae', '#638b88', '#b79078', '#9cbbb5', '#a3825f', '#8fa773'
def window(x,y,z,w=.6,h=.7):
    box('Inset glazing',(w,h,.07),(x,y,z),glass,0)
    box('Window lintel',(w+.12,.07,.11),(x,y+h/2+.04,z),cream,0)
def planter(x,z):
    box('Stone planter',(.6,.3,.55),(x,.22,z),cream)
    ball('Plant crown',(.28,.27,.25),(x,.51,z),green)
def canopy(x,y,z,w,modern):
    box('Floating canopy',(w,.13,1.25),(x,y,z),teal)
    for dx in [-w/2+.12,w/2-.12]:rod('Slender canopy support',(x+dx,.1,z+.38),(x+dx,y,z+.38),.045,cream)
    if modern:
        for i in range(3):box('Solar canopy strip',(w-.15,.035,.24),(x,y+.09,z-.42+i*.4),'#526f79',0)
def hall(family,modern):
    height=3.4 if family=='residence' else 2.65
    box('Masonry plinth',(4.1,.16,3.25),(0,.1,0),cream)
    box('Retained street block',(3.65,height,2.85),(0,height/2+.18,0),brick if family=='residence' or not modern else cream)
    for y in ([1.15,2.65] if family=='residence' else [1.6]):
        for x in [-1.22,-.4,.42,1.24]:window(x,y,1.46,.55,.8)
    box('Sheltered entrance',(.68,1.25,.12),(0,.81,1.52),teal)
    box('Flat roof cornice',(3.95,.18,3.1),(0,height+.25,0),teal)
    if modern:
        for x in [-1.72,1.72]:
            for dx in [-.14,0,.14]:box('Timber facade fin',(.065,height,.14),(x+dx,height/2+.22,1.55),timber,0)
        box('Roof garden bed',(2.65,.2,1.4),(0,height+.43,-.4),green)
    else:
        box('Horizontal masonry band',(3.85,.15,.14),(0,2.22,1.55),brick)
    if family=='residence':
        for x in [-1.15,1.15]:
            box('Sheltered balcony',(1.25,.13,.75),(x,2.17,1.76),cream)
            box('Balcony screen',(1.25,.47,.08),(x,2.48,2.1),glass if modern else teal)
    elif family in ['culture','research']:
        roof=box('Angled gallery skylight',(2.8,.12,2.1),(0,3.2,0),glass)
        roof.rotation_euler.x=.22 if modern else -.1
        if family=='research':
            for x,h in [(-.6,.7),(0,1.5),(.65,.95)]:
                rod('Crystal pedestal',(x,3.2,0),(x,3.4,0),.2,teal)
                bpy.ops.mesh.primitive_cone_add(vertices=6,radius1=.4,radius2=.12,depth=h,location=vec((x,3.4+h/2,0)))
                finish(bpy.context.object,'Faceted discovery crystal','#84afa9')
    elif family=='retail':
        canopy(0,2.35,1.7,4.4,modern)
        for x in [-1.6,1.6]:planter(x,2.2)
    elif family=='civic':
        if not modern:
            for x in [-1.55,1.55]:box('Rebuilding civic pilaster',(.22,2.6,.2),(x,1.5,1.58),cream)
            box('Stone entablature',(3.9,.32,.28),(0,2.8,1.5),cream)
        canopy(0,2.35,1.75,2.2,modern)
        box('Civic clock face',(.56,.56,.09),(0,2.95,1.56),cream)
        rod('Clock hand',(0,2.95,1.62),(0,3.15,1.62),.018,teal)
        rod('Clock hand',(0,2.95,1.62),(.17,2.88,1.62),.018,teal)

for era in ['post-war','contemporary']:
    modern=era=='contemporary'
    for family in ['residence','civic','culture','research','retail','depot','farm','water','station','river']:
        model(f'{era}-{family}')
        if family in ['residence','civic','culture','research','retail']:hall(family,modern)
        elif family=='depot':
            box('Workshop block',(3.8,2.1,2.8),(0,1.15,0),cream)
            box('Wide service bay',(2.5,1.5,.08),(0,.95,1.45),teal)
            for i in range(5):box('Service door rib',(2.4,.045,.05),(0,.35+i*.25,1.5),glass,0)
            for z in [-.85,0,.85]:
                roof=box('Sawtooth workshop roof',(4.05,.15,.93),(0,2.4,z),teal)
                roof.rotation_euler.x=.23
                if modern:box('Workshop roof panel',(2.7,.06,.5),(0,2.61,z),'#526f79',0)
        elif family=='farm':
            box('Packing barn',(2.7,1.8,2.6),(-.55,1,0),brick)
            roof=box('Packing roof',(3,.18,2.85),(-.55,1.98,0),teal);roof.rotation_euler.x=.12
            if modern:
                for x in [1.45,2.25]:
                    box('Greenhouse bed',(.65,.25,2.4),(x,.2,0),green)
                    box('Greenhouse glazing',(.75,.95,2.5),(x,.83,0),glass)
                    for z in [-1,0,1]:rod('Greenhouse frame',(x-.4,.2,z),(x-.4,1.3,z),.03,cream)
            else:
                for x in [1.35,2.35]:
                    rod('Grain silo',(x,.1,-.45),(x,2.75,-.45),.46,cream)
                    bpy.ops.mesh.primitive_cone_add(vertices=12,radius1=.51,radius2=0,depth=.55,location=vec((x,3,-.45)))
                    finish(bpy.context.object,'Silo crown',teal)
        elif family=='water':
            box('Control house',(2.1,2.1,2.6),(-.9,1.15,0),cream)
            window(-.9,1.5,1.34,1.55,.9)
            rod('Round reservoir',(1.25,.1,-.2),(1.25,2.7,-.2),1.02,glass if modern else '#a4b3a6')
            box('Utility canopy',(2.35,.15,2.8),(-.9,2.33,0),teal)
            if modern:canopy(1.25,2.93,0,2.3,True)
        elif family=='station':
            box('Historic station hall',(2.85,2.6,2.3),(-.4,1.4,.15),cream)
            for x in [-1.3,-.4,.5]:window(x,1.45,1.35,.65,1.2)
            box('Station clock tower',(.75,3.6,.8),(1.5,1.9,.45),brick)
            box('Station clock',(.5,.5,.08),(1.5,3.15,.9),cream)
            rod('Station clock hand',(1.5,3.15,.96),(1.5,3.35,.96),.02,teal)
            canopy(0,2.2,-1.5,5.7,modern)
            box('Long platform',(5.8,.18,1.25),(0,.12,-1.65),cream)
            if modern:
                for x in [-1.5,-.8,0]:
                    rod('Cycle rack',(x,.1,1.8),(x,.65,1.8),.035,teal)
                    rod('Cycle rail',(x,.65,1.8),(x+.35,.65,1.8),.035,teal)
        elif family=='river':
            box('Timber quay',(4.9,.18,3.9),(0,.12,0),timber)
            box('Landing pavilion',(2.1,1.65,1.9),(-.8,.98,-.4),glass if modern else cream)
            canopy(-.6,2.05,0,3.3,modern)
            for x in [-2.25,2.25]:rod('Quay bollard',(x,.1,1.45),(x,.65,1.45),.1,teal)
        # Level additions have separate models so shared meshes are exported just once.
    model(f'{era}-wing')
    box('Side service wing',(1.1,1.85,2),(-2.35,1,.1),cream if modern else brick)
    window(-2.35,1.2,1.14,.65,.8)
    canopy(-2.3,2.08,.1,1.4,modern)
    planter(-2.4,1.75)
    model(f'{era}-finish')
    for x in [-1.4,1.4]:
        planter(x,-1.9)
        rod('Civic lamp',(x,.1,2),(x,1.9,2),.04,teal)
        if modern:box('Flat lamp head',(.5,.08,.22),(x,1.95,2),'#ecdbaa')
        else:ball('Globe lamp',(.16,.19,.16),(x,2.03,2),'#ecdbaa')
    model(f'{era}-garden')
    canopy(-1.4,2.65,-1.75,2.3,modern)
    for x in [-1.6,-.9]:planter(x,2)
    bench(1.65,1.9)
    model(f'{era}-park')
    box('Promenade lawn',(6,.14,5.2),(0,.07,0),green)
    box('Accessible promenade',(5.8,.035,1.2),(0,.18,1.1),cream)
    canopy(0,2.65,-1.4,3.5,modern)
    bench(-1.5,.1);bench(1.5,.1)
    tree(2.3,-1.65)
    model(f'{era}-bridge')
    for x in [-6.2,6.2]:
        for z in [-1.7,1.7]:
            rod('Bridge approach lamp',(x,.15,z),(x,2.25,z),.055,teal)
            box('Bridge lamp head',(.7,.12,.22),(x,2.3,z),'#eddda9')
        if modern:canopy(x,2.5,0,1.5,True)
        else:box('Approach planter',(.6,.4,2.5),(x,.4,0),cream)
    model(f'{era}-mine')
    for x in [-1.55,1.55]:box('Mine safety pillar',(.45,3.1,.5),(x,1.6,1),cream)
    canopy(0,3.28,1.05,3.65,modern)
    box('Mine control kiosk',(.85,1.25,.7),(-2.25,.7,1.1),glass if modern else teal)
    # Compact vehicles keep the village's stylized proportions; wheels are real cylinders.
    for vehicle in ['car','bus','railcar']:
        model(f'{era}-{vehicle}')
        length={'car':1.6,'bus':2.6,'railcar':3.8}[vehicle]
        width=1.05 if vehicle=='railcar' else .75
        box('Vehicle shaped lower shell',(width,.4,length),(0,.46,0),teal if modern else '#c6ad79',.09)
        box('Glazed passenger cabin',(width-.08,.5,length*.77),(0,.87,-.05),glass,.08)
        box('Passenger roof',(width,.13,length*.82),(0,1.17,-.05),cream,.05)
        for z in [-length*.32,length*.32]:
            rod('Axle',(-width*.54,.25,z),(width*.54,.25,z),.17,'#4e5d57')
        for z in [-length*.2,0,length*.2]:
            box('Window divider',(width,.46,.035),(0,.89,z),teal,0)
        if vehicle=='railcar' and modern:
            rod('Electric pickup',(-.25,1.22,0),(0,1.65,.25),.035,teal)
            rod('Electric pickup',(0,1.65,.25),(.25,1.22,0),.035,teal)
        if vehicle=='bus' and modern:box('Electric bus roof pack',(.55,.15,.75),(0,1.32,-.3),teal)

    model(f'{era}-boat')
    loft('Shaped river hull',[(0,0,-2.6,.18,.15),(0,0,-1.7,1,.33),(0,0,1.65,1,.33),(0,.05,2.6,.12,.18)],teal if modern else '#765c42')
    box('Passenger deck',(1.9,.13,3.8),(0,.3,0),cream)
    box('Glazed cabin',(1.4,.85,2.35),(0,.79,-.2),glass if modern else cream,.08)
    box('Launch canopy',(1.8,.12,2.9),(0,1.29,-.2),teal)
    for side in [-1,1]:
        for z in [-.8,0,.8]:box('Cabin window',(.06,.42,.48),(side*.71,.87,z),glass,0)
        rod('Deck handrail',(side*.88,.75,-1.85),(side*.88,.75,1.85),.035,cream)
    if modern:
        for z in [-.9,-.3,.3]:box('Solar ferry roof panel',(1.5,.035,.43),(0,1.38,z),'#526f79',0)
        box('Quiet electric pilot cabin',(1.1,.4,.65),(0,1.46,.8),glass)
    else:
        rod('Launch funnel',(0,1.28,-.8),(0,1.95,-.8),.14,'#52635b')
        box('Pilot windscreen',(1.15,.35,.07),(0,1.48,.85),glass,0)

model('post-war-locomotive')
box('Steam locomotive chassis',(1.05,.4,3.6),(0,.4,0),teal)
rod('Round boiler',(0,.9,-.2),(0,.9,1.25),.42,'#52635b')
box('Engine cab',(1.04,1.1,1),(0,1,-1.1),brick)
box('Cab roof',(1.2,.15,1.2),(0,1.64,-1.1),teal)
rod('Steam funnel',(0,1.2,.85),(0,1.95,.85),.16,'#52635b')
for z in [-1.1,-.3,.5,1.15]:rod('Locomotive axle',(-.6,.3,z),(.6,.3,z),.24,'#4e5d57')
model('storm-debris')
for i in range(3):
    rod('Fallen branch',(-.8+i*.4,.12,i*.4),(.6+i*.3,.16,-.5+i*.4),.075,timber)
    rod('Broken twig',(-.25+i*.4,.14,-.1+i*.4),(-.7+i*.4,.17,-.4+i*.4),.035,timber)
model('marker-doctor')
box('Clinic cross horizontal',(.65,.15,.08),(-1.1,2.05,1.54),'#b47766')
box('Clinic cross vertical',(.15,.65,.08),(-1.1,2.05,1.55),'#b47766')
model('marker-sheriff')
bpy.ops.mesh.primitive_circle_add(vertices=6,radius=.31,fill_type='NGON',location=vec((-1.1,2.05,1.55)),rotation=(math.pi/2,0,0))
finish(bpy.context.object,'Public safety badge','#c9ad74')
model('marker-bank')
for x in [-1.25,-.65,.65,1.25]:box('Bank frontage column',(.12,1.65,.22),(x,1.08,1.6),cream)
model('marker-blacksmith')
box('Forge anvil base',(.55,.22,.3),(-1.25,.23,1.9),teal)
box('Forge anvil horn',(.85,.18,.32),(-1.2,.44,1.9),'#53635c')

payload = art.export(OUTPUT / 'city-meshes.json')
if '--meshes-only' in sys.argv:
    raise SystemExit(0)

# Retain a standard interchange export as well as the compact runtime export.
bpy.ops.export_scene.gltf(filepath=str(SOURCE / 'city.glb'), export_format='GLB')
for i, (name, root) in enumerate(models.items()):
    root.location = vec(((i%7-3)*8, 0, (i//7-2)*7))

bpy.ops.object.light_add(type='AREA', location=(0,-8,35))
bpy.context.object.data.energy = 15000
bpy.context.object.data.shape = 'DISK'
bpy.context.object.data.size = 35
bpy.context.scene.world.color = (.65,.65,.65)
bpy.ops.object.camera_add(location=(33,-43,45))
camera = bpy.context.object
camera.rotation_euler = (Vector((0,0,.5))-camera.location).to_track_quat('-Z','Y').to_euler()
camera.data.type = 'ORTHO'
camera.data.ortho_scale = 70
scene = bpy.context.scene
scene.camera = camera
scene.render.engine = 'CYCLES'
scene.cycles.samples = 24
scene.render.resolution_x = 2200
scene.render.resolution_y = 1650
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = 'PNG'
scene.render.film_transparent = False
scene.view_settings.view_transform = 'Standard'
scene.render.filepath = str(SOURCE / 'review.png')
bpy.context.preferences.filepaths.save_version = 0
bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE / 'city.blend'))
bpy.ops.render.render(write_still=True)
print('CITY_EXPORT', {name: sum(len(p['indices'])//3 for p in parts) for name,parts in payload['models'].items()})
