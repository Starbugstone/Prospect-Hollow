// Keep WebGL overlays and the accessible map at the same relative scale.
export const townIndicatorScale = (kind) => (['ready', 'coins', 'tnt'].includes(kind) ? 1.4 : 1);
