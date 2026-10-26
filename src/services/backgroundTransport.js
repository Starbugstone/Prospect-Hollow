// Used both by the worker and by browsers/headless callers without Worker.
export async function fetchCloudReply({ url, options }) {
  const response = await fetch(url, { ...options, signal: AbortSignal.timeout(15000) });
  if (response.text)
    return { ok: response.ok, status: response.status, text: await response.text() };
  // Headless fetch doubles may expose json() only.
  try {
    return { ok: response.ok, status: response.status, data: await response.json() };
  } catch {
    return { ok: response.ok, status: response.status, unreadable: true };
  }
}
