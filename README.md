# GPU Cloud

Self-hosted mini "AWS" for GPU JupyterLab notebooks. Fill in a config page (GPU count, GPU memory, GPU core %, CPU, RAM, storage) and get a JupyterLab on a GPU slice. GPUs are shared between notebooks with [HAMi](https://github.com/Project-HAMi/HAMi) on Kubernetes.

```
Browser -> GPU Cloud (UI + API, Node) -> Kubernetes API -> Pod + NodePort Service (+ PVC) with HAMi GPU limits
```

## Quick start (cluster already has HAMi working)
```bash
cp .env.example .env     # set NODE_HOST to a node IP your users can reach
docker compose up -d --build
# open http://localhost:8080
```

## Manual setup from scratch

### 0. Prerequisites
A Linux GPU machine with: an NVIDIA GPU, root access, and either Docker or Node.js 20+ for the app. `kubectl` and `helm` on your workstation.

### 1. NVIDIA driver and container toolkit (on the GPU node)
```bash
nvidia-smi                                   # driver must work
# install NVIDIA Container Toolkit: https://docs.nvidia.com/datacenter/cloud-native/container-toolkit/latest/install-guide.html
nvidia-ctk --version
```

### 2. Kubernetes with the nvidia runtime
The example below uses k3s. k3s auto-detects the toolkit and registers an `nvidia` RuntimeClass, but it is **not** the default runtime, which matters in step 4.
```bash
curl -sfL https://get.k3s.io | sh -
sudo systemctl restart k3s                   # after installing the toolkit, so it is detected
mkdir -p ~/.kube && sudo cat /etc/rancher/k3s/k3s.yaml > ~/.kube/config && chmod 600 ~/.kube/config
kubectl get runtimeclass nvidia              # must exist
```
For other distributions, configure containerd with the nvidia runtime (`sudo nvidia-ctk runtime configure --runtime=containerd`) and create a RuntimeClass named `nvidia` with handler `nvidia`.

### 3. Label the GPU node
HAMi's device plugin only runs on nodes labeled `gpu=on`.
```bash
kubectl label node <node-name> gpu=on
```

### 4. Install HAMi
```bash
helm repo add hami-charts https://project-hami.github.io/HAMi/
helm repo update
helm install hami hami-charts/hami -n kube-system --set devicePlugin.runtimeClassName=nvidia
```
`devicePlugin.runtimeClassName=nvidia` is required on k3s: without it the plugin cannot see the GPU, crash-loops with `Incompatible strategy detected auto`, and the node never advertises `nvidia.com/gpu`. Check the [HAMi install docs](https://github.com/Project-HAMi/HAMi#quick-start) for chart options such as the kube-scheduler image tag, which depend on your Kubernetes version.

Verify:
```bash
kubectl -n kube-system get pods | grep hami                      # device-plugin 2/2 Running
kubectl get node -o custom-columns=N:.metadata.name,GPU:.status.allocatable.nvidia\\.com/gpu
kubectl -n kube-system logs ds/hami-device-plugin -c device-plugin | grep Registered
```
The GPU column should show a number (10 by default, the number of shares per physical GPU).

### 5. Run GPU Cloud
Kubeconfig requirements: permission to create namespaces, pods, services, secrets and PVCs.

**Option A, Docker Compose**
```bash
cp .env.example .env
$EDITOR .env          # NODE_HOST (required), NAMESPACE, RUNTIME_CLASS, KUBECONFIG_PATH, BIND
docker compose up -d --build
```
**Option B, plain Node**
```bash
npm install && npm run build
NODE_HOST=<node-ip> NAMESPACE=gpu-cloud PORT=8080 node apps/api/dist/server.js
```

| Variable | Default | Meaning |
|---|---|---|
| `NODE_HOST` | `localhost` | Address put in notebook URLs. Must be reachable by users. |
| `NAMESPACE` | `gpu-cloud` | Created on startup. |
| `RUNTIME_CLASS` | `nvidia` | RuntimeClass for notebook pods. Set empty if `nvidia` is already the default runtime. |
| `KUBECONFIG_PATH` | `~/.kube/config` | Host kubeconfig mounted read-only (Compose). |
| `PORT` / `BIND` | `8080` / `127.0.0.1` | Listen port and interface (Compose). |

Open the UI, pick a preset, and launch. The first launch is slow because the default image (`quay.io/jupyter/pytorch-notebook:cuda12-latest`) is several GB. Open the notebook from its **Open** link: `http://NODE_HOST:<nodePort>/lab?token=...`. NodePorts (30000-32767) must be reachable from the user's machine.

### 6. Verify end to end
```bash
kubectl -n gpu-cloud get pod,svc
kubectl -n gpu-cloud exec nb-<name> -- nvidia-smi    # memory.total equals the limit you chose
```

## Troubleshooting
| Symptom | Cause / fix |
|---|---|
| Notebook Pending: `node unregistered` | HAMi plugin not registered the node. Check `kubectl -n kube-system logs ds/hami-device-plugin -c device-plugin`; usually the runtimeClass fix in step 4. |
| Pending: insufficient `nvidia.com/gpumem` / `gpucores` | Request exceeds free GPU memory or cores; lower it or delete a notebook. |
| `ContainerCreating` for minutes | Large image still pulling. |
| Notebook URL does not open | `NODE_HOST` wrong, or the NodePort is blocked by a firewall. |

## Security
- There is **no authentication** (v1). Anyone who can reach the UI can create and delete notebooks and read each notebook's token URL. The UI binds to `127.0.0.1` by default; put it behind a VPN or an authenticating reverse proxy before exposing it.
- Notebook tokens live in Kubernetes Secrets (`nb-<name>-token`) and are shown only in the notebook URL.
- Mounting your kubeconfig gives the app that user's cluster rights; use a dedicated, namespace-scoped account where possible.
- Never commit `.env` or kubeconfig files (`.env` is gitignored and excluded from the Docker build context).

## Development
```bash
npm install
npm run dev:api   # :8080, default kubeconfig
npm run dev:web   # vite, proxies /api to :8080
npm test
```
