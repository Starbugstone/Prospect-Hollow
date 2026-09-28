// Rebuild the licensed incident recordings documented in public/sound/village/credits.html.
// Usage: FFMPEG=/path/to/ffmpeg node scripts/prepare-incident-audio.mjs
// Every source is CC0 (Freesound) or BigSoundBank's CC0-equivalent free licence.
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';

const ffmpeg = process.env.FFMPEG || 'ffmpeg';
const scratch = await mkdtemp(join(tmpdir(), 'prospect-incident-'));
const clean = 'highpass=f=90,lowpass=f=9000';
const recordings = [
  {
    // Two short blasts: the patrol answering the alarm, then "stop, thief!".
    name: 'patrol-whistle',
    url: 'https://cdn.freesound.org/previews/568/568995_313970-hq.mp3',
    filter: `[0:a]atrim=start=0.66:duration=0.72,asetpts=PTS-STARTPTS,afade=t=out:st=0.6:d=0.12[a];[0:a]atrim=start=3.66:duration=0.95,asetpts=PTS-STARTPTS,afade=t=out:st=0.75:d=0.2[b];anullsrc=r=44100:cl=mono:d=0.12[gap];[a][gap][b]concat=n=3:v=0:a=1,highpass=f=400,lowpass=f=9000,loudnorm=I=-22:TP=-4:LRA=7`,
  },
  {
    name: 'crate-break',
    url: 'https://cdn.freesound.org/previews/667/667653_3271378-hq.mp3',
    filter: `${clean},loudnorm=I=-23:TP=-4:LRA=7,afade=t=out:st=0.5:d=0.16`,
  },
  {
    name: 'fire-bell',
    url: 'https://cdn.freesound.org/previews/200/200318_2641534-hq.mp3',
    filter: `atrim=start=0.08:duration=4.1,asetpts=PTS-STARTPTS,${clean},loudnorm=I=-23:TP=-4:LRA=9,afade=t=out:st=3.4:d=0.7`,
  },
  {
    name: 'fire-crackle',
    url: 'https://cdn.freesound.org/previews/181/181563_1857065-hq.mp3',
    filter: `atrim=start=2:duration=13,asetpts=PTS-STARTPTS,${clean},loudnorm=I=-26:TP=-6:LRA=9`,
    seam: 1,
  },
  {
    name: 'fire-hose',
    url: 'https://cdn.freesound.org/previews/675/675571_2524442-hq.mp3',
    filter: `atrim=start=1:duration=9,asetpts=PTS-STARTPTS,${clean},loudnorm=I=-27:TP=-6:LRA=7`,
    seam: 1,
  },
  {
    name: 'bucket-splash',
    url: 'https://cdn.freesound.org/previews/508/508178_9159316-hq.mp3',
    filter: `atrim=start=0.35:duration=1.55,asetpts=PTS-STARTPTS,${clean},loudnorm=I=-24:TP=-5:LRA=7,afade=t=in:d=0.02,afade=t=out:st=1.25:d=0.3`,
  },
  {
    name: 'thunder',
    url: 'https://cdn.freesound.org/previews/194/194364_1985044-hq.mp3',
    filter: `atrim=start=13.4:duration=5.6,asetpts=PTS-STARTPTS,highpass=f=40,lowpass=f=7000,loudnorm=I=-21:TP=-3:LRA=11,afade=t=in:d=0.05,afade=t=out:st=4.1:d=1.5`,
  },
  {
    name: 'chainsaw',
    url: 'https://bigsoundbank.com/UPLOAD/mp3/0983.mp3',
    filter: `atrim=start=6:duration=8,asetpts=PTS-STARTPTS,highpass=f=120,lowpass=f=6000,loudnorm=I=-27:TP=-6:LRA=7`,
    seam: 1,
  },
];

const run = (args, options) =>
  execFileSync(ffmpeg, ['-hide_banner', '-loglevel', 'error', ...args], options);
try {
  for (const { name, url, filter, seam } of recordings) {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`${name}: HTTP ${response.status}`);
    const source = join(scratch, `${name}.mp3`);
    await writeFile(source, Buffer.from(await response.arrayBuffer()));
    const graph = filter.includes('[0:a]') ? ['-filter_complex', filter] : ['-af', filter];
    let input = ['-i', source, ...graph];
    if (seam) {
      // Blend the tail into the head so the native buffer loop has no audible seam.
      const pcm = run([...input, '-ar', '44100', '-ac', '1', '-f', 'f32le', 'pipe:1'], {
        maxBuffer: 32 * 1024 * 1024,
      });
      const overlap = seam * 44100,
        frames = pcm.length / 4;
      for (let frame = 0; frame < overlap; frame++) {
        const mix = frame / overlap,
          tail = (frames - overlap + frame) * 4;
        pcm.writeFloatLE(
          pcm.readFloatLE(tail) * (1 - mix) + pcm.readFloatLE(frame * 4) * mix,
          tail,
        );
      }
      const loop = join(scratch, `${name}.pcm`);
      await writeFile(loop, pcm.subarray(overlap * 4));
      input = ['-f', 'f32le', '-ar', '44100', '-ac', '1', '-i', loop];
    }
    run([
      '-y',
      ...input,
      '-map_metadata',
      '-1',
      '-ar',
      '44100',
      '-ac',
      '1',
      '-c:a',
      'libmp3lame',
      '-b:a',
      '128k',
      `public/sound/village/${name}.mp3`,
    ]);
  }
} finally {
  await rm(scratch, { recursive: true, force: true });
}
