import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import fastify from "fastify";
import fastifyStatic from "@fastify/static";
import { ZodError } from "zod";
import { PORT, PUBLIC_URL } from "./config.js";
import { ensureNamespace } from "./k8s/client.js";
import { registerProxy } from "./proxy.js";
import { clusterInfo, createNotebook, deleteNotebook, getNotebook, listNotebooks } from "./k8s/notebooks.js";

const app = fastify({ logger: true });
if (PUBLIC_URL) registerProxy(app);

app.setErrorHandler((err: any, _req, reply) => {
  if (err instanceof ZodError) return reply.code(400).send({ error: err.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ") });
  const code = typeof err.code === "number" ? err.code : err.statusCode ?? 500;
  reply.code(code).send({ error: err.body?.message ?? err.message });
});

app.get("/api/cluster", clusterInfo);
app.get("/api/notebooks", listNotebooks);
app.post("/api/notebooks", async (req, reply) => reply.code(201).send(await createNotebook(req.body)));
app.get<{ Params: { name: string } }>("/api/notebooks/:name", (req) => getNotebook(req.params.name));
app.delete<{ Params: { name: string }; Querystring: { purge?: string } }>("/api/notebooks/:name", async (req, reply) => {
  await deleteNotebook(req.params.name, req.query.purge === "true");
  reply.code(204).send();
});

const webDist = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../web/dist");
if (existsSync(webDist)) await app.register(fastifyStatic, { root: webDist });

await ensureNamespace();
await app.listen({ port: PORT, host: "0.0.0.0" });
