"""Materialize browser-captured PNGs and the wiki's era galleries.

First export all eras from /scripts/era-art-review.html under the Vite dev server.
Save those JSON downloads to output/era-art-data/, then run this script.
The images are real WebGL captures, not generated illustrations.
"""
import base64
import json
from pathlib import Path
import zipfile

ROOT = Path(__file__).resolve().parent.parent
IMAGES = ROOT / 'docs/images/era-upgrades'
WIKI = ROOT / 'docs/wiki'
WIKI.mkdir(parents=True, exist_ok=True)
ERAS = ['frontier', 'river-rail', 'industrial', 'post-war', 'motor-age', 'aviation', 'broadcast', 'contemporary']
DESCRIPTIONS = {
    'frontier': 'Timber walls, pitched roofs, porches, small workshops and simple farm equipment establish the settlement. Original construction stages are shown in full; some buildings have five stages, while supporting buildings finish in three substantial stages.',
    'river-rail': 'Masonry street fronts, slate-colored roofs and cornices give the town a late nineteenth-century appearance. Final upgrades follow each building’s work: verandas, classroom and clinic rooms, glazed exhibition space, workshop rooflights, freight shelters, market awnings and covered station seating. The bridge, railway station, post office and river landing join the settlement. The mine gains a taller timber winding frame and a steam boiler.',
    'industrial': 'Brick workshops, steel details, service yards and electrical equipment mark the 1908 industrial town. Final upgrades add usable rooms, workshops and loading facilities instead of repeated clock towers. The power house expands its electrical equipment and the fire station adds a covered engine bay. The mine changes to a metal headframe and a brick power house.',
    'post-war': 'This era is 1920: rebuilding after the First World War. Pale masonry, brick courtyard housing, civic pilasters and modest public facilities replace the earlier industrial forms. The mine gains a sheltered winding deck. These are not the later 1950s buildings.',
    'motor-age': 'The 1932 town uses cream walls, teal canopies, roadside service bays, a bus station and a diner. Gardens soften the growing streets. The well’s larger tank stands on a braced steel frame, with its lid seated on the vessel. The mine control house receives a projecting service canopy.',
    'aviation': 'The 1958 architecture introduces broad horizontal cornices, ribbon glazing, light masonry and radio aerials. The airport uses its regional terminal design. Existing buildings receive the aviation-era facade only as their modernization is completed. The mine gains a taller winding frame and radio equipment.',
    'broadcast': 'The 1986 buildings use concrete facade blades, stepped parapets, darker roofs and television aerials. Concert and television buildings have fitted glazed foyers and service annexes. Contemporary solar panels, roof gardens and timber fins are reserved for the next era. The mine adds an instrumented control house.',
    'contemporary': 'The 2005 connected city combines retained neighborhood buildings with glass landmarks, digital information terminals, selected solar equipment, planted roofs and timber facade details. The mine has its tallest headframe, electronic controls and solar equipment on the control-house roof.',
}
summary = []
for era in ERAS:
    data = json.loads((ROOT / f'output/era-art-data/{era}.json').read_text())
    lines = [f"# {data['year']} · {data['label']}", '', '[Back to the era visual guide](Era-Visual-Guide.md)', '', DESCRIPTIONS[era], '',
             'Each comparison reads from left to right, from the first completed stage to the final upgrade. The camera and scale stay fixed within each building row. Click the comparison for full resolution, or open an individual stage below it. The mine has one permanent surface upgrade per era.', '',
             'These are actual game meshes rendered in a neutral review scene. Name labels sit outside the model so the architecture remains clear. World scenery, traffic, construction scaffolds and unfinished plots are excluded from these building comparisons.', '', '## Building index', '']
    groups = [
        ('New buildings in this era', [b for b in data['buildings'] if b.get('introducedEra') == era]),
        ('Existing buildings upgraded for this era', [b for b in data['buildings'] if b['id'] != 'mine' and b.get('introducedEra') != era]),
        ('Mine progression', [b for b in data['buildings'] if b['id'] == 'mine']),
    ]
    for heading, buildings in groups:
        if not buildings: continue
        lines += [f'**{heading}**', '', ' · '.join(f"[{b['name']}](#building-{b['id'].lower()})" for b in buildings), '']
    for heading, buildings in groups:
        if not buildings: continue
        lines += [f'## {heading}', '']
        for b in buildings:
            directory = IMAGES / era / b['id']
            directory.mkdir(parents=True, exist_ok=True)
            for name, encoded in [('comparison', b['comparison']), *[(f'stage-{i+1}', image) for i, image in enumerate(b['stages'])]]:
                raw = base64.b64decode(encoded.split(',', 1)[1], validate=True)
                assert raw.startswith(b'\x89PNG\r\n\x1a\n'), (era, b['id'], name)
                (directory / f'{name}.png').write_bytes(raw)
            prefix = f"../images/era-upgrades/{era}/{b['id']}"
            lines += [f"<a id=\"building-{b['id'].lower()}\"></a>", '', f"### {b['name']}", '', f"![{b['name']} — {data['label']} upgrade comparison]({prefix}/comparison.png)", '',
                      ' · '.join(f"[{'Era upgrade' if b['id']=='mine' else f'Stage {i+1}'}]({prefix}/stage-{i+1}.png)" for i in range(len(b['stages']))), '']
    (WIKI / f'Era-{era}.md').write_text('\n'.join(lines))
    summary.append({'era': era, 'label': data['label'], 'year': data['year'], 'buildings':len(data['buildings']), 'stages':sum(len(b['stages']) for b in data['buildings'])})

manifest = {'eras': summary, 'comparisons': sum(e['buildings'] for e in summary), 'stageImages': sum(e['stages'] for e in summary)}
(IMAGES / 'manifest.json').write_text(json.dumps(manifest, indent=2)+'\n')
archive = ROOT / 'output/prospect-hollow-era-upgrades.zip'
with zipfile.ZipFile(archive, 'w', compression=zipfile.ZIP_DEFLATED) as z:
    for file in sorted(IMAGES.rglob('*')):
        if file.is_file(): z.write(file, file.relative_to(IMAGES))
    for file in sorted(WIKI.glob('Era-*.md')):
        # The repository/wiki is the browsable index; this zip carries the originals.
        z.writestr(f'guide/{file.name}', file.read_text().replace('../images/era-upgrades/', '../').replace('(../era-architecture.md)', '(https://github.com/Starbugstone/Prospect-Hollow/blob/develop/docs/era-architecture.md)'))
    for file in sorted((ROOT / 'docs/images').glob('mine-era-*.png')):
        z.write(file, f'images/{file.name}')
    z.writestr('README.txt', 'Prospect Hollow era upgrades\n975 individual stage images and 327 comparison sheets.\nBrowse guide/Era-Visual-Guide.md or the published GitHub wiki.\nEach era/building folder contains comparison.png and every stage PNG.\n')
print(json.dumps(manifest, indent=2))
print(f'Archive: {archive} ({archive.stat().st_size / 1024 / 1024:.1f} MiB)')
