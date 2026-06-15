# Configs Directory

## Purpose
Source-controlled safe config templates, profile examples, config schemas, and non-secret runtime defaults.

## Owner
SDKWork Birdcoder team.

## Allowed Content
- Configuration templates
- Profile examples
- Configuration schemas
- Non-secret runtime defaults
- Environment configuration examples
- Configuration documentation

## Forbidden Content
- Live secrets or credentials
- Local override files
- User-private runtime config
- Runtime state
- Temporary build artifacts
- Generated SDK output

## Related Specs
- [CONFIG_SPEC.md](../sdkwork-specs/CONFIG_SPEC.md)
- [ENVIRONMENT_SPEC.md](../sdkwork-specs/ENVIRONMENT_SPEC.md)
- [DEPLOYMENT_SPEC.md](../sdkwork-specs/DEPLOYMENT_SPEC.md)
- [SECURITY_SPEC.md](../sdkwork-specs/SECURITY_SPEC.md)

## Verification
- [ ] No secrets or credentials in configs/
- [ ] Configuration templates are valid and documented
- [ ] Profile examples cover all required environments
- [ ] Configuration schemas are accurate and complete

## Notes
Runtime user/private config remains governed by RUNTIME_DIRECTORY_SPEC.md and must not be committed. Configs/ stores source-controlled safe config templates, schemas, profile examples, and non-secret defaults.
