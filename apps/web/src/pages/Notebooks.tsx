import { useEffect, useState } from "react";
import type { NotebookInfo } from "@gpu-cloud/shared";
import { api } from "../api";

export function Notebooks({ refreshKey }: { refreshKey: number }) {
  const [items, setItems] = useState<NotebookInfo[]>([]);
  const [error, setError] = useState("");
  const load = () => api.list().then(setItems).catch((e) => setError(e.message));

  useEffect(() => {
    load();
    const t = setInterval(load, 3000);
    return () => clearInterval(t);
  }, [refreshKey]);

  async function remove(name: string) {
    const purge = confirm("Also delete the persistent storage?");
    try {
      await api.remove(name, purge);
      setError("");
    } catch (e) {
      setError((e as Error).message);
    }
    load();
  }

  return (
    <section>
      <h2>Notebooks</h2>
      {error && <p className="err">{error}</p>}
      <table>
        <thead><tr><th>Name</th><th>GPU</th><th>Status</th><th></th></tr></thead>
        <tbody>
          {items.map((n) => (
            <tr key={n.name}>
              <td>{n.name}</td>
              <td>{n.config.gpus}× {n.config.gpuMemMiB} MiB / {n.config.gpuCores}%</td>
              <td title={n.message}>{n.phase}{n.message && n.phase !== "Running" ? ` – ${n.message.slice(0, 60)}` : ""}</td>
              <td>
                {n.url && <a href={n.url} target="_blank" rel="noreferrer">Open</a>}{" "}
                <button onClick={() => remove(n.name)}>Delete</button>
              </td>
            </tr>
          ))}
          {!items.length && <tr><td colSpan={4}>No notebooks yet.</td></tr>}
        </tbody>
      </table>
    </section>
  );
}
