import { NotebookConfig } from "@gpu-cloud/shared";
import { afterEach, describe, expect, it, vi } from "vitest";
import { buildPod } from "./notebook.js";

describe("buildPod", () => {
  it("maps config to HAMi limits", () => {
    const cfg = NotebookConfig.parse({ name: "demo", gpuMemMiB: 4096, gpuCores: 30 });
    const limits = buildPod(cfg).spec!.containers[0].resources!.limits!;
    expect(limits["nvidia.com/gpu"]).toBe("1");
    expect(limits["nvidia.com/gpumem"]).toBe("4096");
    expect(limits["nvidia.com/gpucores"]).toBe("30");
  });
  it("omits the work volume when storage is 0", () => {
    const pod = buildPod(NotebookConfig.parse({ name: "demo", storageGiB: 0 }));
    expect(pod.spec!.volumes!.some((v) => v.name === "work")).toBe(false);
  });
  it("pins the pod to a node when given one", () => {
    const pod = buildPod(NotebookConfig.parse({ name: "demo" }), "worker-01");
    expect(pod.spec!.nodeSelector).toEqual({ "kubernetes.io/hostname": "worker-01" });
    expect(buildPod(NotebookConfig.parse({ name: "demo" })).spec!.nodeSelector).toBeUndefined();
  });
});

describe("PUBLIC_URL mode", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });
  it("sets Jupyter base_url and returns proxied notebook URLs", async () => {
    vi.stubEnv("PUBLIC_URL", "https://gpu.example.org/");
    vi.resetModules();
    const { buildPod } = await import("./notebook.js");
    const { notebookUrl } = await import("../url.js");
    const args = buildPod(NotebookConfig.parse({ name: "demo" })).spec!.containers[0].args!;
    expect(args).toContain("--ServerApp.base_url=/nb/demo/");
    expect(notebookUrl("demo", 30001, "tok")).toBe("https://gpu.example.org/nb/demo/lab?token=tok");
  });
  it("falls back to NodePort URLs without PUBLIC_URL", async () => {
    vi.stubEnv("PUBLIC_URL", "");
    vi.stubEnv("NODE_HOST", "10.0.0.1");
    vi.resetModules();
    const { notebookUrl } = await import("../url.js");
    expect(notebookUrl("demo", 30001, "tok")).toBe("http://10.0.0.1:30001/lab?token=tok");
  });
});
