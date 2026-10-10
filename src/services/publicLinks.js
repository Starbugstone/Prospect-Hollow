// Addresses on the public site. They read only the build settings, never a town or a save,
// so the admin panel can link to the privacy notice without the game's storage code.

// The home page lives at the site root and the game at /play, so a reload keeps
// the player where they were and the home page stays one tap away.
export const HOME_PATH = import.meta.env.BASE_URL ?? '/';
// Shared towns open at their own view-only address, never inside the game.
export const VISIT_PATH = `${HOME_PATH}visit`;
// The privacy notice is a plain page that never opens a town or touches the saves.
export const PRIVACY_PATH = `${HOME_PATH}privacy`;

// Share links and the privacy notice point at the public site, including from the native app.
function publicOrigin(env) {
  const api = env.VITE_API_BASE;
  const origin =
    env.VITE_PUBLIC_ORIGIN || (api?.startsWith('https://') ? new URL(api).origin : location.origin);
  return origin.replace(/\/+$/, '');
}
export function visitUrl(publicId, env = import.meta.env) {
  return `${publicOrigin(env)}${VISIT_PATH}#${new URLSearchParams({ town: publicId })}`;
}
export const privacyUrl = (env = import.meta.env) => `${publicOrigin(env)}${PRIVACY_PATH}`;
