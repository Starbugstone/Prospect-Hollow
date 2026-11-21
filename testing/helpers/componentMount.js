import * as Vue from 'vue';
import { createRenderer, h, nextTick, ssrContextKey } from 'vue';
import { compileScript } from 'vue/compiler-sfc';
import { sfc } from './componentFragments';

// Mounts real components without a browser DOM, so a test can follow their mounted
// hooks, prop updates, template refs and events across several components. Vite's Node
// transform supplies SSR components; `clientComponent` compiles a client render for a
// template (the component's own, or a fragment of it) against the component's real setup.

const node = (type, text = '') => ({
  type,
  tagName: type.toUpperCase(),
  text,
  props: {},
  style: {
    setProperty(name, value) {
      this[name] = value;
    },
    removeProperty(name) {
      delete this[name];
    },
  },
  children: [],
  parent: null,
  isConnected: true,
  addEventListener() {},
  removeEventListener() {},
  focus() {},
  showModal() {},
  close() {},
  scrollIntoView() {},
  scrollTo() {},
  querySelector: () => null,
  querySelectorAll: () => [],
  closest: () => null,
  getBoundingClientRect: () => ({ left: 0, top: 0, width: 0, height: 0 }),
  getRootNode() {
    return this.parent ? this.parent.getRootNode() : this;
  },
});
const renderer = createRenderer({
  createElement: (type) => node(type),
  createText: (text) => node('#text', text),
  createComment: (text) => node('#comment', text),
  setText: (entry, text) => (entry.text = text),
  setElementText: (entry, text) => {
    entry.text = text;
    entry.children = [];
  },
  patchProp: (entry, key, _old, value) => (entry.props[key] = value),
  parentNode: (entry) => entry.parent,
  nextSibling: (entry) => entry.parent?.children[entry.parent.children.indexOf(entry) + 1],
  insert(entry, parent, anchor) {
    if (entry.parent) entry.parent.children.splice(entry.parent.children.indexOf(entry), 1);
    entry.parent = parent;
    const index = parent.children.indexOf(anchor);
    parent.children.splice(index < 0 ? parent.children.length : index, 0, entry);
  },
  remove(entry) {
    entry.parent?.children.splice(entry.parent.children.indexOf(entry), 1);
    entry.parent = null;
  },
});

// Child components render on the client too, each compiled once per file when it is first
// rendered.
const clients = new Map();
const isComponent = (value) =>
  !!value && typeof value === 'object' && !!value.ssrRender && !value.render && !!value.__file;
function clientChildren(state) {
  for (const [key, value] of Object.entries(state))
    if (isComponent(value)) state[key] = clientFile(value);
}
function clientFile(component) {
  const path = component.__file;
  if (!clients.has(path)) {
    let render;
    clients.set(path, {
      ...component,
      ssrRender: undefined,
      setup: component.setup && withClientChildren(component.setup),
      get render() {
        return (render ??= compileTemplate(path));
      },
    });
  }
  return clients.get(path);
}
const withClientChildren = (setup, prepare) => (props, context) => {
  const state = setup(props, context) ?? {};
  clientChildren(state);
  prepare?.(state);
  return state;
};
function compileTemplate(path, template = sfc(path).template.content) {
  const descriptor = sfc(path);
  const bindingMetadata =
    descriptor.script || descriptor.scriptSetup
      ? compileScript(descriptor, { id: path }).bindings
      : {};
  // No static vnodes: the fake nodes cannot parse HTML strings.
  return Vue.compile(template, { prefixIdentifiers: true, bindingMetadata, hoistStatic: false });
}

/** A copy of `component` that renders `template` on the client; `prepare(state)` may adjust its setup. */
export function clientComponent(component, path, template = sfc(path).template.content, prepare) {
  return {
    ...component,
    ssrRender: undefined,
    setup: withClientChildren(component.setup ?? (() => ({})), prepare),
    render: compileTemplate(path, template),
  };
}

/** Mounts `component` with `props`; returns the root node and an `unmount`. */
export function mountComponent(component, props = {}, { pinia } = {}) {
  const root = node('root');
  const app = renderer.createApp({ render: () => h(component, props) });
  app.provide(ssrContextKey, { modules: new Set() });
  if (pinia) app.use(pinia);
  app.mount(root);
  return { root, unmount: () => app.unmount() };
}

export const nodeText = (entry) => entry.text + entry.children.map(nodeText).join('');
export const findNode = (entry, match) =>
  match(entry) ? entry : entry.children.map((child) => findNode(child, match)).find(Boolean);
export async function settle() {
  for (let i = 0; i < 8; i++) await nextTick();
}
