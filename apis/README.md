# APIs Directory

## Purpose
Author-owned API contracts and API source inputs for all API kinds, including HTTP OpenAPI surfaces, RPC/proto contracts, async/event API manifests, API examples, API changelogs, and API validation inputs.

## Owner
SDKWork Birdcoder team.

## Allowed Content
- OpenAPI specifications (openapi.yaml)
- API route definitions
- API schema definitions
- API examples
- API changelogs
- API validation fixtures
- RPC/proto contracts (when applicable)
- Async/event API manifests (when applicable)

## Forbidden Content
- Generated SDK transport output
- Implementation code
- Generated SDK control-plane `.sdkwork/` files
- SDK family directories
- Runtime secrets or credentials

## Related Specs
- [API_SPEC.md](../sdkwork-specs/API_SPEC.md)
- [SDK_SPEC.md](../sdkwork-specs/SDK_SPEC.md)
- [SDK_WORKSPACE_GENERATION_SPEC.md](../sdkwork-specs/SDK_WORKSPACE_GENERATION_SPEC.md)
- [WEB_BACKEND_SPEC.md](../sdkwork-specs/WEB_BACKEND_SPEC.md)

## Verification
- [ ] API contracts follow OpenAPI 3.1.2 stable profile
- [ ] No generated SDK output in apis/
- [ ] API examples are valid and documented
