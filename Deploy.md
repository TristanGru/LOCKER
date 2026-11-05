# Running LOCKER

Two options:
- **Option A (Docker only):** fastest way to try the app. Only needs Docker.
- **Option B (Zarf + Kubernetes):** runs it the way it ships, as an offline Zarf package.

All commands are PowerShell, run from the repo root.

---

## 0. Get the code

```powershell
git clone <REPO_URL>
cd LOCKER
```

Requires **Docker Desktop** (Linux containers, Engine 25+), running.

---

## Option A: Docker only

```powershell
docker build -t locker-dev .
docker run --rm -p 127.0.0.1:8080:8000 locker-dev
```

Open http://127.0.0.1:8080. Press Ctrl+C to stop.

---

## Option B: Zarf + Kubernetes

### 1. Install tools (one time)

`kubectl` comes with Docker Desktop. Install Zarf and k3d into `%USERPROFILE%\bin`:

```powershell
$bin = "$env:USERPROFILE\bin"
New-Item -ItemType Directory -Force $bin | Out-Null
$ZarfVersion = (Invoke-RestMethod https://api.github.com/repos/zarf-dev/zarf/releases/latest).tag_name
Invoke-WebRequest "https://github.com/zarf-dev/zarf/releases/download/$ZarfVersion/zarf_$($ZarfVersion)_Windows_amd64.exe" -OutFile "$bin\zarf.exe"
Invoke-WebRequest "https://github.com/k3d-io/k3d/releases/latest/download/k3d-windows-amd64.exe" -OutFile "$bin\k3d.exe"
```

Add `%USERPROFILE%\bin` to your user PATH (run `rundll32 sysdm.cpl,EditEnvironmentVariables`, edit **Path**, add the folder), then open a new PowerShell window and check:

```powershell
docker version; kubectl version --client; zarf version; k3d version
```

### 2. Create a local cluster and initialize Zarf (one time)

```powershell
k3d cluster create locker --api-port 127.0.0.1:6550
kubectl get nodes                 # wait for Ready
zarf init --confirm
kubectl -n zarf get pods          # wait until all are Running 1/1
```

### 3. Build and deploy

```powershell
powershell -ExecutionPolicy Bypass -File .\release.ps1 0.1.0
```

This builds the image, creates `zarf-package-locker-amd64-0.1.0.tar.zst`, and deploys it.

### 4. Open the app

```powershell
kubectl -n locker port-forward service/locker 8080:8000
```

Open http://127.0.0.1:8080.

---

## Updating after code changes

```powershell
git pull
powershell -ExecutionPolicy Bypass -File .\release.ps1 0.1.1   # new version number every time
```

## Cleanup

```powershell
zarf package remove locker --confirm   # remove the app
k3d cluster delete locker              # remove the whole cluster
```

## Troubleshooting

| Problem | Fix |
|---|---|
| `zarf`/`k3d` not recognized | `%USERPROFILE%\bin` isn't on PATH, or the terminal wasn't reopened |
| `failed to read dockerfile` | You're not in the repo root |
| `port is already allocated` / `Only one usage of each socket address` | Something already uses that port. Pick another (e.g. `8090:8000`) or stop it (`docker ps`, `docker stop <name>`) |
| `kubectl` times out on `host.docker.internal` | Recreate the cluster with `--api-port 127.0.0.1:6550` (step 2) |
| Deploy hangs on "Performing Helm install" | In another window: `kubectl -n locker get pods`, `kubectl -n locker get events --sort-by=.lastTimestamp`, `kubectl -n locker logs -l app=locker` |
| `Access is denied` during build | Add the named folder to `.dockerignore` |