"""Package production screenshots from the local VIP browser review.

Run after capture: python3 scripts/package-vip-review.py
The gallery is standalone and works offline; missing required PNGs fail packaging.
"""
from pathlib import Path
import html
import json
import zipfile

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'output/vip-review'
ERAS = [
    ('frontier', '1865–1880 · Frontier Settlement', 'Stable foot visit'),
    ('river-rail', '1884 · River & Rail Boom', 'Train arrival'),
    ('industrial', '1908 · Industrial / Electric Town', 'Boat arrival'),
    ('post-war', '1920 · Post-war Rebuilding', 'Train arrival'),
    ('motor-age', '1932 · Motor Age', 'Boat arrival'),
    ('aviation', '1958 · Aviation & Radio', 'Plane arrival'),
    ('broadcast', '1986 · Music & Television', 'Plane arrival'),
    ('contemporary', '2005 · Connected City', 'Plane arrival'),
]
CSS = '''*{box-sizing:border-box}body{margin:0;background:#eee8d8;color:#294b49;font:16px/1.5 system-ui,sans-serif}main{max-width:1440px;margin:auto;padding:26px}h1{font:36px Georgia;margin:0 0 8px}h2{font:28px Georgia;margin:20px 0 10px}p{margin:6px 0 16px}nav{position:sticky;top:0;background:#f8f4e8f5;padding:14px;z-index:10;border-bottom:1px solid #d4c8ae;display:flex;gap:18px;align-items:center;flex-wrap:wrap}select{padding:8px;font:inherit;color:inherit}a{color:#38695e}figure{margin:0;background:#faf6eb;border:1px solid #d9cdae;border-radius:8px;overflow:hidden}figcaption{padding:8px 12px;font-size:15px;font-weight:600}img{display:block;width:100%;height:auto}.grid{display:grid;grid-template-columns:1fr 1fr;gap:14px}.wide{grid-column:1/-1}.note{font-size:14px;color:#64736b}.inset img{max-width:480px;margin:auto}.thumbs{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}.thumbs figcaption{font-size:13px}button{font:inherit;padding:8px} @media(max-width:750px){main{padding:12px}.grid,.thumbs{grid-template-columns:1fr}h1{font-size:28px}}'''

def page(title, body, script=''):
    return f'<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>{html.escape(title)}</title><style>{CSS}</style></head><body>{body}<script>{script}</script></body></html>'

def figure(file, label, cls=''):
    return f'<figure class="{cls}"><figcaption>{label}</figcaption><a href="{file}" target="_blank"><img src="{file}" alt="{html.escape(label)}" loading="eager"></a></figure>'

required=[]
for era, _, _ in ERAS:
    for gender in ['male','female']:
        for variant in range(3):
            for mode in ['comparison','arrival','wandering','leaving'] + ([] if era=='frontier' else ['inset']):
                for named in [False,True]:
                    required.append(f'{era}-{gender}-v{variant}-{mode}{"-named" if named else ""}.png')
missing=[name for name in required if not (OUT/name).is_file()]
if missing:
    raise SystemExit(f'Missing {len(missing)} required captures; first: {missing[:5]}')

options=''.join(f'<option value="{era}">{title}</option>' for era,title,_ in ERAS)
nav=f'''<nav><strong>VIP visual review</strong><label>Era <select id="era">{options}</select></label><label>Gender <select id="gender"><option value="male">Male</option><option value="female">Female</option></select></label><label>Outfit <select id="variant"><option value="0">1 · Lapels</option><option value="1">2 · Scarf</option><option value="2">3 · Satchel</option></select></label><label><input id="names" type="checkbox" checked> Name tags</label></nav>'''
intro='''<h1>VIPs across all eight eras</h1><p>48 clothing combinations, each compared with an ordinary villager and captured arriving, wandering and leaving. All images use the production 3D renderer. Click an image for full resolution.</p><p><a href="clothing.html">All eras at a glance</a> · <a href="captures.html">Every captured image</a> · <a href="manifest.json">Image manifest</a></p><p class="note">One VIP per village scene. The main-view name appears on hover/tap; the six-second arrival inset always shows the name in gameplay. Unnamed inset pictures are review comparisons only. Frontier visitors walk from the stable, before passenger transport unlocks.</p>'''
script='''const eras=ERADATA;function render(){const era=document.querySelector('#era').value,gender=document.querySelector('#gender').value,v=document.querySelector('#variant').value,named=document.querySelector('#names').checked,suffix=named?'-named':'',prefix=`${era}-${gender}-v${v}`;const row=eras.find(e=>e[0]===era);document.querySelector('#title').textContent=`${row[1]} · ${gender} · outfit ${+v+1}`;document.querySelector('#sheet').href=era+'.html';const modes=[['comparison','Ordinary villager (left) / VIP (right)'],['arrival',row[2]],['wandering','Wandering through the village'],['leaving','Returning to the same building']];if(era!=='frontier')modes.push(['inset','Arrival window · secondary camera']);document.querySelector('#views').innerHTML=modes.map(([mode,label])=>{const file=`${prefix}-${mode}${suffix}.png`;return `<figure class="${mode==='inset'?'inset':''}"><figcaption>${label}</figcaption><a href="${file}" target="_blank"><img src="${file}" alt="${label}"></a></figure>`}).join('');}document.querySelectorAll('select,input').forEach(el=>el.addEventListener('change',render));render();'''.replace('ERADATA',json.dumps(ERAS))
(OUT/'index.html').write_text(page('Prospect Hollow · VIP visual review',nav+'<main>'+intro+'<h2 id="title"></h2><p><a id="sheet">All six outfits in this era</a></p><div class="grid" id="views"></div></main>',script))

