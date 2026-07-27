# External Source Dependencies

These directories are read-only Git submodules. Do not patch, commit, or generate source changes
inside them from the BirdCoder repository. BirdCoder-owned integrations and adaptations must live
outside `external/`.

- `codex/`: `https://github.com/openai/codex.git`, branch `main`
- `gemini/`: `https://github.com/google-gemini/gemini-cli.git`, branch `main`
- `opencode/`: `https://github.com/anomalyco/opencode.git`, branch `dev`

Claude Code source is intentionally not mirrored because Claude Code is not open source. Claude
capabilities must use Anthropic's official SDK packages through the native package workspace. The
current workspace catalog authority is `@anthropic-ai/claude-agent-sdk` in `pnpm-workspace.yaml`.

Clone all external submodules with the repository:

```shell
git clone --recurse-submodules <sdkwork-birdcoder-repository-url>
```

Initialize them in an existing checkout:

```shell
git submodule sync --recursive
git submodule update --init --recursive
```

Update all external dependencies to the latest commit on their configured branches:

```shell
git submodule sync --recursive
git submodule update --init --recursive
git submodule update --remote --checkout --recursive
git add .gitmodules external/codex external/gemini external/opencode
```

Normal clone and update operations use the exact commits pinned by the parent repository gitlinks.
The branch entries in `.gitmodules` are the authority only when an explicit remote update is run.
