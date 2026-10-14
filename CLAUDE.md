# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands
- `npm install` — install all workspaces
- `npm run dev:api` / `npm run dev:web` — API on :8080 (uses default kubeconfig, set `NODE_HOST` to a node IP), Vite UI proxying `/api` to it
- `npm run build` — builds `packages/shared`, then web, then api (order matters; both apps import shared's `dist`, so rebuild shared after changing the schema)
- `npm test` — vitest (api only); single test: `npm -w apps/api exec vitest run -t "<name>"`
- `docker compose up --build` — production-style run (needs `.env` with `NODE_HOST`; see `.env.example`)
- No linter is configured. `npm run build` type-checks both apps.

## Architecture
npm-workspaces monorepo: `packages/shared` (zod `NotebookConfig` + API types, used by both apps), `apps/api` (Fastify; also serves built `apps/web/dist` when present), `apps/web` (React/Vite).

There is no database: Kubernetes is the source of truth. Each notebook is a Pod + NodePort Service + token Secret (+ optional PVC), all named `nb-<name>*` and labeled `gpucloud.io/managed=true` in one namespace (`NAMESPACE`, default `gpu-cloud`, created on startup). The original config is stored as a JSON pod annotation and read back by `getNotebook`. Manifest builders are in `apps/api/src/k8s/notebook.ts`, orchestration in `k8s/notebooks.ts`, pod-phase mapping in `k8s/status.ts`.

GPU slicing is done purely via HAMi resource limits on the container (`nvidia.com/gpu`, `gpumem` in MiB, `gpucores` in %). The names are configurable in the cluster's `hami-scheduler-device` ConfigMap; verify before changing.

Notebook URL construction is isolated in `apps/api/src/url.ts` (`http://NODE_HOST:nodePort/lab?token=…`) so it can be swapped for ingress/reverse-proxy.

## Gotchas
- Target cluster is k3s, where `nvidia` is not the default container runtime. Notebook pods set `runtimeClassName` from `RUNTIME_CLASS` (default `nvidia`; set empty elsewhere). The HAMi `hami-device-plugin` DaemonSet needs the same (`devicePlugin.runtimeClassName=nvidia` in its Helm values); otherwise it crash-loops with "Incompatible strategy detected auto" and the node never gets `nvidia.com/gpu`, leaving pods Pending as "node unregistered".
- The first notebook launch is slow: the default CUDA PyTorch image is multi-GB, so pods sit in `ContainerCreating` while it pulls.
- `apps/web/src/api.ts` must only send `content-type: application/json` when there is a body; Fastify rejects body-less DELETEs that carry it with a 400.
