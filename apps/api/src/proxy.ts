import type { IncomingMessage, ServerResponse } from "node:http";
import type { Duplex } from "node:stream";
import type { FastifyInstance } from "fastify";
import httpProxy from "http-proxy";
import { NotebookConfig } from "@gpu-cloud/shared";
import { NAMESPACE } from "./config.js";

const proxy = httpProxy.createProxyServer({ xfwd: true });

proxy.on("error", (_err, _req, res) => {
  if ("writeHead" in res) {
    if (!res.headersSent) res.writeHead(502, { "content-type": "application/json" });
    res.end(JSON.stringify({ error: "notebook unreachable" }));
  } else res.destroy();
});

// /nb/<name>/... -> the notebook's in-cluster Service. The path is forwarded untouched because the
// notebook runs with base_url=/nb/<name>/, and Host is preserved so Jupyter's Origin check passes.
function target(url: string | undefined): string | undefined {
  const name = /^\/nb\/([^/?#]+)/.exec(url ?? "")?.[1];
  if (!name || !NotebookConfig.shape.name.safeParse(name).success) return undefined;
  return `http://nb-${name}.${NAMESPACE}.svc.cluster.local:8888`;
}

export function registerProxy(app: FastifyInstance): void {
  app.addHook("onRequest", async (req, reply) => {
    const t = target(req.raw.url);
    if (!t) return;
    reply.hijack();
    proxy.web(req.raw as IncomingMessage, reply.raw as ServerResponse, { target: t });
  });
  app.server.on("upgrade", (req: IncomingMessage, socket: Duplex, head: Buffer) => {
    const t = target(req.url);
    if (t) proxy.ws(req, socket, head, { target: t });
    else socket.destroy();
  });
}
