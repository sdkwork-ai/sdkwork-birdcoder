# Tools Directory

## Purpose
Developer, validation, generation, migration, and operator tools that are not shipped as app runtime code.

## Owner
SDKWork Birdcoder team.

## Allowed Content
- Validation tools
- Code generators
- Migration utilities
- Operator CLIs
- Development helpers
- Build tools
- Analysis utilities

## Forbidden Content
- App runtime code
- Generated SDK transport output
- Runtime secrets or credentials
- Temporary build artifacts
- Reusable logic that belongs in proper packages/crates

## Related Specs
- [ENGINEERING_WORKFLOW_SPEC.md](../sdkwork-specs/ENGINEERING_WORKFLOW_SPEC.md)
- [CODE_STYLE_SPEC.md](../sdkwork-specs/CODE_STYLE_SPEC.md)
- [TEST_SPEC.md](../sdkwork-specs/TEST_SPEC.md)

## Verification
- [ ] Tools are deterministic, documented, and safe to run
- [ ] Tools do not contain secrets or credentials
- [ ] Tools follow SDKWork code style standards
- [ ] Tools have proper documentation and usage examples

## Notes
Scripts/ contains thin command entrypoints. Reusable logic, parsers, generators, validators, CLIs, and operator utilities belong in tools/ or in a proper package/crate.
