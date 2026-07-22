# SDKWork BirdCoder Native Sessions Service Specs

This directory defines the module-local contract for the internal native-session service.

The service discovers and reads provider-owned histories for Codex, Claude Code, Gemini, and OpenCode behind an exact, server-authorized project root. It is not an HTTP API authority. Public session list, detail, event, and pagination contracts belong exclusively to the intelligence coding-session API.

Its internal reader exposes only complete-snapshot discovery and exact-bound detail reads. It does not provide an independently paginated session list or provider-derived public session identifier.

## Verification

- `cargo test --offline -p sdkwork-birdcoder-native-sessions-service --lib -- --nocapture`
- `cargo clippy --offline -p sdkwork-birdcoder-native-sessions-service --all-targets --no-deps -- -D warnings`
