import type { ClusterInfo, NotebookConfig, NotebookInfo } from "@gpu-cloud/shared";

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const r = await fetch(path, { ...init, headers: { ...(init?.body ? { "content-type": "application/json" } : {}) } });
  if (!r.ok) throw new Error((await r.json().catch(() => ({ error: r.statusText }))).error);
  return r.status === 204 ? (undefined as T) : r.json();
}

export const api = {
  cluster: () => req<ClusterInfo>("/api/cluster"),
  list: () => req<NotebookInfo[]>("/api/notebooks"),
  create: (c: Partial<NotebookConfig>) => req<NotebookInfo>("/api/notebooks", { method: "POST", body: JSON.stringify(c) }),
  remove: (name: string, purge: boolean) => req<void>(`/api/notebooks/${name}?purge=${purge}`, { method: "DELETE" }),
};
