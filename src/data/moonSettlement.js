import { eraEvolution } from './eras';

// New Hollow, the homesteads on the Moon, grows with the supplies the town sends up
// the space elevator. It is presentation only: no coins, timers or failure.
export const MOON_SETTLEMENT_LIMIT = 24;
// Two homesteads per elevator level, then one for every four modernization levels
// completed in a supply era (an era whose `moonSettlement` capability is on).
export function moonSettlement(town) {
  const elevator = town?.buildings?.spaceElevator ?? 0;
  if (!elevator) return { homesteads: 0, lights: [] };
  const levels = Object.entries(town.buildingEras ?? {}).reduce(
    (sum, [id, era]) =>
      eraEvolution(era).moonSettlement && id !== 'spaceElevator'
        ? sum + (town.buildingEraLevels?.[id] ?? 0)
        : sum,
    0,
  );
  const homesteads = Math.min(MOON_SETTLEMENT_LIMIT, elevator * 2 + Math.floor(levels / 4));
  return { homesteads, lights: MOON_LIGHTS.slice(0, homesteads) };
}

// Settlement positions on a unit Moon disc (x, y in -1..1), spread by the golden
// angle so a growing settlement fills the face evenly. Stable for every save.
const MOON_LIGHTS = Array.from({ length: MOON_SETTLEMENT_LIMIT }, (_, n) => {
  const radius = 0.82 * Math.sqrt((n + 0.5) / MOON_SETTLEMENT_LIMIT),
    angle = n * 2.39996;
  return Object.freeze({
    x: Math.round(Math.cos(angle) * radius * 1000) / 1000,
    y: Math.round(Math.sin(angle) * radius * 1000) / 1000,
    // Lights twinkle out of step with each other.
    delay: (n * 0.37) % 2.4,
  });
});
