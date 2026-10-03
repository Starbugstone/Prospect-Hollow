import { reactive } from 'vue';

// Cross-view requests for Town Honours. The popup and honour details can open the
// collection or a pre-filtered museum without the views importing each other.
const requests = reactive({ collection: null, museum: null });

export function useHonourNavigation() {
  return {
    requests,
    openCollection(familyId = null) {
      requests.collection = { familyId };
    },
    closeCollection() {
      requests.collection = null;
    },
    openMuseumFor(familyId) {
      requests.museum = { familyId };
    },
    clearMuseumRequest() {
      requests.museum = null;
    },
  };
}
