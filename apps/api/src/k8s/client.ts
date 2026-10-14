import * as k8s from "@kubernetes/client-node";
import { NAMESPACE } from "../config.js";

const kc = new k8s.KubeConfig();
kc.loadFromDefault();

export const core = kc.makeApiClient(k8s.CoreV1Api);

export async function ensureNamespace(): Promise<void> {
  try {
    await core.readNamespace({ name: NAMESPACE });
  } catch {
    await core.createNamespace({ body: { metadata: { name: NAMESPACE } } });
  }
}
