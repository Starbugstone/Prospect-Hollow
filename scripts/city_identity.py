"""Purpose-specific architecture shared by all city periods; no landmark aliases."""
import json, math
from pathlib import Path

def author_city_identity(art, styles):
    box,ball,rod,model=art.box,art.ball,art.rod,art.model
    catalog=json.loads((art.output.parent/'data'/'cityBuildingStyles.json').read_text())
    for era,s in styles.items():
        wall,roof,brick=s['wall'],s['roof'],s['brick']
        glass,green='#9cbbb5','#8fa773'
        def window(x,y,z,w=.6,h=.75):
            box('Glazing',(w,h,.08),(x,y,z),glass,0)
            box('Lintel',(w+.12,.08,.12),(x,y+h/2+.04,z),wall)
        def canopy(x,y,z,w,depth=1.2):
            box('Entrance canopy',(w,.18,depth),(x,y,z),roof)
            for dx in [-w/2+.15,w/2-.15]:rod('Canopy column',(x+dx,.15,z+.35),(x+dx,y,z+.35),.065,wall)
        def clock(x,y,z):
            ball('Clock dial',(.32,.32,.07),(x,y,z),wall)
            rod('Clock minute',(x,y,z+.08),(x,y+.24,z+.08),.025,roof)
            rod('Clock hour',(x,y,z+.08),(x+.16,y-.1,z+.08),.025,roof)
        for kind,c in catalog.items():
            model(f'{era}-kind-{kind}')
            w,h=c['width'],c['height']; cue=c['identity']; family=c['family']
            d=2.6
            box('Plot plinth',(w+.3,.18,d+.35),(0,.1,0),wall)
            if cue in ['court','row','twin']:
                count=2 if cue=='twin' else 3
                for i in range(count):
                    x=(i-(count-1)/2)*w/count
                    box('Separate dwelling',(w/count-.22,h,d),(x,h/2+.2,0),brick)
                    box('Dwelling cornice',(w/count,.2,d+.2),(x,h+.3,0),roof)
                    for y in [1.2+j*1.3 for j in range(max(1,int(h/1.3)))]:window(x,y,1.34,w/count-.5)
                    box('Own front door',(.45,1.1,.12),(x,.75,1.39),roof)
            else:
                box('Purpose built hall',(w,h,d),(0,h/2+.2,0),brick if family in ['residence','depot'] else wall)
                box('Period roof',(w+.25,.2,d+.25),(0,h+.3,0),roof)
                for y in [1.3+j*1.4 for j in range(max(1,int(h/1.4)))]:
                    for x in [-w*.32,w*.32]:window(x,y,1.34,w*.22)
                box('Entrance',(.65,1.25,.14),(0,.82,1.4),roof)
                if s['streamlined']:box('Ribbon window band',(w-.3,.5,.08),(0,h-.2,1.36),glass,0)
                if s['modern']:
                    for x in [-w/2,w/2]:box('Facade blade',(.14,h,.3),(x,h/2+.2,1.35),roof)
            if cue in ['porch','hotel','balconies','terrace']:
                canopy(0,2.2,2,w+.25)
                for y in ([2.55,3.95] if cue in ['hotel','balconies'] else [2.55] if cue=='terrace' else []):
                    box('Balcony deck',(w+.15,.15,.8),(0,y,1.65),wall)
                    box('Balcony balustrade',(w,.5,.08),(0,y+.3,2.03),roof)
            if cue in ['terrace','diner','reading']:
                box('Outdoor terrace',(w+.3,.16,1.6),(0,.22,2.15),brick)
                for x in [-w*.3,w*.3]:
                    rod('Cafe table foot',(x,.3,2.4),(x,.85,2.4),.07,roof)
                    box('Cafe table',(.65,.1,.6),(x,.85,2.4),wall)
                if cue=='diner':
                    canopy(0,2,2.1,w+.4)
                    box('Diner roof fin',(.2,1,1.4),(w*.36,h+.85,0),brick)
            if cue=='columns':
                for x in [-1.5,-.65,.65,1.5]:rod('Bank column',(x,.2,1.9),(x,3.1,1.9),.17,wall)
                box('Bank entablature',(4,.4,.85),(0,3.2,1.9),brick)
            if cue in ['clock','bell','museum','fire']:
                x=w*.3 if cue=='fire' else 0
                box('Identity tower',(.95,1.7,.9),(x,h+1.05,-.4),brick)
                box('Tower cap',(1.2,.18,1.2),(x,h+1.95,-.4),roof)
                if cue!='fire':clock(x,h+1.25,.1)
                if cue=='bell':ball('School bell',(.22,.3,.22),(0,h+.75,.22),'#c6a562')
            if cue=='museum':
                for x in [-1.35,1.35]:
                    box('Gem display plinth',(.8,.65,.75),(x,.55,2),brick)
                    ball('Mineral specimen',(.28,.5,.28),(x,1.22,2),'#a28abd')
                    box('Display glass',(.7,.8,.05),(x,1.2,2.4),glass)
                g=box('Display gable',(2.6,.15,1.5),(0,h+.55,0),glass);g.rotation_euler.x=.24
            if cue=='clinic':
                for size in [(1,.23,.14),(.23,1,.14)]:box('Clinic cross',size,(0,h+.85,1.2),'#b47766')
                canopy(0,2,2,w)
            if cue=='patrol':
                box('Patrol office lookout',(1.25,1.1,1.3),(.7,h+.85,-.25),glass)
                box('Patrol roof',(1.45,.15,1.5),(.7,h+1.47,-.25),roof)
                ball('Public safety badge',(.4,.4,.08),(0,2,1.53),'#d9b969')
            if cue=='post':
                canopy(0,2.2,1.85,3.7)
                for x in [-1.3,1.3]:box('Post box',(.55,.95,.55),(x,.6,2.1),'#91644f')
                rod('Telegraph mast',(1.4,h,0),(1.4,h+1.6,0),.07,roof)
            if cue in ['shop','market','supermarket']:
                canopy(0,2,2,w+.5)
                if cue=='market':
                    for x in [-1.4,0,1.4]:
                        box('Produce stall',(1,.8,.75),(x,.6,2.1),brick)
                        ball('Produce display',(.4,.18,.3),(x,1.1,2.1),green)
                if cue=='supermarket':box('Loading wing',(1.2,1.8,2),(w/2+.35,1.1,-.4),brick)
            if family=='depot':
                bays=2 if cue in ['fire','garage','warehouse'] else 1
                for i in range(bays):
                    x=(i-(bays-1)/2)*1.65
                    box('Engine or service bay',(1.4,1.8,.12),(x,1.1,1.4),roof)
                    for y in [.5,.85,1.2,1.55]:box('Bay door rib',(1.3,.06,.06),(x,y,1.48),glass)
                if cue in ['forge','mill']:
                    rod('Workshop chimney',(w/2-.35,.2,-.6),(w/2-.35,h+2,-.6),.24,brick)
                if cue in ['freight','warehouse']:
                    box('Freight loading deck',(w,.4,1.5),(0,.3,2.1),brick)
                    for x in [-1.2,.9]:box('Freight crate',(.8,.95,.8),(x,.97,2.1),'#a3825f')
                if cue=='stable':canopy(1.1,2.4,2.2,2.2)
            if family=='water':
                count=2 if cue=='tanks' else 1
                for i in range(count):
                    x=w/2+.4+i*.85
                    rod('Reservoir',(x,.15,-.2),(x,3,-.2),.65 if count==1 else .48,glass)
                if cue=='power':
                    for x in [-.8,.2,1.2]:rod('Transformer',(x,h+.4,0),(x,h+1.3,0),.2,roof)
            if cue=='farm':
                rod('Grain silo',(2,.2,-.4),(2,3.8,-.4),.65,wall)
                ball('Silo cap',(.7,.4,.7),(2,3.8,-.4),roof)
                for z in [1.8,2.2,2.6]:box('Growing field',(3,.15,.25),(0,.22,z),green)
            if family=='station':
                canopy(0,2.3,-2,w+1.5,1.6)
                box('Platform',(w+1.8,.22,1.8),(0,.15,-2),wall)
                if cue=='rail':clock(0,h+.6,1.4)
                if cue=='transit':
                    for x in [-1.3,1.3]:canopy(x,3.8,0,1.1,3.2)
                # Bicycle stands are complete inverted U frames in a side court.
                if s['modern']:
                    for z in [-.5,.2,.9]:
                        for x in [w/2+.2,w/2+.65]:rod('Cycle stand',(x,.2,z),(x,.75,z),.04,roof)
                        rod('Cycle stand top',(w/2+.2,.75,z),(w/2+.65,.75,z),.04,roof)
            if cue=='crystal':
                for x,hc in [(-.6,1),(0,1.8),(.6,1.2)]:ball('Crystal atrium',(.45,hc,.5),(x,h+.7,0),'#84afa9')
            if cue in ['fish','port']:
                canopy(0,2,1.9,w+.6)
                if cue=='port':
                    rod('Loading crane',(2,.2,0),(2,4,0),.14,roof)
                    rod('Crane jib',(2,4,0),(3.6,4,0),.14,roof)
                else:box('Fish smoking shed',(1,1.5,1.4),(1.9,.95,-.4),brick)
            # Add-ons depend on the building's purpose and remain behind the expansion.
            if c['detail']=='aerial' and era!='post-war':
                rod('Roof antenna',(w*.3,h+.4,-.7),(w*.3,h+1.6,-.7),.035,roof)
                rod('Antenna crossbar',(w*.3-.6,h+1.3,-.7),(w*.3+.6,h+1.3,-.7),.025,roof)
            if c['detail']=='billboard' and s['modern']:
                box('Retail roof billboard',(2,.9,.16),(0,h+1,-.5),brick)
            if s['solar']:
                box('Roof solar array',(w*.6,.08,.85),(0,h+.45,-.6),'#526f79')
            # Family-specific finish: visible planted terrace, with clearance over each roof.
            model(f'{era}-kind-{kind}-finish')
            for x in [-w*.3,w*.3]:
                box('Roof terrace planter',(.7,.35,.75),(x,h+.6,-.4),wall)
                ball('Roof planting',(.35,.35,.38),(x,h+.95,-.4),green)
            for x in [-w/2+.1,w/2-.1]:rod('Terrace rail post',(x,h+.4,.9),(x,h+1,.9),.045,roof)
            rod('Terrace railing',(-w/2+.1,h+1,.9),(w/2-.1,h+1,.9),.045,roof)
            for x in [-w/2-.2,w/2+.2]:
                rod('Forecourt lamp',(x,.2,2.9),(x,2.5,2.9),.055,roof)
                ball('Forecourt light',(.18,.2,.18),(x,2.6,2.9),'#ecdbaa')

