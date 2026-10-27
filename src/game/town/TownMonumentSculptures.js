import { blenderModel } from './LeisureAssets';
import { resolveModel } from './assets/MeshCatalog';

// Authored sculptures share the town's geometry cache, static batches and moving
// instances. A missing download leaves the existing procedural renderer available.
export function buildMonumentSculpture(d, parent, choice, move) {
  if (resolveModel('monuments', choice).status !== 'ready') return false;
  const model = blenderModel(d, parent, null, choice, 'monuments');
  for (const joint of model.children) {
    if (joint.name.startsWith('wing-'))
      move(joint, 'swing', 'z', 0.7, joint.position.x < 0 ? -0.035 : 0.035);
    else if (joint.name === 'sun') move(joint, 'turn', 'z', 0.14);
    else if (joint.name === 'motes') move(joint, 'turn', 'y', 0.2);
    else if (joint.name.startsWith('pendant-')) move(joint, 'swing', 'z', 1, 0.12);
    else if (joint.name.startsWith('orbit-')) {
      const index = Number(joint.name.slice(6));
      move(joint, 'turn', 'y', (index % 2 ? -1 : 1) * (0.16 + index * 0.06));
    }
  }
  return true;
}
