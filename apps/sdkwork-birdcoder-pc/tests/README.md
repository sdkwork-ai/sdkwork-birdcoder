# PC App Tests

This directory contains application-level integration, runtime, route, package-boundary, and architecture verification tests for the PC application.

## Purpose

App-level tests that verify cross-package behavior and architecture boundaries.

## Allowed Content

- Integration tests
- Runtime tests
- Route tests
- Package-boundary tests
- Architecture verification tests

## Forbidden Content

- Package-local unit tests (belongs in package `test/` directories)
- Shared test utilities (belongs in root `tests/`)

## Related Specs

- `APP_PC_ARCHITECTURE_SPEC.md` section 2
- `TEST_SPEC.md`
