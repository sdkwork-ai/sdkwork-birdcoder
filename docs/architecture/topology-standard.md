# Birdcoder Runtime Topology

This document narrows the SDKWork runtime topology standard for Birdcoder. The
normative authorities are:

- `../../../sdkwork-specs/APP_RUNTIME_TOPOLOGY_SPEC.md`
- `../../../sdkwork-specs/APP_RUNTIME_TOPOLOGY_NAMING.md`

The machine-readable contract is
[`../../specs/topology.spec.json`](../../specs/topology.spec.json). When this
document and the machine contract disagree, the root standards and machine
contract take precedence.

## Deployment Profiles

Birdcoder supports exactly two deployment profiles: `standalone` and `cloud`.
Environment-specific profile files live in `../../configs/topology/` and use
the canonical `<deploymentProfile>.<environment>.env` naming scheme.

- Development defaults to `standalone.development`.
- Production defaults to `cloud.production`.
- Desktop production packaging uses `standalone.production`.

Runtime targets such as browser, desktop, server, and container are packaging
or host choices. They do not create additional deployment profiles.

## Ingress Ownership

`application.public-ingress` is the Birdcoder-owned public entrypoint for
application HTTP APIs. Application clients use its declared public HTTP URL;
internal route crates and process layout remain behind this ingress.

`platform.api-gateway` is the SDKWork platform entrypoint for shared platform
APIs such as IAM. It is owned by `sdkwork-api-cloud-gateway` when external. A
standalone deployment may use an approved embedded platform adapter, but it
must preserve the same SDK and credential contracts.

Application routes must not be exposed through the platform gateway, and
platform APIs must not be inferred from the application ingress URL. Client
bootstrap keeps the two surfaces explicit through the environment keys in the
machine contract.

## Verification

Run the repository topology gate from the Birdcoder root:

```bash
pnpm check:topology-standard
```

The gate validates the machine contract, profile files, orchestration
vocabulary, and removal of retired topology aliases.