for era,title,arrival in ERAS:
    body=f'<main><h1>{title}</h1><p>Normal villagers on the left, VIP alternatives on the right · Three outfits for each gender</p><div class="thumbs">'
    for gender in ['male','female']:
        for v in range(3):
            body+=figure(f'{era}-{gender}-v{v}-comparison-named.png',f'{gender.title()} · outfit {v+1}')
    body+='</div><h2>One visitor’s journey</h2><p>Named and unnamed examples; use the interactive gallery for every outfit’s complete journey.</p><div class="grid">'
    for mode,label in [('arrival',arrival),('wandering','Wandering'),('leaving','Returning to the same entrance')]:
        for named in [False,True]:
            body+=figure(f'{era}-female-v1-{mode}{"-named" if named else ""}.png',label+(' · named' if named else ' · unnamed'))
    body+='</div>'
    if era!='frontier':
        body+='<h2>Six-second arrival window</h2><div class="grid">'+figure(f'{era}-female-v1-inset.png','Without name · review only','inset')+figure(f'{era}-female-v1-inset-named.png','With name · gameplay','inset')+'</div>'
    body+='<p><a href="index.html">Interactive gallery</a> · <a href="captures.html">All original captures</a></p></main>'
    (OUT/f'{era}.html').write_text(page(title,body))

body='<main><h1>Eight eras · 48 VIP clothing combinations</h1><p>Three male and three female alternatives per era · Actual production models</p><div class="grid">'
for era,title,_ in ERAS:
    body+=figure(f'{era}-outfits.png',title)
body+='</div><p><a href="index.html">Browse normal-villager comparisons and in-game journeys</a></p></main>'
(OUT/'clothing.html').write_text(page('All VIP clothing',body))
body='<main><h1>Normal villagers and VIPs through the eras</h1><p>Normal on the left / VIP on the right in each image · All three outfits for both genders are in the full gallery</p><div class="grid">'
for i,(era,title,_) in enumerate(ERAS):
    body+=figure(f'{era}-{"female" if i%2==0 else "male"}-v{i%3}-comparison-named.png',title)
body+='</div></main>'
(OUT/'comparison-overview.html').write_text(page('Normal villagers / VIPs · All eras',body))
body='<main><h1>VIP arrival windows and return journeys</h1><p>Actual village renders · One VIP per scene · Names appear in the six-second arrival window</p><div class="thumbs">'
for mode,label in [('arrival','Arrival'),('inset','Arrival camera'),('leaving','Returning to the same building')]:
    for era,transport in [('river-rail','Train'),('industrial','Boat'),('contemporary','Plane')]:
        body+=figure(f'{era}-female-v1-{mode}-named.png',f'{transport} · {label}', 'inset' if mode=='inset' else '')
body+='</div><p><a href="index.html">Every era, outfit and gender · with and without names</a></p></main>'
(OUT/'journeys-overview.html').write_text(page('VIP transport journeys',body))
images=sorted(p.name for p in OUT.glob('*.png'))
body='<main><h1>Every captured image</h1><p>Full-resolution PNG files. The interactive gallery groups all 48 combinations by era, gender and outfit.</p><p><a href="index.html">Interactive gallery</a></p>'
for era,title,_ in ERAS:
    body+=f'<h2>{title}</h2><ul>'+''.join(f'<li><a href="{name}">{name}</a></li>' for name in images if name.startswith(era+'-'))+'</ul>'
extras=[name for name in images if not any(name.startswith(era+'-') for era,_,_ in ERAS)]
body+='<h2>Overview sheets</h2><ul>'+''.join(f'<li><a href="{name}">{name}</a></li>' for name in extras)+'</ul></main>'
(OUT/'captures.html').write_text(page('All captured VIP images',body))
(OUT/'manifest.json').write_text(json.dumps({'combinations':48,'requiredCaptures':len(required),'totalImages':len(images),'eras':ERAS,'images':images},indent=2)+'\n')
(OUT/'README.txt').write_text('Open index.html in any browser. This portable gallery works offline.\n48 combinations: eight eras x two genders x three period outfits.\nEach has normal/VIP comparison, arrival, wandering and departure, with and without name tags. All passenger-transport visits also include the arrival-window close-up.\nOne VIP per village scene. Original overview captures are retained. captures.html lists every PNG; manifest.json records the complete inventory.\nMain-view names appear on hover/tap. The gameplay arrival window always includes the name; unnamed inset captures are review comparisons only. Frontier uses stable foot visits and has no vehicle-arrival window.\nAll images are actual production models/scenes staged at fixed moments for comparison. Clothing/name draws use production selection; gender follows the chosen name. Scott and Evi represent the male and female lists; all six names are tested.\n')
archive=ROOT/'output/vip-review.zip'
with zipfile.ZipFile(archive,'w',zipfile.ZIP_DEFLATED,compresslevel=6) as z:
    for path in sorted(OUT.iterdir()):
        if path.is_file(): z.write(path,'vip-review/'+path.name)
print(f'{len(images)} images; {len(required)} required captures verified; {archive.stat().st_size/1024**2:.1f} MiB: {archive}')
