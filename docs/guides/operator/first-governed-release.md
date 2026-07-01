# First Governed Release (Pre-Launch → Publish)

Updated: 2026-06-30  
Status: active operator checklist  
Specs: `RELEASE_SPEC.md`, `TECH-09-installation-deployment-releasestandard.md`

BirdCoder remains **pre-launch** (`publish.status: DRAFT`, `metadata.preLaunch: true`) across **four governed manifests**: root `sdkwork.app.config.json` plus surface manifests under `apps/sdkwork-birdcoder-{pc,h5,flutter-mobile}/`. Install packages stay **disabled** until this checklist completes with **real** build artifacts — not synthetic rehearsal fixtures.

## 1. Rehearsal gates (must be green before real packaging)

These prove the release pipeline shape without claiming production artifacts:

```bash
pnpm lint
pnpm check:arch
pnpm check:server
pnpm release:plan
pnpm release:fixture:ready
pnpm release:candidate:dry-run
pnpm release:rehearsal:verify   # expect status "blocked" until artifacts/release/ is populated
```

CI runs `release:fixture:ready` and `release:candidate:dry-run` and uploads `release-candidate-dry-run-evidence`.

## 2. Real artifact build sequence

Follow the `rehearsalPlan` embedded in `artifacts/release-candidate-dry-run/release-candidate-dry-run-report.json`:

```bash
pnpm release:plan
pnpm release:preflight:desktop-signing
pnpm release:package:desktop
pnpm release:package:server
pnpm release:package:container
pnpm release:package:kubernetes
pnpm release:package:web
pnpm release:verify-trust:desktop
pnpm release:smoke:desktop
pnpm release:smoke:desktop-packaged-launch
pnpm release:smoke:server
pnpm release:smoke:container
pnpm release:smoke:kubernetes
pnpm release:smoke:web
pnpm release:finalize
pnpm release:smoke:finalized
pnpm release:write-attestation-evidence -- --repository <owner/repo> --release-tag <tag>
pnpm release:assert-ready
```

Outputs land under `artifacts/release/` with `release-manifest.json`, `SHA256SUMS.txt`, and `release-attestations.json`.

## 3. Manifest promotion rules

Only after `pnpm release:assert-ready` passes against **real** `artifacts/release/`:

1. Copy checksums from `SHA256SUMS.txt` into each enabled install package entry across root and surface manifests (no placeholders).
2. Set `enabled: true` per package that has a verified artifact URL.
3. Set `publish.status` to the governed publish state approved by release owners on **all four manifests** (root + PC + H5 + Flutter).
4. Set `metadata.preLaunch` and `publish.preLaunch` to `false` on all four manifests.
5. Update `metadata.releaseEvidenceStatus` to reference the release tag and attestation paths.
6. Run `node scripts/app-manifest-pre-launch-contract.test.mjs` — it must be updated or replaced with a post-launch contract before packages can stay enabled.

**Never** enable packages with synthetic fixture checksums from `artifacts/release-readiness-fixture/` or `artifacts/release-candidate-dry-run/`.

## 4. Security evidence

When `security.checksumRequired`, `security.signatureRequired`, and `security.sbomRequired` are true in `sdkwork.app.config.json`:

- Desktop installers: signing + trust smoke (`release:verify-trust:desktop`)
- Server/container/k8s: manifest checksums + attestation evidence
- SBOM: attach to release attestation bundle per `RELEASE_SPEC.md`

## 5. Post-publish verification

```bash
pnpm release:smoke:finalized
pnpm check:governance-regression
pnpm release:smoke:postgresql-live   # when PostgreSQL is production engine
```

## 6. Rollback

Use `rollbackRunbookRef` on the release manifest and redeploy the previous Helm/Docker tag with known-good checksums.
