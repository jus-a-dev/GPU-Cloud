import type { V1Pod } from "@kubernetes/client-node";
import type { NotebookPhase } from "@gpu-cloud/shared";

export function podStatus(pod: V1Pod): { phase: NotebookPhase; message?: string } {
  const st = pod.status;
  const cs = st?.containerStatuses?.[0];
  const waiting = cs?.state?.waiting;
  if (st?.phase === "Failed") return { phase: "Failed", message: st.message };
  if (waiting && ["ErrImagePull", "ImagePullBackOff", "CrashLoopBackOff", "CreateContainerError"].includes(waiting.reason ?? ""))
    return { phase: "Failed", message: `${waiting.reason}: ${waiting.message ?? ""}` };
  const unsched = st?.conditions?.find((c) => c.type === "PodScheduled" && c.status === "False");
  if (unsched) return { phase: "Pending", message: unsched.message ?? unsched.reason };
  if (st?.phase === "Running" && cs?.ready) return { phase: "Running" };
  if (st?.phase === "Running" || waiting) return { phase: "Starting", message: waiting?.reason };
  return { phase: "Pending" };
}
