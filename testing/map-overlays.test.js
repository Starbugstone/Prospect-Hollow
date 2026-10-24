import { existsSync, readFileSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ESLint } from 'eslint';
import { parse } from 'vue/compiler-sfc';
import { MAP_OVERLAY_ELEMENTS, MAP_OVERLAY_FILES } from '../eslint.config.js';

// The player asked that the settlement maps stay uncluttered (AGENTS.md, settlement maps):
// whatever is drawn over a map holds only labels, action buttons and the header, while
// lists, dropdowns and letters belong in the Build, Story or More tabs. ESLint enforces it
// per file; this test finds everything drawn inside TownView's map frame, so a new overlay
// component cannot slip past that list.

const VIEW = 'src/components/town/TownView.vue';
// The tabs' sheets and dialogs, which may hold lists, never count as map overlays.
const TABS = new Set(['TownDialog']);
const BUILT_INS = new Set(['Transition', 'TransitionGroup', 'KeepAlive', 'Suspense', 'Teleport']);
// @vue/compiler-core's NodeTypes.ELEMENT and ElementTypes.COMPONENT.
const ELEMENT = 1,
  COMPONENT = 1;
const pascal = (tag) => tag.replace(/(?:^|-)(\w)/g, (_, letter) => letter.toUpperCase());

function component(file) {
  const { descriptor } = parse(readFileSync(file, 'utf8'));
  const script = `${descriptor.script?.content ?? ''}\n${descriptor.scriptSetup?.content ?? ''}`;
  // Every component file it imports, statically or lazily, by local name.
  const imports = new Map();
  for (const pattern of [
    /import\s+(\w+)\s+from\s+['"](\.[^'"]+\.vue)['"]/g,
    /(\w+)\s*=\s*defineAsyncComponent\(\s*\(\)\s*=>\s*import\(\s*['"](\.[^'"]+\.vue)['"]/g,
  ])
    for (const [, name, path] of script.matchAll(pattern))
      imports.set(name, relative('.', resolve(dirname(file), path)));
  return { template: descriptor.template?.ast ?? { children: [] }, imports };
}
// The elements of a template subtree, skipping the tabs' dialogs and their contents.
function* elements(node) {
  for (const child of node.children ?? []) {
    if (child.type !== ELEMENT || TABS.has(pascal(child.tag))) continue;
    yield child;
    yield* elements(child);
  }
}
const isFrame = (node) =>
  node.props?.some(
    (prop) => prop.name === 'class' && prop.value?.content.split(/\s+/).includes('town-map-frame'),
  );
function find(node, match) {
  for (const element of elements(node)) if (match(element)) return element;
  return null;
}

// Every element and component drawn over the maps: the map frame in TownView, then each
// component in it and, recursively, every component those import.
function overlays() {
  const view = component(VIEW);
  const frame = find(view.template, isFrame);
  expect(frame, 'TownView has a .town-map-frame').not.toBeNull();
  const drawn = [{ file: `${VIEW} .town-map-frame`, nodes: [...elements(frame)] }];
  const files = new Set();
  const unresolved = [];
  const visit = (file, owner, tag) => {
    const name = pascal(tag);
    if (BUILT_INS.has(name)) return;
    const path = owner.imports.get(name);
    if (!path) return unresolved.push(`${file}: <${tag}>`);
    if (files.has(path)) return;
    files.add(path);
    const child = component(path);
    drawn.push({ file: path, nodes: [...elements(child.template)] });
    // Imports, not just template tags, so `<component :is>` choices are covered too.
    for (const imported of child.imports.keys()) visit(path, child, imported);
    for (const node of elements(child.template))
      if (node.tagType === COMPONENT && node.tag !== 'component') visit(path, child, node.tag);
  };
  for (const node of elements(frame)) if (node.tagType === COMPONENT) visit(VIEW, view, node.tag);
  return { drawn, files: [...files].sort(), unresolved };
}

describe('Map overlays hold only labels, action buttons and the header', () => {
  const { drawn, files, unresolved } = overlays();

  it('finds every component drawn over the maps', () => {
    // A dynamic or global component in the frame cannot be checked: name it in an import.
    expect(unresolved).toEqual([]);
    expect(files).toEqual(expect.arrayContaining(['src/components/town/TownScene.vue']));
    expect(files).toEqual(expect.arrayContaining(['src/components/town/TownMoonView.vue']));
  });

  it('draws no list, dropdown or letter inside the map frame', () => {
    const banned = drawn.flatMap(({ file, nodes }) =>
      nodes
        .filter((node) => MAP_OVERLAY_ELEMENTS.includes(node.tag))
        .map((node) => `${file}:${node.loc.start.line} <${node.tag}>`),
    );
    expect(banned).toEqual([]);
  });

  it('puts every overlay component under the ESLint overlay rule', async () => {
    expect(MAP_OVERLAY_FILES.filter((file) => !existsSync(file))).toEqual([]);
    expect(files.filter((file) => !MAP_OVERLAY_FILES.includes(file))).toEqual([]);
    const eslint = new ESLint();
    for (const file of files) {
      const config = await eslint.calculateConfigForFile(file);
      const [severity, ...options] = config.rules['vue/no-restricted-html-elements'] ?? [0];
      expect([severity, file]).toEqual([2, file]);
      expect(options.map((option) => option.element)).toEqual(
        expect.arrayContaining(MAP_OVERLAY_ELEMENTS),
      );
    }
  });
});
