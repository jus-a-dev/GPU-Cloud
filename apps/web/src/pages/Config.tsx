import { useEffect, useState } from "react";
import type { ClusterInfo, NotebookConfig } from "@gpu-cloud/shared";
import { api } from "../api";

const PRESETS: Record<string, Partial<NotebookConfig>> = {
  "Small (4 GiB, 25% cores)": { gpuMemMiB: 4096, gpuCores: 25 },
  "Medium (8 GiB, 50% cores)": { gpuMemMiB: 8192, gpuCores: 50 },
  "Full GPU": { gpuMemMiB: 24576, gpuCores: 100 },
};

export function Config({ onCreated }: { onCreated: () => void }) {
  const [cfg, setCfg] = useState<Partial<NotebookConfig>>({
    name: "", gpus: 1, gpuMemMiB: 4096, gpuCores: 25, cpu: 2, memoryGiB: 8, storageGiB: 10,
  });
  const [cluster, setCluster] = useState<ClusterInfo>();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => { api.cluster().then(setCluster).catch(() => {}); }, []);

  const num = (k: keyof NotebookConfig) => ({
    value: (cfg[k] as number) ?? "",
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => setCfg({ ...cfg, [k]: Number(e.target.value) }),
    type: "number" as const,
  });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError("");
    try { await api.create(cfg); onCreated(); } catch (err) { setError((err as Error).message); }
    setBusy(false);
  }

  return (
    <section>
      <h2>Launch JupyterLab</h2>
      {cluster && <p>Cluster GPUs: {cluster.totalGpus}</p>}
      <form onSubmit={submit}>
        <label>Name<input value={cfg.name} onChange={(e) => setCfg({ ...cfg, name: e.target.value })} required /></label>
        <label>Preset
          <select onChange={(e) => setCfg({ ...cfg, ...PRESETS[e.target.value] })} defaultValue="">
            <option value="" disabled>Choose…</option>
            {Object.keys(PRESETS).map((p) => <option key={p}>{p}</option>)}
          </select>
        </label>
        <div className="grid">
          <label>GPUs<input {...num("gpus")} /></label>
          <label>GPU memory (MiB)<input {...num("gpuMemMiB")} /></label>
          <label>GPU cores (%)<input {...num("gpuCores")} /></label>
          <label>CPU<input {...num("cpu")} /></label>
          <label>Memory (GiB)<input {...num("memoryGiB")} /></label>
          <label>Storage (GiB, 0 = none)<input {...num("storageGiB")} /></label>
        </div>
        <label>Image<input value={cfg.image ?? ""} placeholder="default: pytorch-notebook (CUDA 12)" onChange={(e) => setCfg({ ...cfg, image: e.target.value || undefined })} /></label>
        {error && <p className="err">{error}</p>}
        <button disabled={busy}>{busy ? "Launching…" : "Launch"}</button>
      </form>
    </section>
  );
}
