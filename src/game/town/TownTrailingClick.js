// The town settles a tap on pointerup, but the browser still sends that tap's click
// afterwards at the same spot. When the tap opened a building sheet, the click would land
// on whatever now sits under the finger, such as its Upgrade button. Swallow that one
// click when it lands outside the map; the next press or a short wait ends the guard.
export function swallowTrailingClick(map, { root = document, wait = 500 } = {}) {
  let timer;
  const release = () => {
    clearTimeout(timer);
    root.removeEventListener('click', swallow, true);
    root.removeEventListener('pointerdown', release, true);
  };
  function swallow(event) {
    // Keyboard and assistive activation (detail 0) is never a leftover tap.
    if (event.detail === 0) return;
    release();
    if (map?.contains(event.target)) return;
    event.preventDefault();
    event.stopImmediatePropagation();
  }
  root.addEventListener('click', swallow, true);
  root.addEventListener('pointerdown', release, true);
  timer = setTimeout(release, wait);
  return release;
}
