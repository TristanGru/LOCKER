# LOCKER — Updating Images After Code Changes

Every code change ships as a new image under a new version number, built and deployed with one command: `release.ps1 <version>`.

- **One rule:** never reuse a version. A reused tag can leave the cluster running the cached old image.
- The version lives in two places, kept in sync by `release.ps1`: the `--set VERSION=` value and the image tag in `k8s/app.yaml`.
- You never run `docker build` by hand for a release. `zarf package create` builds the image from the Dockerfile.

## Update steps

Run from the repo root in PowerShell. Docker Desktop and the local cluster must be running.

1. Get the changes: `git pull`, or save your local edits.
2. Pick the next version. Check the current tag:
   ```powershell
   Select-String 'zarf.internal/locker' k8s\app.yaml
   ```
   and add one (0.1.0 → 0.1.1).
3. Build, package and deploy:
   ```powershell
   powershell -ExecutionPolicy Bypass -File .\release.ps1 0.1.1
   ```
4. Confirm the new pod is healthy: `kubectl -n locker get pods` should show `1/1 Running` with a young AGE.
5. Open the app:
   ```powershell
   kubectl -n locker port-forward service/locker 8080:8000
   ```
   then go to http://127.0.0.1:8080.
6. Commit the version bump so teammates start from the same number:
   ```powershell
   git add k8s/app.yaml
   git commit -m "Release 0.1.1"
   git push
   ```

## What release.ps1 does

The script first checks the cluster and stops if that version is already deployed. It then runs four steps. Run them by hand if the script is unavailable or blocked.

1. Rewrites the image tag in `k8s/app.yaml` to `zarf.internal/locker:<version>`.
2. Builds the image and creates the package. This runs `docker build` and `docker save` from the actions in `zarf.yaml`, then writes `zarf-package-locker-amd64-<version>.tar.zst`:
   ```powershell
   zarf package create . --set VERSION=<version> -a amd64 --confirm
   ```
3. Deploys the package. This pushes the image to the cluster's Zarf registry and upgrades the deployment, waiting until it is Available:
   ```powershell
   zarf package deploy .\zarf-package-locker-amd64-<version>.tar.zst --confirm
   ```
4. Prints the result: `kubectl -n locker get pods`.

For quick testing without the cluster, skip all of this:

```powershell
docker build -t locker-dev .
docker run --rm -p 127.0.0.1:8080:8000 locker-dev
```

## Shipping the update to another environment

The new `.tar.zst` file is the whole update. Nothing else needs rebuilding on the target. To build the file without deploying it or needing a cluster, add `-PackageOnly` to the `release.ps1` command.

1. Copy `zarf-package-locker-amd64-<version>.tar.zst` to the target, plus `zarf.exe` if it isn't there.
2. On the target, check that `kubectl config current-context` points at the right cluster.
3. Deploy:
   ```powershell
   zarf package deploy .\zarf-package-locker-amd64-<version>.tar.zst --confirm
   ```

The target was already initialized for the first release, so no `zarf init` is needed. If the Zarf CLI version changes between releases, bring the matching init package and check with the cluster operator before re-initializing.

## Rollback and cleanup

To roll back, redeploy the previous package file. Keep at least the last two package files for this.

```powershell
zarf package deploy .\zarf-package-locker-amd64-0.1.0.tar.zst --confirm
```

- Remove the app: `zarf package remove locker --confirm`
- Free disk space from old images: `docker image prune`
- Delete old package and image files: remove outdated `zarf-package-locker-*.tar.zst` and `locker-image.tar` from the repo folder. Keep them out of git via `.gitignore`.

## Troubleshooting

| Symptom | Fix |
| --- | --- |
| App still shows old behavior | The version was reused. Release again with a new number. |
| `git pull` conflicts on `k8s/app.yaml` | The script edited the tag. Commit it (step 6) or run `git checkout k8s/app.yaml`, then pull. |
| Build fails with `Access is denied` on a path | Add that folder to `.dockerignore`. |
| Deploy hangs on "Performing Helm install" | In another window, run `kubectl -n locker get pods` and `kubectl -n locker get events --sort-by=.lastTimestamp`. |
| Pod in `CrashLoopBackOff` | Run `kubectl -n locker logs -l app=locker --tail=50`. It's usually a code or dependency error from the change. |
| Script won't run (execution policy) | Use the `powershell -ExecutionPolicy Bypass -File` form from step 3. |
| Port 8080 already in use | Run `docker ps`, then `docker stop <name>`, or forward to another port such as `8090:8000`. |