import { NODE_HOST } from "./config.js";

// Single place that decides how users reach a notebook. Swap for ingress/proxy later.
export function notebookUrl(nodePort: number, token: string): string {
  return `http://${NODE_HOST}:${nodePort}/lab?token=${token}`;
}
