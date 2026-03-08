# AushadX – Docker Desktop Kubernetes Deployment Guide

This guide explains how to deploy AushadX on the **kubeadm-based Kubernetes cluster built into Docker Desktop** — no Minikube required.

MongoDB runs **inside the cluster** as a StatefulSet backed by a 5 Gi PersistentVolumeClaim — no external database needed.

---

## Prerequisites

| Tool | Version | Notes |
|------|---------|-------|
| Docker Desktop | ≥ 4.28 | https://www.docker.com/products/docker-desktop — enable Kubernetes in Settings |
| kubectl | ≥ 1.28 | Bundled with Docker Desktop, or install separately |

> **Enable Kubernetes in Docker Desktop:**
> Settings → Kubernetes → ✅ Enable Kubernetes → Apply & Restart.
> Wait until the bottom-left status indicator shows "Kubernetes running".

---

## 1. Switch kubectl context to Docker Desktop

```bash
kubectl config use-context docker-desktop
```

Confirm the cluster is reachable:

```bash
kubectl cluster-info
# Kubernetes control plane is running at https://127.0.0.1:6443
```

---

## 2. Build images

Docker Desktop's Kubernetes shares the **same Docker daemon** as your desktop — images you build locally are immediately available to the cluster with `imagePullPolicy: IfNotPresent`. No registry push needed.

Run each command from the **project root** (`c:/4-1/AushadX`):

```bash
docker build -t aushadx/profile-manager:latest   ./services/profile-manager
docker build -t aushadx/medicine-analyzer:latest  ./services/medicine-analyzer
docker build -t aushadx/medicine-scheduler:latest ./services/medicine-scheduler
docker build -t aushadx/agent-service:latest      ./services/agent-service
docker build -t aushadx/api-server:latest         ./services/api-server
```

---

## 3. Create Kubernetes file-based secrets

Two secrets must be created from local JSON key files **before** applying the manifests.

### 3a. Firebase Admin Key (push notifications)

Used by `medicine-scheduler` and `medicine-scheduler-worker` for Firebase Cloud Messaging.

```bash
kubectl create secret generic firebase-admin-key \
  --from-file=service-account.json=/path/to/firebase-service-account.json \
  -n aushadx
```

### 3b. Vertex AI / GCP Service Account Key

Used by `medicine-analyzer` and `agent-service` for Google Vertex AI (Gemini).

```bash
kubectl create secret generic vertex-ai-key \
  --from-file=service-account.json=/path/to/gcp-service-account.json \
  -n aushadx
```

---

## 4. Configure secrets / environment variables

Copy the example file and fill in your values:

```bash
cp k8s/aushadx-deployment.yaml.example k8s/aushadx-deployment.yaml
```

Edit the `stringData` block in the `Secret` section:

```yaml
stringData:
  # MongoDB – pre-set to the in-cluster StatefulSet
  MONGO_URI: "mongodb://mongodb.aushadx.svc.cluster.local:27017/aushadx"

  # JWT
  JWT_SECRET:         "..."
  JWT_ACCESS_SECRET:  "..."
  JWT_REFRESH_SECRET: "..."

  # LLM provider (medicine-analyzer)
  LLM_PROVIDER: "gemini"       # or "openai"
  LLM_MODEL:    "gemini-2.5-pro"

  # Gemini / Google
  GEMINI_API_KEY: "AIza..."
  GEMINI_MODEL:   "gemini-2.5-pro"

  # Vertex AI provider switch
  GEMINI_PROVIDER: "vertexai"  # "vertexai" or "genai"
  VERTEX_PROJECT:  "your-gcp-project-id"
  VERTEX_LOCATION: "us-central1"
  GOOGLE_APPLICATION_CREDENTIALS: "/etc/gcp/service-account.json"

  # OpenAI (optional – only if LLM_PROVIDER=openai)
  OPENAI_API_KEY: "sk-..."

  # Pinecone
  PINECONE_API_KEY:    "pcsk_..."
  PINECONE_INDEX:      "medicine-knowledgebase"
  PINECONE_INDEX_HOST: "https://....svc.pinecone.io"
  PINECONE_NAMESPACE:  "medicine_kb_v1"
```

> **MongoDB** is already included as a StatefulSet with a 5 Gi PVC. Data persists across pod restarts as long as the PVC is not deleted.

---

## 5. Apply the manifests

```bash
kubectl apply -f k8s/aushadx-deployment.yaml
```

Verify all pods are running (may take ~60 s for MongoDB to become ready):

