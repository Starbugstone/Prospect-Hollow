// Rebuild the monument unveiling music documented in public/sound/village/credits.html.
// Usage: FFMPEG=/path/to/ffmpeg node scripts/prepare-monument-music.mjs
// Source: "Thaxted (Holst)" by Kevin MacLeod (incompetech.com), Creative Commons Attribution 4.0.
import { createHash } from 'node:crypto';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { get } from 'node:https';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync, spawnSync } from 'node:child_process';

const ffmpeg = process.env.FFMPEG || 'ffmpeg';
const url = 'https://incompetech.com/music/royalty-free/mp3-royaltyfree/Thaxted.mp3';
// The cut points belong to this master; audition them again if the download changes.
const sha256 = '72bc5f1d32f034628b10b9e54828cb086a0a9d5c01dcd79f6afbe38cec086480';
const output = fileURLToPath(
  new URL('../public/sound/village/monument-unveiling.mp3', import.meta.url),
);
// Final full-orchestra verse: cut in the breath before the strongest downbeat (123.24 s),
// ride the cadence to the held B-flat tonic chord (about 15 s in), let the orchestra release
// (about 18 s in) and fade the hall reverb over the last 2.5 seconds.
const start = 123.24;
const duration = 20.3;
const tail = 2.5;
const shape = [
  `atrim=start=${start}:duration=${duration}`,
  'asetpts=PTS-STARTPTS',
  'afade=t=in:d=0.05',
  `afade=t=out:st=${(duration - tail).toFixed(2)}:d=${tail}`,
].join(',');
const loudness = { integrated: -19, truePeak: -2 };

// incompetech.com can take over ten seconds to accept a connection, longer than fetch() allows.
const download = (address) =>
  new Promise((resolve, reject) => {
    get(address, { timeout: 60_000 }, (response) => {
      if (response.statusCode !== 200) {
        response.resume();
        reject(new Error(`${address}: HTTP ${response.statusCode}`));
        return;
      }
      const chunks = [];
      response.on('data', (chunk) => chunks.push(chunk));
      response.on('end', () => resolve(Buffer.concat(chunks)));
      response.on('error', reject);
    })
      .on('timeout', function () {
        this.destroy(new Error(`${address}: timed out`));
      })
      .on('error', reject);
  });

const scratch = await mkdtemp(join(tmpdir(), 'prospect-monument-'));
try {
  const bytes = await download(url);
  const digest = createHash('sha256').update(bytes).digest('hex');
  if (digest !== sha256) throw new Error(`${url}: unexpected SHA-256 ${digest}`);
  const source = join(scratch, 'thaxted.mp3');
  await writeFile(source, bytes);

  // Measure the shaped excerpt, then apply one linear gain so the phrasing keeps its dynamics.
  const probe = spawnSync(
    ffmpeg,
    [
      '-hide_banner',
      '-nostats',
      '-i',
      source,
      '-af',
      `${shape},loudnorm=print_format=json`,
      '-f',
      'null',
      '-',
    ],
    { encoding: 'utf8', input: '', maxBuffer: 8 * 1024 * 1024 },
  );
  const report = probe.stderr.slice(probe.stderr.lastIndexOf('{'));
  if (probe.status !== 0 || !report.includes('input_i')) throw new Error(probe.stderr);
  const measured = JSON.parse(report.slice(0, report.indexOf('}') + 1));
  const gain = loudness.integrated - Number(measured.input_i);
  if (Number(measured.input_tp) + gain > loudness.truePeak) {
    throw new Error(`Excerpt would peak at ${Number(measured.input_tp) + gain} dBTP`);
  }

  execFileSync(ffmpeg, [
    '-hide_banner',
    '-loglevel',
    'error',
    '-y',
    '-i',
    source,
    '-af',
    `${shape},volume=${gain.toFixed(2)}dB`,
    '-vn',
    '-map_metadata',
    '-1',
    '-ar',
    '44100',
    '-ac',
    '2',
    '-c:a',
    'libmp3lame',
    '-b:a',
    '192k',
    output,
  ]);
  console.log(`Prepared monument-unveiling.mp3 (${gain.toFixed(2)} dB gain)`);
} finally {
  await rm(scratch, { recursive: true, force: true });
}
