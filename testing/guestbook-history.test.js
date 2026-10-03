import { beforeEach, describe, expect, it } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { createSSRApp, h } from 'vue';
import { renderToString } from 'vue/server-renderer';
import { mergeVisits, visitDays } from '../src/data/liveVisitors';
import { useSettingsStore } from '../src/stores/settingsStore';
import TownGuestbook from '../src/components/town/TownGuestbook.vue';

const HOUR = 3600000;
const now = new Date(2026, 9, 3, 18, 0).getTime();
const visit = (id, arrivedAt, extra = {}) => ({
  id,
  name: `Guest ${id}`,
  townName: null,
  era: 'frontier',
  publicId: null,
  arrivedAt,
  lastSeenAt: arrivedAt,
  departedAt: arrivedAt + 5 * 60000,
  ...extra,
});

// The guestbook's live first page and the older pages loaded on scroll overlap once new
// visitors arrive, so they merge by visit and nothing slips between two pages.
describe('guestbook history', () => {
  it('merges overlapping pages newest first and keeps the live copy of a visit', () => {
    const older = [visit('c', now - 3 * HOUR), visit('b', now - 2 * HOUR)];
    const live = [
      visit('d', now - HOUR, { departedAt: null }),
      visit('b', now - 2 * HOUR, { departedAt: now }),
    ];
    const merged = mergeVisits(older, live);
    expect(merged.map((entry) => entry.id)).toEqual(['d', 'b', 'c']);
    expect(merged[1].departedAt).toBe(now);
    // Visits in the same second keep the server's order by id.
    expect(mergeVisits([visit('x', now), visit('y', now)]).map((entry) => entry.id)).toEqual([
      'y',
      'x',
    ]);
  });

  it('groups visits under Today, Yesterday and older dates', () => {
    const days = visitDays(
      [
        visit('a', now - HOUR),
        visit('b', now - 2 * HOUR),
        visit('c', now - 24 * HOUR),
        visit('d', now - 72 * HOUR),
      ],
      now,
      'en',
    );
    expect(days.map((day) => day.label)).toEqual(['Today', 'Yesterday', 'Wednesday, September 30']);
    expect(days[0].visits.map((entry) => entry.id)).toEqual(['a', 'b']);
  });
});

describe('guestbook card', () => {
  beforeEach(() => setActivePinia(createPinia()));
  const render = (props, pinia = createPinia()) =>
    renderToString(createSSRApp({ render: () => h(TownGuestbook, props) }).use(pinia));
  const snapshot = {
    present: [visit('live', Date.now() - 60000, { departedAt: null })],
    history: [visit('live', Date.now() - 60000, { departedAt: null }), visit('old', now - HOUR)],
    hasNext: true,
    page: 1,
  };

  it('opens on who is here now and the history, with older visits loading on scroll', async () => {
    const html = await render({ townId: 'a'.repeat(36), snapshot });
    expect(html).toContain('aria-expanded="true"');
    expect(html).toContain('Here now · 1');
    expect(html).toContain('guestbook-scroll');
    expect(html).toContain('Today');
    expect(html).toContain('Show older visits');
    expect(html).not.toContain('Previous');
  });

  it('marks the start of the guestbook once every page is loaded', async () => {
    const html = await render({
      townId: 'a'.repeat(36),
      snapshot: { ...snapshot, hasNext: false },
    });
    expect(html).toContain('This is the first visit in the guestbook.');
    expect(html).not.toContain('Show older visits');
  });

  it('folds with one tap and keeps the live count in the folded header', async () => {
    const pinia = createPinia();
    setActivePinia(pinia);
    useSettingsStore().setGuestbookCollapsed(true);
    const html = await render({ villageId: 'b'.repeat(32), snapshot }, pinia);
    expect(html).toContain('aria-expanded="false"');
    expect(html).toContain('guestbook-live');
    expect(html).toMatch(/class="guestbook-body"[^>]*style="display:none;"/);
  });
});
