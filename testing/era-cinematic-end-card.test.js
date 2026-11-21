import { expect, it } from 'vitest';
import { sfc } from './helpers/componentFragments';

// The era cinematic's captions ("THE NEXT CHAPTER", the year, the era and its line) stay
// readable over the brightest scenery: their scrim keeps every caption colour at the WCAG
// AA ratio for text (4.5 : 1) even over pure white.
const style = sfc('src/components/town/TownEraCinematic.vue').styles[0].content;
const rule = (selector) => {
  const match = style.match(
    new RegExp(`(?:^|\\n)${selector.replace('.', '\\.')}\\s*\\{([^}]*)\\}`),
  );
  return match?.[1] ?? '';
};
const declaration = (selector, property) =>
  rule(selector)
    .match(new RegExp(`(?:^|[;\\s])${property}:\\s*([^;]+);`))?.[1]
    .trim();
const rgba = (hex) => {
  const digits = hex.replace('#', '');
  const [r, g, b, a = 255] = digits.match(/../g).map((pair) => parseInt(pair, 16));
  return [r, g, b, a / 255];
};
const luminance = ([r, g, b]) => {
  const linear = (c) => ((c /= 255) <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b);
};
const over = ([r, g, b, a], under) => [r, g, b].map((c, n) => c * a + under[n] * (1 - a));
const contrast = (a, b) => {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (light + 0.05) / (dark + 0.05);
};

it('puts a scrim behind the captions that keeps them readable over white scenery', () => {
  const scrim = declaration('.era-caption', 'background');
  expect(scrim, 'the caption block has a solid scrim colour').toMatch(/^#[0-9a-f]{8}$/i);
  const behind = over(rgba(scrim), [255, 255, 255]);
  const colours = {
    caption: declaration('.era-cinematic', 'color'),
    eyebrow: declaration('.era-eyebrow', 'color'),
    year: declaration('.era-date', 'color'),
  };
  for (const [part, colour] of Object.entries(colours)) {
    expect(colour, part).toMatch(/^#[0-9a-f]{6}$/i);
    expect(contrast(rgba(colour), behind), part).toBeGreaterThanOrEqual(4.5);
  }
});
