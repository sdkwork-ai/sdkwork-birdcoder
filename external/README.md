# External Source Snapshot

- `codex/`: copied from `../claw-studio/.codex-tools/vendor-analysis/codex`
- `gemini/`: copied from `../claw-studio/.codex-tools/gemini-cli-official`
- `opencode/`: copied from `../claw-studio/.codex-tools/vendor-analysis/openclaw/extensions/opencode`
- `claude-code/`: reserved mirror path for Claude Code. No local source mirror is available in the current offline workspace; use the current workspace Claw Router open SDK until a local mirror is added.

Notes:
- Copies exclude `.git`, `node_modules`, `target`, `dist`, `build`, and `.cache`.
- `opencode/` is the locally available `@openclaw/opencode-provider` extension source. No standalone local `opencode` git repository was found in the inspected upstream cache.
- Claude/OpenAI-compatible SDK reference path: `../sdkwork-claw-router/sdks/clawrouter-open-sdk/clawrouter-open-sdk-typescript`
