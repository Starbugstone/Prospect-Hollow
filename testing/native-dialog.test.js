import { afterEach, expect, it, vi } from 'vitest';

const hooks = vi.hoisted(() => ({ mount: [], unmount: [] }));
vi.mock('vue', () => ({
  ref: (value) => ({ value }),
  onMounted: (callback) => hooks.mount.push(callback),
  onBeforeUnmount: (callback) => hooks.unmount.push(callback),
}));
import { useNativeDialog } from '../src/composables/useNativeDialog';

afterEach(() => {
  hooks.unmount.splice(0).forEach((callback) => callback());
  hooks.mount.length = 0;
  vi.unstubAllGlobals();
});
function fixture(options) {
  const keys = new Map();
  vi.stubGlobal('document', {
    activeElement: null,
    addEventListener: (name, handler) => keys.set(name, handler),
    removeEventListener: (name) => keys.delete(name),
  });
  const close = vi.fn(),
    handlers = new Map(),
    element = {
      addEventListener: (name, handler) => handlers.set(name, handler),
      removeEventListener: (name) => handlers.delete(name),
      getBoundingClientRect: () => ({ left: 100, right: 300, top: 100, bottom: 300 }),
      showModal: vi.fn(),
      show: vi.fn(),
      close() {},
    };
  const dialog = useNativeDialog(close, options);
  dialog.dialog.value = element;
  dialog.closeButton.value = { focus() {} };
  hooks.mount.splice(0).forEach((callback) => callback());
  const outside = { target: element, clientX: 20, clientY: 20 };
  return { close, handlers, keys, dialog, element, outside };
}
it('keeps a dialog opened by touch pointerup open until a new backdrop tap', () => {
  const { close, handlers, dialog, outside } = fixture();
  // The browser retargets the opening touch's compatibility click to the modal.
  dialog.dismissBackdrop(outside);
  expect(close).not.toHaveBeenCalled();
  handlers.get('pointerdown')(outside);
  dialog.dismissBackdrop(outside);
  expect(close).toHaveBeenCalledOnce();
});
it('does not treat a press inside the dialog followed by release outside as dismissal', () => {
  const { close, handlers, dialog, element, outside } = fixture();
  handlers.get('pointerdown')({ target: element, clientX: 200, clientY: 200 });
  dialog.dismissBackdrop(outside);
  expect(close).not.toHaveBeenCalled();
});
it('opens a sheet without the modal top layer and still closes it with Escape', () => {
  const { close, keys, element } = fixture({ modal: false });
  expect(element.show).toHaveBeenCalledOnce();
  expect(element.showModal).not.toHaveBeenCalled();
  keys.get('keydown')({ key: 'Enter' });
  expect(close).not.toHaveBeenCalled();
  keys.get('keydown')({ key: 'Escape' });
  expect(close).toHaveBeenCalledOnce();
  hooks.unmount.splice(0).forEach((callback) => callback());
  expect(keys.has('keydown')).toBe(false);
});
it('keeps modal dialogs on the native top layer without a page key listener', () => {
  const { keys, element } = fixture();
  expect(element.showModal).toHaveBeenCalledOnce();
  expect(keys.size).toBe(0);
});
