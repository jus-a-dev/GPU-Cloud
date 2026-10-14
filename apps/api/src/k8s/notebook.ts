import type { V1PersistentVolumeClaim, V1Pod, V1Secret, V1Service } from "@kubernetes/client-node";
import type { NotebookConfig } from "@gpu-cloud/shared";
import { CONFIG_ANNOTATION, LABEL, NAME_LABEL, NAMESPACE, RUNTIME_CLASS } from "../config.js";

const labels = (name: string) => ({ [LABEL]: "true", [NAME_LABEL]: name });
export const podName = (n: string) => `nb-${n}`;
export const secretName = (n: string) => `nb-${n}-token`;
export const pvcName = (n: string) => `nb-${n}-work`;

export function buildSecret(cfg: NotebookConfig, token: string): V1Secret {
  return {
    metadata: { name: secretName(cfg.name), namespace: NAMESPACE, labels: labels(cfg.name) },
    stringData: { token },
  };
}

export function buildPvc(cfg: NotebookConfig): V1PersistentVolumeClaim {
  return {
    metadata: { name: pvcName(cfg.name), namespace: NAMESPACE, labels: labels(cfg.name) },
    spec: {
      accessModes: ["ReadWriteOnce"],
      resources: { requests: { storage: `${cfg.storageGiB}Gi` } },
    },
  };
}

export function buildPod(cfg: NotebookConfig): V1Pod {
  return {
    metadata: {
      name: podName(cfg.name),
      namespace: NAMESPACE,
      labels: labels(cfg.name),
      annotations: { [CONFIG_ANNOTATION]: JSON.stringify(cfg) },
    },
    spec: {
      restartPolicy: "Always",
      ...(RUNTIME_CLASS ? { runtimeClassName: RUNTIME_CLASS } : {}),
      containers: [
        {
          name: "jupyter",
          image: cfg.image,
          command: ["start-notebook.py"],
          args: ["--IdentityProvider.token=$(JUPYTER_TOKEN)", "--ServerApp.ip=0.0.0.0"],
          env: [
            {
              name: "JUPYTER_TOKEN",
              valueFrom: { secretKeyRef: { name: secretName(cfg.name), key: "token" } },
            },
          ],
          ports: [{ containerPort: 8888, name: "http" }],
          resources: {
            limits: {
              "nvidia.com/gpu": String(cfg.gpus),
              "nvidia.com/gpumem": String(cfg.gpuMemMiB),
              "nvidia.com/gpucores": String(cfg.gpuCores),
              cpu: String(cfg.cpu),
              memory: `${cfg.memoryGiB}Gi`,
            },
          },
          volumeMounts: [
            { name: "shm", mountPath: "/dev/shm" },
            ...(cfg.storageGiB > 0 ? [{ name: "work", mountPath: "/home/jovyan/work" }] : []),
          ],
        },
      ],
      volumes: [
        { name: "shm", emptyDir: { medium: "Memory" } },
        ...(cfg.storageGiB > 0
          ? [{ name: "work", persistentVolumeClaim: { claimName: pvcName(cfg.name) } }]
          : []),
      ],
    },
  };
}

export function buildService(cfg: NotebookConfig): V1Service {
  return {
    metadata: { name: podName(cfg.name), namespace: NAMESPACE, labels: labels(cfg.name) },
    spec: {
      type: "NodePort",
      selector: { [NAME_LABEL]: cfg.name },
      ports: [{ port: 8888, targetPort: 8888, name: "http" }],
    },
  };
}