def author_city_aircraft(art):
    import bpy
    from blender_assets import vec
    for name,length,span,rear in [('airplane-jet',8.2,8.2,False),('airplane-regional-jet',6.5,6.8,True)]:
        art.model(name)
        art.loft('Jet fuselage',[(0,.9,-length/2,.09,.16),(0,.9,-length*.3,.42,.42),(0,.9,length*.28,.44,.44),(0,.86,length/2,.025,.06)],'#ddd1ae')
        for side in [-1,1]:
            points=[(.3*side,.8,.8),(span/2*side,.78,-1.1),(span/2*side,.7,-1.6),(.3*side,.7,-.65)]
            mesh=bpy.data.meshes.new('Swept jet wing');mesh.from_pydata([vec(p) for p in points],[],[(0,1,2,3) if side<0 else (3,2,1,0)]);mesh.update()
            obj=bpy.data.objects.new('Jet wing',mesh);bpy.context.collection.objects.link(obj)
            mod=obj.modifiers.new('Wing thickness','SOLIDIFY');mod.thickness=.1
            art.finish(obj,'Swept jet wing','#638b88')
            x=side*(.65 if rear else 1.65);z=-length*.3 if rear else -.1
            art.loft('Jet turbine',[(x,.65,z-.6,.18,.18),(x,.65,z+.5,.27,.27),(x,.65,z+.6,.22,.22)],'#526775')
            art.ball('Turbine inlet',(.17,.17,.03),(x,.65,z+.62),'#36454e')
            for wz in [-1.8,-1.2,-.6,0,.6,1.2,1.8]:art.ball('Jet cabin window',(.025,.09,.12),(side*.43,1.02,wz),'#85b8c8')
            art.box('Jet tailplane',(1.3,.12,.7),(side*.8,1.2,-length*.36),'#638b88')
            art.rod('Landing gear',(side*.7,.65,0),(side*.7,.22,0),.05,'#526775')
            art.rod('Landing wheel',(side*.7-.08,.2,0),(side*.7+.08,.2,0),.18,'#36454e')
            if rear:art.rod('Winglet',(side*span/2,.75,-1.2),(side*span/2,1.25,-1.4),.06,'#638b88')
        art.box('Jet tail fin',(.14,1.4,1),(0,1.7,-length*.35),'#638b88')
        art.box('Cockpit glazing',(.52,.25,.08),(0,1.08,length*.39),'#85b8c8')
