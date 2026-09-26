export function sharedLoader(importer) {
  let pending;
  return () =>
    (pending ??= importer().catch((error) => {
      pending = null;
      throw error;
    }));
}
export const loadBoard = sharedLoader(() => import('../../components/BoardCanvas.vue'));
export function prefetchBoard() {
  return loadBoard().catch(() => {});
}
