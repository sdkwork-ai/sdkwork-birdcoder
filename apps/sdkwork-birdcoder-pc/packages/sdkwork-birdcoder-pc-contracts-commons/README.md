# @sdkwork/birdcoder-pc-contracts-commons

BirdCoder PC coding-workbench presentation contracts and value objects.

AI conversations are canonical `sdkwork-agents` Sessions and Session Items. This package owns only memory views. Human messages belong to `sdkwork-im`. Documents and IAM values are read-only views composed from their owning generated SDKs.

This package defines no database catalog, storage binding, hand-written API client, generated SDK fork, persisted read model, synchronized data copy, or parallel session authority.

Verification: `pnpm --filter @sdkwork/birdcoder-pc-contracts-commons typecheck`.
