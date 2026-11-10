import { expect, it } from 'vitest';
import { prototypeConfig } from '../../src/data/prototypeBoards';
import { simulateCampaignLevel } from '../helpers/campaignSimulation';

const KEYS = ['trace-twins-first-impression', 'crossgrain-narrow-neck'];
const at = (values, q) => values.toSorted((a, b) => a - b)[Math.floor((values.length - 1) * q)];
it.each(KEYS)(
  'finishes every one of 60 hint-led seeds: %s',
  (key) => {
    const level = prototypeConfig(key);
    const runs = Array.from({ length: 60 }, (_, i) => simulateCampaignLevel(level, i + 1));
    const summary = {
      key,
      completed: runs.filter((run) => !run.remaining).length,
      moves: [0.1, 0.5, 0.9, 1].map((q) =>
        at(
          runs.map((run) => run.turns),
          q,
        ),
      ),
      medianDirectionSplits: at(
        runs.map((run) => run.grainDirectionSplits),
        0.5,
      ),
      medianBlastSplits: at(
        runs.map((run) => run.grainBlastSplits),
        0.5,
      ),
      medianScore: at(
        runs.map((run) => run.score),
        0.5,
      ),
      reshuffles: runs.reduce((sum, run) => sum + run.shuffles, 0),
      medianTraceActivations: at(
        runs.map((run) => run.traceActivations),
        0.5,
      ),
      medianTraceGateHits: at(
        runs.map((run) => run.traceGateHits),
        0.5,
      ),
      runsWithUsefulTrace: runs.filter((run) => run.traceGateHits > 0).length,
    };
    console.log(JSON.stringify(summary));
    expect(summary.completed).toBe(60);
    if (key.startsWith('trace-')) {
      expect(summary.medianTraceActivations).toBeGreaterThan(0);
      expect(summary.medianTraceGateHits).toBeGreaterThan(0);
    }
  },
  120000,
);
