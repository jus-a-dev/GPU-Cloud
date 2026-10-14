import { NotebookConfig } from "@gpu-cloud/shared";
import { describe, expect, it } from "vitest";
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
});
