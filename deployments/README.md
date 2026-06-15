# Deployments Directory

## Purpose
Deployment descriptors, environment topology, packaging handoff files, infrastructure examples, and release deployment documentation.

## Owner
SDKWork Birdcoder team.

## Allowed Content
- Deployment descriptors
- Environment topology
- Packaging handoff files
- Infrastructure examples
- Release deployment documentation
- Docker configurations
- Kubernetes manifests
- Systemd service files
- Nginx configurations
- Deployment runbooks

## Forbidden Content
- Live secrets or private keys
- Local override files
- User-private runtime config
- Runtime state
- Temporary build artifacts
- Generated SDK output

## Related Specs
- [DEPLOYMENT_SPEC.md](../sdkwork-specs/DEPLOYMENT_SPEC.md)
- [RUNTIME_DIRECTORY_SPEC.md](../sdkwork-specs/RUNTIME_DIRECTORY_SPEC.md)
- [ENVIRONMENT_SPEC.md](../sdkwork-specs/ENVIRONMENT_SPEC.md)
- [GITHUB_WORKFLOW_SPEC.md](../sdkwork-specs/GITHUB_WORKFLOW_SPEC.md)

## Verification
- [ ] No secrets or private keys in deployments/
- [ ] Deployment descriptors are valid and documented
- [ ] Infrastructure examples are safe and non-production
- [ ] Deployment runbooks are complete and accurate

## Notes
Deployments/ stores deployment topology, infrastructure descriptors, release handoff files, and deployment runbooks. It must not store live secrets, private keys, local override files, or runtime user config.
