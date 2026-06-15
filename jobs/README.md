# Jobs Directory

## Purpose
Job definitions, schedules, queue bindings, batch descriptors, maintenance runbooks, and non-Rust job packages.

## Owner
SDKWork Birdcoder team.

## Allowed Content
- Job schedule definitions
- Queue consumer bindings
- Batch job descriptors
- Maintenance runbooks
- Non-Rust job packages
- Job configuration files

## Forbidden Content
- Rust worker implementations (belongs in crates/sdkwork-<domain>-<capability>-worker/)
- Runtime secrets or credentials
- Temporary build artifacts
- Generated SDK output

## Related Specs
- [ENGINEERING_WORKFLOW_SPEC.md](../sdkwork-specs/ENGINEERING_WORKFLOW_SPEC.md)
- [DEPLOYMENT_SPEC.md](../sdkwork-specs/DEPLOYMENT_SPEC.md)
- [OBSERVABILITY_SPEC.md](../sdkwork-specs/OBSERVABILITY_SPEC.md)

## Verification
- [ ] Job definitions are properly documented
- [ ] No Rust worker implementation duplication
- [ ] Maintenance runbooks are complete and accurate
- [ ] Job configurations follow security best practices

## Notes
Rust worker implementations belong in crates/sdkwork-<domain>-<capability>-worker/. Jobs may reference those crates but must not duplicate their implementation.