```bash
kubectl get pods -n aushadx -w
# NAME                                  READY   STATUS    RESTARTS
# mongodb-0                             1/1     Running   0
# profile-manager-xxxx                  1/1     Running   0
# medicine-analyzer-xxxx                1/1     Running   0
# medicine-scheduler-xxxx               1/1     Running   0
# medicine-scheduler-worker-xxxx        1/1     Running   0
# agent-service-xxxx                    1/1     Running   0
# api-server-xxxx                       1/1     Running   0
```

---

## 6. Connect the mobile client to the gateway

The API gateway (`api-server`) is exposed on **NodePort 30000**.

With Docker Desktop, NodePorts are **directly accessible on `localhost`** — no tunnel or IP lookup needed.

Update **`apps/mobile-client/.env`**:

```env
# Simulator / web
BASE_HOST=127.0.0.1
PORT=30000

# Android emulator (maps host loopback into the emulator)
NETWORK_HOST=10.0.2.2
```

> **Physical Android device on the same Wi-Fi:** use your machine's actual LAN IP address (e.g. `192.168.1.x`) instead of `127.0.0.1`.

---

## 7. Useful debugging commands

```bash
# Watch pod logs
kubectl logs -n aushadx -l app=api-server -f
kubectl logs -n aushadx -l app=profile-manager -f
kubectl logs -n aushadx -l app=medicine-scheduler-worker -f
kubectl logs -n aushadx -l app=medicine-analyzer -f
kubectl logs -n aushadx -l app=agent-service -f

# Describe a crashing pod
kubectl describe pod -n aushadx <pod-name>

# Check services
kubectl get svc -n aushadx

# Re-build and rolling-restart a single service
docker build -t aushadx/api-server:latest ./services/api-server
kubectl rollout restart deployment -n aushadx api-server

# Rolling-restart all deployments at once
kubectl rollout restart deployment -n aushadx

# Delete everything and start fresh
kubectl delete namespace aushadx
```

---

## 8. Kubernetes Dashboard

You can use the official Kubernetes Dashboard to visually monitor and manage pods, services, and secrets.

### Installation

1. **Deploy the dashboard:**
   ```bash
   kubectl apply -f https://raw.githubusercontent.com/kubernetes/dashboard/v2.7.0/aio/deploy/recommended.yaml
   ```

2. **Create an admin user & cluster binding:**
   ```bash
   kubectl create serviceaccount dashboard-admin -n kubernetes-dashboard
   kubectl create clusterrolebinding dashboard-admin-binding \
     --clusterrole=cluster-admin \
     --serviceaccount=kubernetes-dashboard:dashboard-admin
   ```

3. **Generate a login token:**
   ```bash
   kubectl -n kubernetes-dashboard create token dashboard-admin
   ```
   > Copy the long token string output by this command.

4. **Start the proxy:**
   ```bash
   kubectl proxy
   ```

5. **Access the dashboard:**
   Open your browser to:
   [http://localhost:8001/api/v1/namespaces/kubernetes-dashboard/services/https:kubernetes-dashboard:/proxy/](http://localhost:8001/api/v1/namespaces/kubernetes-dashboard/services/https:kubernetes-dashboard:/proxy/)
   
   Select **Token** and paste the token from step 3.

---

## Service port reference

| Service | Internal DNS | Port |
|---------|-------------|------|
| mongodb (StatefulSet) | `mongodb.aushadx.svc.cluster.local` | 27017 |
| api-server (gateway) | `api-server.aushadx.svc.cluster.local` | 3000 → NodePort **30000** → `localhost:30000` |
| profile-manager | `profile-manager.aushadx.svc.cluster.local` | 3001 |
| medicine-analyzer | `medicine-analyzer.aushadx.svc.cluster.local` | 3002 |
| medicine-scheduler | `medicine-scheduler.aushadx.svc.cluster.local` | 3003 |
| medicine-scheduler-worker | *No internal service (Daemon)* | N/A |
| agent-service | `agent-service.aushadx.svc.cluster.local` | 3004 |

Only `api-server` is reachable from outside the cluster. All other services communicate internally via Kubernetes DNS.

### Inspecting MongoDB

```bash
# Open a mongosh shell inside the running pod
kubectl exec -it -n aushadx mongodb-0 -- mongosh aushadx

# Watch MongoDB logs
kubectl logs -n aushadx mongodb-0 -f

# Delete PVC (⚠ destroys all data permanently)
kubectl delete pvc -n aushadx mongodb-pvc
```
