// Optional asset-maintenance tool; the game ships the resulting MP3s, plus Opus for streamed music.
// Usage: FFMPEG=/path/to/ffmpeg node scripts/prepare-village-audio.mjs [name ...]
// With names, only those assets are rebuilt.
import { mkdir, writeFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';

const ffmpeg = process.env.FFMPEG || 'ffmpeg';
const output = new URL('../public/sound/village/', import.meta.url);
const scratch = await mkdtemp(join(tmpdir(), 'village-audio-'));
const only = process.argv.slice(2);
const assets = [
  {
    name: 'porch-swing',
    url: 'https://incompetech.com/music/royalty-free/mp3-royaltyfree/Porch%20Swing%20Days%20-%20slower.mp3',
    filter: 'loudnorm=I=-22:TP=-3:LRA=11,afade=t=in:d=1.5',
    // Streamed on every village visit: Opus first, a lighter MP3 for browsers without it.
    bitrate: '128k',
    opus: true,
  },
  {
    name: 'birds',
    url: 'https://opengameart.org/sites/default/files/birds-isaiah658_0.ogg',
    filter:
      'atrim=start=2:duration=26,asetpts=PTS-STARTPTS,highpass=f=280,loudnorm=I=-25:TP=-5:LRA=11',
    seam: 2,
  },
  {
    name: 'chatter',
    url: 'https://bigsoundbank.com/UPLOAD/mp3/3096.mp3',
    filter:
      'atrim=start=12:duration=38,asetpts=PTS-STARTPTS,highpass=f=220,lowpass=f=1700,loudnorm=I=-27:TP=-7:LRA=7',
    seam: 3,
  },
  {
    name: 'building',
    url: 'https://opengameart.org/sites/default/files/craft_0.ogg',
    filter:
      'highpass=f=100,lowpass=f=4200,loudnorm=I=-24:TP=-7:LRA=7,afade=t=in:d=0.008,afade=t=out:st=0.70:d=0.10',
  },
  {
    name: 'mining',
    url: 'https://opengameart.org/sites/default/files/Pick%20Hitting%20Rock.wav',
    filter:
      'highpass=f=130,lowpass=f=3800,loudnorm=I=-25:TP=-7:LRA=7,afade=t=in:d=0.008,afade=t=out:st=3.8:d=0.38',
  },
  {
    name: 'horse',
    url: 'https://bigsoundbank.com/UPLOAD/mp3/1217.mp3',
    filter:
      'highpass=f=160,lowpass=f=4500,loudnorm=I=-24:TP=-6:LRA=7,afade=t=in:d=0.025,afade=t=out:st=1.40:d=0.25',
  },
  {
    name: 'hooves',
    url: 'https://bigsoundbank.com/UPLOAD/mp3/1850.mp3',
    filter:
      'atrim=start=9:duration=7,asetpts=PTS-STARTPTS,highpass=f=100,lowpass=f=3500,loudnorm=I=-24:TP=-6:LRA=7,afade=t=in:d=0.6,afade=t=out:st=5.5:d=1.5',
  },
  {
    name: 'warning',
    url: 'https://bigsoundbank.com/UPLOAD/mp3/0397.mp3',
    filter:
      'highpass=f=140,lowpass=f=2200,loudnorm=I=-27:TP=-9:LRA=7,afade=t=in:d=0.008,afade=t=out:st=2.6:d=0.6',
  },
];

await mkdir(output, { recursive: true });
try {
  for (const { name, url, filter, seam, bitrate = '192k', opus } of assets) {
    if (only.length && !only.includes(name)) continue;
    const response = await fetch(url);
    if (!response.ok) throw new Error(`${url}: ${response.status}`);
    const source = join(scratch, name);
    await writeFile(source, Buffer.from(await response.arrayBuffer()));
    // Blend the tail into the original head, then wrap to the following sample.
    // This preserves a continuous ambience across the native buffer loop boundary.
    let input = ['-i', source, '-af', filter];
    if (seam) {
      const pcm = execFileSync(
        ffmpeg,
        [
          '-hide_banner',
          '-loglevel',
          'error',
          '-i',
          source,
          '-af',
          filter,
          '-ar',
          '44100',
          '-ac',
          '2',
          '-f',
          'f32le',
          'pipe:1',
        ],
        { maxBuffer: 32 * 1024 * 1024 },
      );
      const overlap = seam * 44100;
      const frames = pcm.length / 8;
      for (let frame = 0; frame < overlap; frame++) {
        const mix = frame / overlap;
        for (let channel = 0; channel < 2; channel++) {
          const head = (frame * 2 + channel) * 4;
          const tail = ((frames - overlap + frame) * 2 + channel) * 4;
          pcm.writeFloatLE(pcm.readFloatLE(tail) * (1 - mix) + pcm.readFloatLE(head) * mix, tail);
        }
      }
      const loop = join(scratch, `${name}.pcm`);
      await writeFile(loop, pcm.subarray(overlap * 8));
      input = ['-f', 'f32le', '-ar', '44100', '-ac', '2', '-i', loop];
    }
    const encode = (codec, file) =>
      execFileSync(ffmpeg, [
        '-hide_banner',
        '-loglevel',
        'error',
        '-y',
        ...input,
        '-map_metadata',
        '-1',
        ...codec,
        new URL(file, output).pathname,
      ]);
    encode(['-ar', '44100', '-c:a', 'libmp3lame', '-b:a', bitrate], `${name}.mp3`);
    console.log(`Prepared ${name}.mp3`);
    if (opus) {
      encode(['-c:a', 'libopus', '-b:a', '64k', '-vbr', 'on'], `${name}.ogg`);
      console.log(`Prepared ${name}.ogg`);
    }
  }
} finally {
  await rm(scratch, { recursive: true, force: true });
}
