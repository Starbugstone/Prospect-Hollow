import { createJsonWorkerHandler } from './backgroundJsonProtocol';
import { recoveryStore } from './recoveryDatabase';
import { fetchCloudReply } from './backgroundTransport';
const handle = createJsonWorkerHandler((message) => self.postMessage(message), {
  fetchText: fetchCloudReply,
  putUpload: (value) => recoveryStore.putUpload(value),
  getUpload: ({ id, owner, townId }) => recoveryStore.getUpload(id, owner, townId),
  putRecovery: (value) => recoveryStore.put(value),
  getRecovery: ({ id, owner, townId }) => recoveryStore.get(id, owner, townId),
  removeUpload: ({ id, owner, townId }) => recoveryStore.removeUpload(id, owner, townId),
});
self.onmessage = ({ data }) => handle(data);
