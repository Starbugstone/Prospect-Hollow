"""Package browser-captured PNGs and galleries under ignored output/.

First export the eras you want to review from /scripts/era-art-review.html under the Vite dev server.
Save those JSON downloads to output/era-art-data/, then run this script.
The images are real WebGL captures, not generated illustrations.
"""
import base64
import json
import shutil
from pathlib import Path
import zipfile

ROOT = Path(__file__).resolve().parent.parent
REVIEW = ROOT / 'output/era-art-review'
IMAGES = REVIEW / 'images/era-upgrades'
WIKI = REVIEW / 'guide'
inputs = sorted((ROOT / 'output/era-art-data').glob('*.json'))
if not inputs:
    raise SystemExit('Export era JSON from /scripts/era-art-review.html to output/era-art-data/ first.')
data_sets = [json.loads(file.read_text()) for file in inputs]
if REVIEW.exists():
    shutil.rmtree(REVIEW)
WIKI.mkdir(parents=True, exist_ok=True)
summary = []
for data in data_sets:
    era = data['era']
    lines = [f"# {data['year']} · {data['label']}", '', '[Back to the era visual guide](Era-Visual-Guide.md)', '', f"Captured production models for {data['label']}. Native construction and eligible modernizations show their paid stages; plots excluded from partial modernization show their retained finish once.", '',
             'Each comparison reads from left to right, from the first completed stage to the final upgrade. The camera and scale stay fixed within each building row. Click the comparison for full resolution, or open an individual stage below it. The mine has one permanent surface upgrade per era.', '',
             'These are actual game meshes rendered in a neutral review scene. Physical nameboards use their production mounts; captions identify every row. World scenery, traffic, construction scaffolds and unfinished plots are excluded from these building comparisons.', '', '## Building index', '']
    groups = [
        ('New buildings in this era', [b for b in data['buildings'] if b.get('introducedEra') == era]),
        ('Existing buildings and their retained finishes', [b for b in data['buildings'] if b['id'] != 'mine' and b.get('introducedEra') != era]),
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
            if b['id'] == 'airport':
                lines += ['The hangar doors face the runway, with the apron and its markings ending at the runway edge. The open bay and marked taxiway stay clear of the lounge at all three stages. A single aircraft occasionally takes off or lands, taxis between the runway and hangar, and waits between flights; arrivals and departures never overlap.', '',
                          '[Aircraft activity and layout details](https://github.com/Starbugstone/Prospect-Hollow/blob/preprod/docs/airport-art.md)', '']
    (WIKI / f'Era-{era}.md').write_text('\n'.join(lines))
    summary.append({'era': era, 'label': data['label'], 'year': data['year'], 'buildings':len(data['buildings']), 'stages':sum(len(b['stages']) for b in data['buildings'])})

manifest = {'eras': summary, 'comparisons': sum(e['buildings'] for e in summary), 'stageImages': sum(e['stages'] for e in summary)}
index = ['# Era review galleries', '', *[f"- [{e['year']} · {e['label']}](Era-{e['era']}.md)" for e in summary], '']
(WIKI / 'Era-Visual-Guide.md').write_text('\n'.join(index))
IMAGES.mkdir(parents=True, exist_ok=True)
(IMAGES / 'manifest.json').write_text(json.dumps(manifest, indent=2)+'\n')
archive = ROOT / 'output/prospect-hollow-era-upgrades.zip'
with zipfile.ZipFile(archive, 'w', compression=zipfile.ZIP_DEFLATED) as z:
    for file in sorted(IMAGES.rglob('*')):
        if file.is_file(): z.write(file, Path('images/era-upgrades') / file.relative_to(IMAGES))
    for file in sorted(WIKI.glob('Era-*.md')):
        z.writestr(f'guide/{file.name}', file.read_text())
    z.writestr('README.txt', f"Prospect Hollow era upgrades\n{manifest['stageImages']} individual stage images and {manifest['comparisons']} comparison sheets.\nBrowse the era pages under guide/.\nEach era/building folder contains comparison.png and every stage PNG.\n")
print(json.dumps(manifest, indent=2))
print(f'Archive: {archive} ({archive.stat().st_size / 1024 / 1024:.1f} MiB)')
