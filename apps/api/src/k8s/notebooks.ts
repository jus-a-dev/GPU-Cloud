import { randomBytes } from "node:crypto";
import { NotebookConfig, type ClusterInfo, type NotebookInfo } from "@gpu-cloud/shared";
import { CONFIG_ANNOTATION, LABEL, NAME_LABEL, NAMESPACE } from "../config.js";
import { notebookUrl } from "../url.js";
import { core } from "./client.js";
import { buildPod, buildPvc, buildSecret, buildService, podName, pvcName, secretName } from "./notebook.js";
import { podStatus } from "./status.js";

const selector = `${LABEL}=true`;

export async function createNotebook(input: unknown): Promise<NotebookInfo> {
  const cfg = NotebookConfig.parse(input);
  const token = randomBytes(24).toString("hex");
  await core.createNamespacedSecret({ namespace: NAMESPACE, body: buildSecret(cfg, token) });
  let nodeName: string | undefined;
  if (cfg.storageGiB > 0) {
    try {
      await core.createNamespacedPersistentVolumeClaim({ namespace: NAMESPACE, body: buildPvc(cfg) });
    } catch (e: any) {
      if (e?.code !== 409) throw e; // reuse existing PVC; local-path volumes are bound to one node
      const pvc = await core.readNamespacedPersistentVolumeClaim({ name: pvcName(cfg.name), namespace: NAMESPACE });
      nodeName = pvc.metadata?.annotations?.["volume.kubernetes.io/selected-node"];
    }
  }
  await core.createNamespacedPod({ namespace: NAMESPACE, body: buildPod(cfg, nodeName) });
  await core.createNamespacedService({ namespace: NAMESPACE, body: buildService(cfg) });
  return getNotebook(cfg.name);
}

export async function getNotebook(name: string): Promise<NotebookInfo> {
  const pod = await core.readNamespacedPod({ name: podName(name), namespace: NAMESPACE });
  // The Service/Secret can be gone while the pod is still terminating (e.g. removed by the cleanup CronJob).
  const optional = <T>(p: Promise<T>) => p.catch((e: any) => { if (e?.code === 404) return undefined; throw e; });
  const svc = await optional(core.readNamespacedService({ name: podName(name), namespace: NAMESPACE }));
  const sec = await optional(core.readNamespacedSecret({ name: secretName(name), namespace: NAMESPACE }));
  const token = Buffer.from(sec?.data?.token ?? "", "base64").toString();
  const nodePort = svc?.spec?.ports?.[0]?.nodePort;
  const { phase, message } = podStatus(pod);
  return {
    name,
    config: JSON.parse(pod.metadata?.annotations?.[CONFIG_ANNOTATION] ?? "{}"),
    phase,
    message,
    url: nodePort && sec && phase === "Running" && !pod.metadata?.deletionTimestamp ? notebookUrl(name, nodePort, token) : undefined,
    createdAt: pod.metadata?.creationTimestamp?.toISOString(),
  };
}

export async function listNotebooks(): Promise<NotebookInfo[]> {
  const pods = await core.listNamespacedPod({ namespace: NAMESPACE, labelSelector: selector });
  const names = pods.items.map((p) => p.metadata?.labels?.[NAME_LABEL]).filter((n): n is string => !!n);
  const found = await Promise.all(names.map((n) => getNotebook(n).catch((e: any) => { if (e?.code === 404) return undefined; throw e; })));
  return found.filter((n): n is NotebookInfo => !!n);
}

export async function deleteNotebook(name: string, purge = false): Promise<void> {
  const ignore = (e: any) => { if (e?.code !== 404) throw e; };
  await core.deleteNamespacedService({ name: podName(name), namespace: NAMESPACE }).catch(ignore);
  await core.deleteNamespacedPod({ name: podName(name), namespace: NAMESPACE }).catch(ignore);
  await core.deleteNamespacedSecret({ name: secretName(name), namespace: NAMESPACE }).catch(ignore);
  if (purge) await core.deleteNamespacedPersistentVolumeClaim({ name: pvcName(name), namespace: NAMESPACE }).catch(ignore);
}

export async function clusterInfo(): Promise<ClusterInfo> {
  const nodes = (await core.listNode()).items.map((n) => ({
    name: n.metadata?.name ?? "",
    gpus: Number(n.status?.allocatable?.["nvidia.com/gpu"] ?? 0),
  }));
  return { nodes, totalGpus: nodes.reduce((a, n) => a + n.gpus, 0) };
}
