import { createApp, h } from 'vue';
import HonourBadge from './HonourBadge.vue';

// An SVG drawn as an image loads no files, so nested art becomes data URLs.
const inlined = new Map();
function inline(href) {
  if (!inlined.has(href))
    inlined.set(
      href,
      fetch(href)
        .then((response) => (response.ok ? response.blob() : Promise.reject()))
        .then(
          (blob) =>
            new Promise((resolve) => {
              const reader = new FileReader();
              reader.onload = () => resolve(reader.result);
              reader.readAsDataURL(blob);
            }),
        )
        .catch(() => href),
    );
  return inlined.get(href);
}

// The badge exactly as the honours list draws it, as an image for canvas textures
// such as the mine plaque.
export async function honourBadgeImage(definition, size) {
  const host = document.createElement('div');
  const app = createApp(() => h(HonourBadge, { definition, size }));
  app.mount(host);
  const svg = host.querySelector('svg').cloneNode(true);
  app.unmount();
  svg.setAttribute('width', size);
  svg.setAttribute('height', size);
  for (const image of svg.querySelectorAll('image'))
    image.setAttribute('href', await inline(image.getAttribute('href')));
  const picture = new Image();
  picture.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(new XMLSerializer().serializeToString(svg))}`;
  await picture.decode();
  return picture;
}
