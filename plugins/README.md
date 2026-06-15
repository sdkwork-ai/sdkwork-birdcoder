# Plugins Directory

## Purpose
Application/runtime plugin source packages, marketplace plugin implementations, or extension packages.

## Owner
SDKWork Birdcoder team.

## Allowed Content
- Plugin source packages
- Marketplace plugin implementations
- Extension packages
- Plugin configuration files
- Plugin documentation

## Forbidden Content
- Unrelated external toolchains
- Generated SDK outputs
- Runtime secrets or credentials
- Runtime databases, caches, logs
- User-private data
- Temporary build artifacts

## Related Specs
- [APPLICATION_SPEC.md](../sdkwork-specs/APPLICATION_SPEC.md)
- [MODULE_SPEC.md](../sdkwork-specs/MODULE_SPEC.md)
- [COMPONENT_SPEC.md](../sdkwork-specs/COMPONENT_SPEC.md)

## Verification
- [ ] Plugins follow SDKWork naming conventions
- [ ] Plugins have proper documentation
- [ ] Plugins do not vendor unrelated external toolchains
- [ ] Plugins do not contain secrets or runtime data
- [ ] Build/SDK generation/deployment plugins call canonical commands

## Notes
Application/runtime plugin source and .sdkwork/plugins/ agent plugin workspaces are distinct. Repository/application agent plugins remain under .sdkwork/plugins/.
