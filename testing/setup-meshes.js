import { ALL_MESH_FAMILIES, loadFamilies } from '../src/game/town/assets/MeshCatalog';
await loadFamilies(ALL_MESH_FAMILIES);

import { loadFootprints } from '../src/game/town/FootprintCatalog';
import { ERAS } from '../src/data/eras';
await loadFootprints({ buildingEras: Object.fromEntries(ERAS.map((e) => [e.id, e.id])) });
