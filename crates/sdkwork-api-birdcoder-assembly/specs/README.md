# sdkwork-api-birdcoder-assembly Specs

Component root: `crates/sdkwork-api-birdcoder-assembly`

Host-neutral assembly for BirdCoder-owned System and coding-workbench App API routes.

Dependency-owned Agents, IAM, Drive, Membership, Skills, IM, and Terminal routes remain in
their owner assemblies and are never copied into this manifest or BirdCoder OpenAPI authority.

The assembly consumes the Agents App business runtime as one unit and exposes its readiness
check in the host-neutral `ApiAssembly` result. The standalone gateway mounts `/readyz` once,
so production database availability is evaluated through the canonical Agents repository pool
without a BirdCoder pool.
