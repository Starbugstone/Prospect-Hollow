// The browser and system a user agent names, for "Firefox on Windows" in the Mayor's
// Office and the admin panel. Either is undefined when it is not recognised.
const BROWSERS = [
  [/EdgA?\//, 'Edge'],
  [/SamsungBrowser\//, 'Samsung Internet'],
  [/OPR\//, 'Opera'],
  [/Firefox\/|FxiOS\//, 'Firefox'],
  [/Chrome\/|CriOS\//, 'Chrome'],
  [/Safari\//, 'Safari'],
];
const SYSTEMS = [
  [/Android/, 'Android'],
  [/iPhone|iPad|iPod/, 'iOS'],
  [/Windows/, 'Windows'],
  [/Mac OS X|Macintosh/, 'macOS'],
  [/CrOS/, 'ChromeOS'],
  [/Linux/, 'Linux'],
];
const named = (list, agent) => list.find(([pattern]) => pattern.test(agent))?.[1];
export const userAgentParts = (agent) => ({
  browser: named(BROWSERS, agent),
  system: named(SYSTEMS, agent),
});
