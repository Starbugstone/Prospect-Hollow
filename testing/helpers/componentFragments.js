import { readFileSync } from 'node:fs';
import * as Vue from 'vue';
import { createSSRApp, h } from 'vue';
import { renderToString } from 'vue/server-renderer';
import { compileScript, parse } from 'vue/compiler-sfc';

// Renders one fragment of a component's real template against its real setup, so a
// test can read exactly what the player reads without mounting the whole view.
export const sfc = (path) => parse(readFileSync(path, 'utf8')).descriptor;
const bindingsFor = (path) => compileScript(sfc(path), { id: path }).bindings;
export function find(node, match) {
  if (match(node)) return node;
  for (const child of node.children ?? []) {
    const found = typeof child === 'object' && find(child, match);
    if (found) return found;
  }
  return null;
}
export const bound = (node, name) =>
  node.props?.find((prop) => prop.name === 'bind' && prop.arg?.content === name)?.exp?.content;
export const childrenSource = (node) => node.children.map((child) => child.loc.source).join('');

// Icons render as their name so snapshots stay readable. `prepare` may adjust the
// setup's state (refs and functions) before the fragment renders.
const IconName = { props: ['name'], render: (props) => h('i', { 'data-icon': props.name }) };
function harness(component, path, template, prepare) {
  return {
    ...component,
    ssrRender: undefined,
    setup(props, context) {
      const state = component.setup(props, context);
      for (const icon of ['GameIcon', 'TownIcon']) if (icon in state) state[icon] = IconName;
      prepare?.(state);
      return state;
    },
    render: Vue.compile(template, { prefixIdentifiers: true, bindingMetadata: bindingsFor(path) }),
  };
}
const normalise = (html) =>
  html
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/ data-v-\w+(="")?/g, '')
    .replace(/\s+/g, ' ')
    .replace(/> </g, '><')
    .trim();
export async function renderFragment({
  component,
  path,
  template,
  props,
  globals,
  pinia,
  prepare,
}) {
  const app = createSSRApp({ render: () => h(harness(component, path, template, prepare), props) });
  app.use(pinia);
  Object.assign(app.config.globalProperties, globals);
  return normalise(await renderToString(app));
}
