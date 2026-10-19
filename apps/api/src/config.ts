export const NAMESPACE = process.env.NAMESPACE ?? "gpu-cloud";
export const NODE_HOST = process.env.NODE_HOST ?? "localhost";
// Public base URL of this app (e.g. https://gpu.airis.org.in). When set, notebooks are served under
// /nb/<name>/ through the built-in proxy instead of being exposed on NodePorts.
export const PUBLIC_URL = (process.env.PUBLIC_URL ?? "").replace(/\/+$/, "");
export const PORT = Number(process.env.PORT ?? 8080);
export const LABEL = "gpucloud.io/managed";
export const NAME_LABEL = "gpucloud.io/name";
export const CONFIG_ANNOTATION = "gpucloud.io/config";
// Set to "" to disable. Needed on k3s, where nvidia is not the default runtime.
export const RUNTIME_CLASS = process.env.RUNTIME_CLASS ?? "nvidia";
