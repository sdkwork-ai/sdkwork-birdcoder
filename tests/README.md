# Tests Directory

## Purpose
Cross-package tests, contract tests, integration tests, end-to-end tests, fixtures, and static verification inputs.

## Owner
SDKWork Birdcoder team.

## Allowed Content
- Cross-package tests
- Contract tests
- Integration tests
- End-to-end tests
- Test fixtures
- Static verification inputs
- Test documentation
- Test utilities

## Forbidden Content
- Package-local unit tests (should be beside the package they verify)
- Real secrets, tokens, or private customer data
- Runtime state
- Temporary build artifacts
- Generated SDK output

## Related Specs
- [TEST_SPEC.md](../sdkwork-specs/TEST_SPEC.md)
- [CODE_STYLE_SPEC.md](../sdkwork-specs/CODE_STYLE_SPEC.md)
- [QUALITY_GATE_SPEC.md](../sdkwork-specs/QUALITY_GATE_SPEC.md)

## Verification
- [ ] No secrets or private data in test fixtures
- [ ] Tests are properly documented
- [ ] Contract tests cover all API surfaces
- [ ] Integration tests verify cross-package behavior
- [ ] End-to-end tests cover critical user workflows

## Notes
Root tests/ stores cross-package, contract, integration, end-to-end, fixture, and static verification content. Package-local unit tests stay beside the package/crate/module they verify. Fixtures must not contain real secrets, tokens, private customer data, or runtime state.
