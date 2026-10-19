import { NODE_HOST, PUBLIC_URL } from "./config.js";

export const notebookBasePath = (name: string) => `/nb/${name}/`;

// Single place that decides how users reach a notebook.
export function notebookUrl(name: string, nodePort: number, token: string): string {
  if (PUBLIC_URL) return `${PUBLIC_URL}${notebookBasePath(name)}lab?token=${token}`;
  return `http://${NODE_HOST}:${nodePort}/lab?token=${token}`;
}
