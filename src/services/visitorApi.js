import { request } from './cloudProfile';

export const loadVisitorProfile = () => request('account/profile', undefined, 'GET', true);
export const saveVisitorProfile = (profile) => request('account/profile', profile, 'PATCH', true);
export const joinVillage = (id, presence) =>
  request(`villages/${encodeURIComponent(id)}/presence`, presence, 'POST', true);
// Departure is authorized solely by the random lease token. It remains usable
// after sign-out, and keepalive lets navigation finish without abandoning it.
export const leaveVillage = (id, presence) =>
  fetch(
    `${(import.meta.env.VITE_API_BASE ?? '/api/v1').replace(/\/$/, '')}/villages/${encodeURIComponent(id)}/presence`,
    {
      method: 'DELETE',
      credentials: 'same-origin',
      keepalive: true,
      signal: AbortSignal.timeout(5000),
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(presence),
    },
  );
export const townVisitors = (id, page = 1) =>
  request(`towns/${encodeURIComponent(id)}/visitors?page=${page}`);
