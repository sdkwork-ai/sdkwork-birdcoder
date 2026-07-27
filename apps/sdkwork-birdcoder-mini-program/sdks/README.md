# SDK Integration Boundary

This root consumes generated application SDK families through typed ports declared by `sdkwork-birdcoder-mp-core`. Generated SDK output remains owned by the canonical repository or dependency SDK workspaces and is not copied here.

The initialization round declares BirdCoder, Agents, IAM, and Drive app SDK dependencies. Concrete SDK client construction and appbase IAM bootstrap remain an explicit conversion gap until their mini-program-compatible generated runtimes are verified.
