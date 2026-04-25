# AushadX — GKE Deployment Transition Guide

> **Scope**: Migrating AushadX from a local Minikube deployment to Google Kubernetes Engine (GKE)
> using Artifact Registry for images and Workload Identity for keyless GCP authentication.

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Prerequisites](#2-prerequisites)
3. [Phase 1 — Create GKE Cluster](#3-phase-1--create-gke-cluster)
4. [Phase 2 — Push Images to Artifact Registry](#4-phase-2--push-images-to-artifact-registry)
5. [Phase 3 — Workload Identity for Vertex AI](#5-phase-3--workload-identity-for-vertex-ai)
6. [Phase 4 — Workload Identity for Firebase](#6-phase-4--workload-identity-for-firebase)
7. [Phase 5 — Namespace & Secrets](#7-phase-5--namespace--secrets)
8. [Phase 6 — Manifest Changes](#8-phase-6--manifest-changes)
9. [Phase 7 — Apply & Verify](#9-phase-7--apply--verify)
10. [What Changed vs. Minikube](#10-what-changed-vs-minikube)
11. [Troubleshooting](#11-troubleshooting)

---

## 1. Architecture Overview

### Before (Minikube)
```
Local Docker images (aushadx/*)
  └── NodePort 30000 for external access
  └── JSON key files mounted as Kubernetes Secrets
       ├── vertex-ai-key  → /etc/gcp/service-account.json
       └── firebase-admin-key → /etc/firebase/service-account.json
```

### After (GKE)
```
Artifact Registry images (us-central1-docker.pkg.dev/PROJECT/aushadx/*)
  └── LoadBalancer Service for external access (auto-provisioned GCP LB)
  └── Workload Identity (keyless auth — no JSON keys)
       ├── aushadx-agent K8s SA  → aushadx-vertex@GKE_PROJECT GCP SA  (Vertex AI)
       └── aushadx-firebase-sa K8s SA → aushadx-firebase@FIREBASE_PROJECT GCP SA (Firebase)
```

### Project Variables

| Variable | Description |
|---|---|
| `YOUR_GKE_PROJECT_ID` | GCP project hosting the GKE cluster and Vertex AI |
| `YOUR_FIREBASE_PROJECT_ID` | GCP project hosting Firebase (may differ from GKE project) |

> ⚠️ **Cross-project note**: If Firebase and GKE live in the **same** project, use the same
> project ID for both variables throughout this guide.

---

## 2. Prerequisites

- `gcloud` CLI installed and authenticated (`gcloud auth login`)
- `kubectl` installed and configured
- Docker installed and running
- GKE, Artifact Registry, and IAM APIs enabled on `YOUR_GKE_PROJECT_ID`
- Firebase Admin SDK API enabled on `YOUR_FIREBASE_PROJECT_ID`
- Billing enabled on both projects

```bash
# Enable required APIs
gcloud services enable container.googleapis.com \
  artifactregistry.googleapis.com \
  iam.googleapis.com \
  iamcredentials.googleapis.com \
  --project=YOUR_GKE_PROJECT_ID
```

---

## 3. Phase 1 — Create GKE Cluster

```bash
gcloud container clusters create aushadx \
  --region=us-central1 \
  --machine-type=e2-standard-2 \
  --num-nodes=2 \
  --workload-pool=YOUR_GKE_PROJECT_ID.svc.id.goog \
  --enable-ip-alias

gcloud container clusters get-credentials aushadx --region=us-central1
```

### Key flags explained

| Flag | Purpose |
|---|---|
| `--workload-pool` | Enables Workload Identity on the cluster (required for keyless auth) |
| `--enable-ip-alias` | Required for VPC-native networking and GKE's network policies |
| `--region` | Multi-zone regional cluster for higher availability |

---

## 4. Phase 2 — Push Images to Artifact Registry

### 4.1 Create the Repository

```bash
gcloud artifacts repositories create aushadx \
  --repository-format=docker \
  --location=us-central1 \
  --project=YOUR_GKE_PROJECT_ID
```

### 4.2 Authenticate Docker

```bash
gcloud auth configure-docker us-central1-docker.pkg.dev
```

### 4.3 Build & Push All Services

```bash
REGISTRY=us-central1-docker.pkg.dev/YOUR_GKE_PROJECT_ID/aushadx

# Build
docker build -t $REGISTRY/profile-manager:latest   ./services/profile-manager
docker build -t $REGISTRY/medicine-analyzer:latest  ./services/medicine-analyzer
docker build -t $REGISTRY/medicine-scheduler:latest ./services/medicine-scheduler
docker build -t $REGISTRY/agent-service:latest      ./services/agent-service
docker build -t $REGISTRY/api-server:latest         ./services/api-server

# Push
docker push $REGISTRY/profile-manager:latest
docker push $REGISTRY/medicine-analyzer:latest
docker push $REGISTRY/medicine-scheduler:latest
docker push $REGISTRY/agent-service:latest
docker push $REGISTRY/api-server:latest
```

> **Tip**: For CI/CD pipelines, add `--platform linux/amd64` to each `docker build` command
> if building on an Apple Silicon Mac.

---

## 5. Phase 3 — Workload Identity for Vertex AI

Allows `agent-service` and `medicine-analyzer` to call Vertex AI **without** a JSON key file.

```bash
# 1. Create GCP Service Account in the GKE project
gcloud iam service-accounts create aushadx-vertex \
  --project=YOUR_GKE_PROJECT_ID

# 2. Grant Vertex AI user role
gcloud projects add-iam-policy-binding YOUR_GKE_PROJECT_ID \
  --member="serviceAccount:aushadx-vertex@YOUR_GKE_PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/aiplatform.user"

# 3. Allow the Kubernetes SA to impersonate the GCP SA
gcloud iam service-accounts add-iam-policy-binding \
  aushadx-vertex@YOUR_GKE_PROJECT_ID.iam.gserviceaccount.com \
  --project=YOUR_GKE_PROJECT_ID \
  --role="roles/iam.workloadIdentityUser" \
  --member="serviceAccount:YOUR_GKE_PROJECT_ID.svc.id.goog[aushadx/aushadx-agent]"
```

### How Workload Identity works

```
Pod (serviceAccountName: aushadx-agent)
  │
  └── GKE metadata server intercepts GOOGLE_APPLICATION_CREDENTIALS requests
        │
        └── Impersonates aushadx-vertex@YOUR_GKE_PROJECT_ID GCP SA
              │
              └── Returns short-lived access token for Vertex AI
```

No JSON key file is mounted. The token is refreshed automatically.

---

## 6. Phase 4 — Workload Identity for Firebase

Allows `medicine-scheduler` and `medicine-scheduler-worker` to call Firebase Admin SDK
**without** a JSON key file. Firebase may live in a different GCP project.

```bash
# 1. Create GCP Service Account in the Firebase project
gcloud iam service-accounts create aushadx-firebase \
  --project=YOUR_FIREBASE_PROJECT_ID

# 2. Grant Firebase Admin role
gcloud projects add-iam-policy-binding YOUR_FIREBASE_PROJECT_ID \
  --member="serviceAccount:aushadx-firebase@YOUR_FIREBASE_PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/firebase.admin"

# 3. Allow the GKE workload pool to impersonate the Firebase SA
#    (cross-project: uses YOUR_GKE_PROJECT_ID workload pool,
#     binding lives on YOUR_FIREBASE_PROJECT_ID's SA)
gcloud iam service-accounts add-iam-policy-binding \
  aushadx-firebase@YOUR_FIREBASE_PROJECT_ID.iam.gserviceaccount.com \
  --project=YOUR_FIREBASE_PROJECT_ID \
  --role="roles/iam.workloadIdentityUser" \
  --member="serviceAccount:YOUR_GKE_PROJECT_ID.svc.id.goog[aushadx/aushadx-firebase-sa]"
```

> ⚠️ The `--member` string always uses the **GKE project's** workload pool, even when
> the Firebase SA lives in a different project. This is intentional.

---

## 7. Phase 5 — Namespace & Secrets

```bash
kubectl create namespace aushadx
```

### Create aushadx-secrets

```bash
kubectl create secret generic aushadx-secrets \
  --from-literal=MONGO_URI="mongodb://mongodb.aushadx.svc.cluster.local:27017/aushadx" \
  --from-literal=JWT_SECRET="<strong-random-value>" \
  --from-literal=JWT_ACCESS_SECRET="<strong-random-value>" \
  --from-literal=JWT_REFRESH_SECRET="<strong-random-value>" \
  --from-literal=LLM_PROVIDER="gemini" \
  --from-literal=LLM_MODEL="gemini-2.5-pro" \
  --from-literal=GEMINI_API_KEY="<your-gemini-api-key>" \
  --from-literal=GEMINI_MODEL="gemini-2.5-flash" \
  --from-literal=GEMINI_PROVIDER="vertexai" \
  --from-literal=VERTEX_PROJECT="YOUR_GKE_PROJECT_ID" \
  --from-literal=VERTEX_LOCATION="us-central1" \
  --from-literal=OPENAI_API_KEY="<your-openai-key>" \
  --from-literal=PINECONE_API_KEY="<your-pinecone-key>" \
  --from-literal=PINECONE_INDEX="medicine-knowledgebase" \
  --from-literal=PINECONE_INDEX_HOST="<your-pinecone-host>" \
  --from-literal=PINECONE_NAMESPACE="medicine_kb_v1" \
  -n aushadx
```

> ✅ **No** `vertex-ai-key` or `firebase-admin-key` secrets needed.
> Workload Identity replaces both JSON key files entirely.

---

## 8. Phase 6 — Manifest Changes

Below is a complete diff of every change required to `k8s/aushadx-deployment.yaml`
before applying to GKE.

---

### 8.1 File Header Comment

```diff
-# AushadX – Kubernetes Manifests for Minikube
+# AushadX – Kubernetes Manifests for GKE
```

---

### 8.2 aushadx-agent ServiceAccount — Add Workload Identity Annotation

```diff
 apiVersion: v1
 kind: ServiceAccount
 metadata:
   name: aushadx-agent
   namespace: aushadx
+  annotations:
+    iam.gke.io/gcp-service-account: aushadx-vertex@YOUR_GKE_PROJECT_ID.iam.gserviceaccount.com
```

---

### 8.3 Add New aushadx-firebase-sa ServiceAccount

Insert after the `aushadx-agent` ServiceAccount block:

```yaml
---
# ─── Service Account (medicine-scheduler Firebase) ───────────
apiVersion: v1
kind: ServiceAccount
metadata:
  name: aushadx-firebase-sa
  namespace: aushadx
  annotations:
    iam.gke.io/gcp-service-account: aushadx-firebase@YOUR_FIREBASE_PROJECT_ID.iam.gserviceaccount.com
```

---

### 8.4 MongoDB PVC — Add storageClassName

GKE requires an explicit StorageClass (Minikube uses a default that doesn't apply on GKE).

```diff
 spec:
+  storageClassName: standard-rwo
   accessModes:
     - ReadWriteOnce
   resources:
     requests:
       storage: 5Gi
```

---

### 8.5 All 5 Deployments — Image Names & Pull Policy

Apply these two changes to **every** Deployment (`profile-manager`, `medicine-analyzer`,
`medicine-scheduler`, `medicine-scheduler-worker`, `agent-service`, `api-server`):

```diff
-          image: aushadx/<service-name>:latest
+          image: us-central1-docker.pkg.dev/YOUR_GKE_PROJECT_ID/aushadx/<service-name>:latest

-          imagePullPolicy: IfNotPresent
+          imagePullPolicy: Always
```

`Always` ensures GKE always pulls the latest digest from Artifact Registry rather than
using a potentially stale cached image on the node.

---

### 8.6 medicine-analyzer — Remove Vertex AI Key Volume & Env Var

```diff
             - name: VERTEX_LOCATION
               valueFrom:
                 secretKeyRef:
                   name: aushadx-secrets
                   key: VERTEX_LOCATION
-            - name: GOOGLE_APPLICATION_CREDENTIALS
-              valueFrom:
-                secretKeyRef:
-                  name: aushadx-secrets
-                  key: GOOGLE_APPLICATION_CREDENTIALS
-          volumeMounts:
-            - name: vertex-ai-key-volume
-              mountPath: /etc/gcp
-              readOnly: true
-      volumes:
-        - name: vertex-ai-key-volume
-          secret:
-            secretName: vertex-ai-key
```

---

### 8.7 medicine-scheduler — Add Firebase SA, Remove Firebase Key Volume

```diff
     spec:
+      serviceAccountName: aushadx-firebase-sa
       containers:
         - name: medicine-scheduler
           image: ...
           env:
             - name: MONGO_URI
               ...
-            - name: GOOGLE_APPLICATION_CREDENTIALS
-              value: "/etc/firebase/service-account.json"
-          volumeMounts:
-            - name: firebase-key-volume
-              mountPath: /etc/firebase
-              readOnly: true
-      volumes:
-        - name: firebase-key-volume
-          secret:
-            secretName: firebase-admin-key
```

---

### 8.8 medicine-scheduler-worker — Add Firebase SA, Remove Firebase Key Volume

```diff
     spec:
+      serviceAccountName: aushadx-firebase-sa
       containers:
         - name: medicine-scheduler-worker
           image: ...
           env:
             - name: MONGO_URI
               ...
-            - name: GOOGLE_APPLICATION_CREDENTIALS
-              value: "/etc/firebase/service-account.json"
-          volumeMounts:
-            - name: firebase-key-volume
-              mountPath: /etc/firebase
-              readOnly: true
-      volumes:
-        - name: firebase-key-volume
-          secret:
-            secretName: firebase-admin-key
```

---

### 8.9 agent-service — Remove Vertex AI Key Volume & Env Var

```diff
             - name: VERTEX_LOCATION
               valueFrom:
                 secretKeyRef:
                   name: aushadx-secrets
                   key: VERTEX_LOCATION
-            - name: GOOGLE_APPLICATION_CREDENTIALS
-              valueFrom:
-                secretKeyRef:
-                  name: aushadx-secrets
-                  key: GOOGLE_APPLICATION_CREDENTIALS
-          volumeMounts:
-            - name: vertex-ai-key-volume
-              mountPath: /etc/gcp
-              readOnly: true
-      volumes:
-        - name: vertex-ai-key-volume
-          secret:
-            secretName: vertex-ai-key
```

---

### 8.10 api-server Service — NodePort → LoadBalancer

```diff
 spec:
-  type: NodePort
+  type: LoadBalancer
   selector:
     app: api-server
   ports:
-    - port: 3000
-      targetPort: 3000
-      nodePort: 30000
+    - port: 80
+      targetPort: 3000
```

The GCP Load Balancer will be provisioned automatically. Your mobile app hits port **80**
on the external IP instead of `$(minikube ip):30000`.

---

### 8.11 Secrets Block — Remove from YAML (use kubectl instead)

The `aushadx-secrets` Secret block in the YAML contains plaintext credentials and **must
not** be stored in the manifest file for production. Remove it entirely and manage it
exclusively via `kubectl create secret` (Phase 5 above).

Similarly, remove `GOOGLE_APPLICATION_CREDENTIALS` from the `stringData` block since it
is no longer needed (Workload Identity handles credential injection automatically).

---

## 9. Phase 7 — Apply & Verify

### 9.1 Apply the Manifests

```bash
kubectl apply -f k8s/aushadx-deployment.yaml
```

### 9.2 Watch Pod Startup

```bash
kubectl get pods -n aushadx -w
```

Expected steady state (all pods `Running`):

```
NAME                                        READY   STATUS    RESTARTS   AGE
agent-service-xxxxxxxxx-xxxxx               1/1     Running   0          2m
api-server-xxxxxxxxx-xxxxx                  1/1     Running   0          2m
medicine-analyzer-xxxxxxxxx-xxxxx           1/1     Running   0          2m
medicine-scheduler-xxxxxxxxx-xxxxx          1/1     Running   0          2m
medicine-scheduler-worker-xxxxxxxxx-xxxxx   1/1     Running   0          2m
mongodb-0                                   1/1     Running   0          2m
profile-manager-xxxxxxxxx-xxxxx             1/1     Running   0          2m
```

### 9.3 Get External IP

```bash
kubectl get svc -n aushadx api-server
```

GCP takes ~2 minutes to provision the Load Balancer. The `EXTERNAL-IP` column starts as
`<pending>` and resolves to a public IP. Update your mobile app's base URL to:

```
http://<EXTERNAL-IP>/
```

### 9.4 Verify Workload Identity

Run this against any pod using a WI-annotated service account:

```bash
# Vertex AI (agent-service or medicine-analyzer)
kubectl exec -n aushadx <agent-service-pod-name> -- \
  curl -s "http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/email" \
  -H "Metadata-Flavor: Google"
```

Expected output:
```
aushadx-vertex@YOUR_GKE_PROJECT_ID.iam.gserviceaccount.com
```

```bash
# Firebase (medicine-scheduler-worker)
kubectl exec -n aushadx <scheduler-worker-pod-name> -- \
  curl -s "http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/email" \
  -H "Metadata-Flavor: Google"
```

Expected output:
```
aushadx-firebase@YOUR_FIREBASE_PROJECT_ID.iam.gserviceaccount.com
```

If either command returns the correct SA email, Workload Identity is working correctly.

---

## 10. What Changed vs. Minikube

| Area | Minikube | GKE |
|---|---|---|
| **Image source** | Local Docker daemon (`aushadx/*`) | Artifact Registry (`us-central1-docker.pkg.dev/PROJECT/aushadx/*`) |
| **imagePullPolicy** | `IfNotPresent` | `Always` |
| **External access** | NodePort `30000` on `$(minikube ip)` | LoadBalancer on port `80` (GCP-provisioned IP) |
| **Vertex AI auth** | JSON key file mounted via `vertex-ai-key` Secret | Workload Identity (`aushadx-agent` K8s SA → `aushadx-vertex` GCP SA) |
| **Firebase auth** | JSON key file mounted via `firebase-admin-key` Secret | Workload Identity (`aushadx-firebase-sa` K8s SA → `aushadx-firebase` GCP SA) |
| **Secrets in YAML** | Inline `stringData` (dev only) | Managed externally via `kubectl create secret` |
| **MongoDB PVC** | Default StorageClass (Minikube standard) | `standard-rwo` StorageClass (GKE managed disk) |
| **`GOOGLE_APPLICATION_CREDENTIALS` env var** | Required (path to mounted JSON key) | Not set — ADC auto-detects via metadata server |
| **K8s Service Accounts** | `aushadx-agent` (no annotation) | `aushadx-agent` + `aushadx-firebase-sa` (both WI-annotated) |

---

## 11. Troubleshooting

### Pod stuck in `ImagePullBackOff`
- Verify the image was pushed: `gcloud artifacts docker images list us-central1-docker.pkg.dev/YOUR_GKE_PROJECT_ID/aushadx`
- Verify the node has access: GKE nodes get Artifact Registry pull permissions automatically within the same project

### Workload Identity returns wrong email / `403`
- Confirm the IAM binding was created: `gcloud iam service-accounts get-iam-policy aushadx-vertex@YOUR_GKE_PROJECT_ID.iam.gserviceaccount.com`
- Check the pod's SA annotation: `kubectl describe sa aushadx-agent -n aushadx`
- Ensure the cluster was created with `--workload-pool` (check: `gcloud container clusters describe aushadx --region=us-central1 | grep workloadPool`)

### LoadBalancer stuck in `<pending>`
- Check GCP quotas (external IP addresses): Console → IAM & Admin → Quotas
- Verify billing is enabled on the project

### MongoDB PVC stuck in `Pending`
- Confirm `standard-rwo` StorageClass exists: `kubectl get storageclass`
- GKE standard clusters include `standard-rwo` by default; Autopilot clusters may differ

### Firebase SDK `permission-denied` errors
- Confirm `roles/firebase.admin` is bound to `aushadx-firebase@YOUR_FIREBASE_PROJECT_ID`
- Confirm the cross-project WI binding uses the correct `--member` format:
  `serviceAccount:YOUR_GKE_PROJECT_ID.svc.id.goog[aushadx/aushadx-firebase-sa]`

---

*Last updated: 2026-04-25 | AushadX GKE Transition v1.0*
