# Apps Directory

## Purpose
Independently runnable application roots, application surfaces, app shells, demos promoted to runnable apps, or deployable application compositions.

## Owner
SDKWork Birdcoder team.

## Allowed Content
- Application surface roots (e.g., sdkwork-birdcoder-pc/)
- Application shell configurations
- Demo applications
- Deployable application compositions
- Application-specific README.md files

## Forbidden Content
- Unrelated library packages
- Generated SDK output
- Runtime secrets or credentials
- Temporary build artifacts

## Related Specs
- [APPLICATION_SPEC.md](../sdkwork-specs/APPLICATION_SPEC.md)
- [APP_PC_ARCHITECTURE_SPEC.md](../sdkwork-specs/APP_PC_ARCHITECTURE_SPEC.md)
- [APP_MANIFEST_SPEC.md](../sdkwork-specs/APP_MANIFEST_SPEC.md)
- [COMPONENT_SPEC.md](../sdkwork-specs/COMPONENT_SPEC.md)

## Verification
- [ ] Each app surface has its own sdkwork.app.config.json
- [ ] App surfaces follow the appropriate architecture spec
- [ ] App surfaces have proper .sdkwork/ directories when independently built

## Notes
The repository root is the primary application surface for sdkwork-birdcoder. Secondary app surfaces, shells, or demos should be listed here.
