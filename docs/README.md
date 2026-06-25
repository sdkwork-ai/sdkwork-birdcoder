# SDKWork Birdcoder Documentation

This directory contains repository-level documentation, architecture decisions, runbooks, design notes, changelogs, and user/developer guides.

## Purpose

Shared documentation across all application surfaces (PC, H5, Flutter).

## Canon Documents

| Document | Path |
| --- | --- |
| Product PRD | [product/prd/PRD.md](product/prd/PRD.md) |
| Technical architecture | [architecture/tech/TECH_ARCHITECTURE.md](architecture/tech/TECH_ARCHITECTURE.md) |
| Commercial readiness (current) | [architecture/tech/TECH-2026-06-24-commercial-readiness-alignment.md](architecture/tech/TECH-2026-06-24-commercial-readiness-alignment.md) |

## Operator and production guides

| Guide | Path |
| --- | --- |
| Operator index | [guides/operator/README.md](guides/operator/README.md) |
| Deployment | [guides/operator/deployment-operations.md](guides/operator/deployment-operations.md) |
| Backup and restore | [guides/operator/backup-restore.md](guides/operator/backup-restore.md) |
| Monitoring | [guides/operator/monitoring.md](guides/operator/monitoring.md) |
| Incident response | [guides/operator/incident-response.md](guides/operator/incident-response.md) |

## Related Specs

- `../sdkwork-specs/DOCUMENTATION_SPEC.md`
- `../sdkwork-specs/DEPLOYMENT_SPEC.md`
- `../sdkwork-specs/OBSERVABILITY_SPEC.md`

## Verification

- `pnpm check:live-docs-governance-baseline`
- `node scripts/commercial-readiness-truth-contract.test.mjs`
