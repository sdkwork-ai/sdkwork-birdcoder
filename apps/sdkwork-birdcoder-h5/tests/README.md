# H5 App Tests

This directory contains application-level integration, runtime, route, package-boundary, host-adapter, config, and release verification tests for the H5 application.

## Purpose

App-level tests that verify cross-package behavior and architecture boundaries.

## Allowed Content

- Integration tests
- Runtime tests
- Route tests
- Package-boundary tests
- Host-adapter tests
- Config tests
- Release verification tests

## Forbidden Content

- Package-local unit tests (belongs in package `test/` directories)
- Shared test utilities (belongs in root `tests/`)

## Related Specs

- `APP_H5_ARCHITECTURE_SPEC.md` section 2
- `TEST_SPEC.md`
