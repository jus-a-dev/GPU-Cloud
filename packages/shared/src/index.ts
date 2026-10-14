import { z } from "zod";

export const NotebookConfig = z.object({
  name: z.string().regex(/^[a-z]([a-z0-9-]{0,30}[a-z0-9])?$/, "lowercase letters, digits, '-'; max 32 chars"),
  image: z.string().default("quay.io/jupyter/pytorch-notebook:cuda12-latest"),
  gpus: z.number().int().min(1).max(8).default(1),
  gpuMemMiB: z.number().int().min(256).default(4096),
  gpuCores: z.number().int().min(1).max(100).default(100),
  cpu: z.number().min(0.5).max(128).default(2),
  memoryGiB: z.number().min(1).max(1024).default(8),
  storageGiB: z.number().int().min(0).max(2048).default(10),
});
export type NotebookConfig = z.infer<typeof NotebookConfig>;

export type NotebookPhase = "Pending" | "Starting" | "Running" | "Failed";

export interface NotebookInfo {
  name: string;
  config: NotebookConfig;
  phase: NotebookPhase;
  message?: string;
  url?: string;
  createdAt?: string;
}

export interface ClusterInfo {
  nodes: { name: string; gpus: number }[];
  totalGpus: number;
}
