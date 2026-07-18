# Chat Transcript Message System

## Authority

| Layer | Package | Responsibility |
| --- | --- | --- |
| Canonical message | `@sdkwork/birdcoder-pc-contracts-commons` | `BirdCoderChatMessage`, event projection, **`BirdCoderChatMessageView`** |
| Renderer registry | `@sdkwork/birdcoder-pc-ui` → `components/chat/messages/` | Pluggable message renderers, content blocks, engine plugins |
| Composer / virtualization | `@sdkwork/birdcoder-pc-ui` → `UniversalChat` | Scroll windowing, composer, pending interactions |

Legacy `sdkwork-birdcoder-pc-chat*` turn-adapter packages remain **retired** (`kernel-birdcoder-alignment.spec.json`). UI code must not execute engine turns.

## Data flow

```
BirdCoderCodingSessionEvent[]
  → mergeBirdCoderProjectionMessages (pc-types)
BirdCoderChatMessage[]
  → resolveChatMessageView (pc-types)
BirdCoderChatMessageView { kind, blocks, engineId, layoutHints }
  → ChatMessageRendererRegistry.resolve(view)
React renderer component
  → ContentBlockList(view.blocks)
```

## BirdCoderChatMessageView

Defined in `pc-types/src/chat-message-view.ts` with activity/file parsing in `chat-message-activity-projection.ts` and task-progress normalization in `chat-message-task-progress.ts`.

**View kinds:** `user.text`, `assistant.text`, `assistant.activity`, `tool.result`, `system.notice`, `planner.plan`, `reviewer.feedback`.

**Content blocks:** `markdown`, `activity`, `file-changes`, `commands`, `task-progress`, `tool-calls`.

View resolution is pure, memoizable, and layout-aware (`sidebar` | `main`). For `assistant.activity`, file changes and commands collapse into a single `activity` block.

## Renderer registry

`createChatMessageRendererRegistry(entries, fallback)` matches on:

1. `viewKind`
2. `engineId` (optional — higher priority when set)
3. `role` (optional)

Each entry provides:

- `Component` — memoized React renderer
- `estimateHeight` — virtualization hint (`estimateChatMessageViewHeight`)

## Engine plugins

Per-engine entries register with `match: { viewKind, engineId }` and `priority > 10` so Codex / Claude / Gemini / OpenCode can override presentation without forking the view model.

Register new engines in `plugins/enginePlugins.ts`.

## Content blocks

Renderers should prefer `view.blocks` via `ContentBlockList` instead of reading raw message fields. `ChatMessageRenderContext` keeps `renderMarkdownContent` for lazy markdown loading; activity and task progress render through dedicated block components (`ChatActivitySummary`, `ChatTaskProgress`). Copy actions resolve text lazily through `resolveMessageCopyContent` in `pc-types` so hidden tool summaries are not duplicated in clipboard output.

## Performance

- `ChatTranscriptMessage` memoizes `resolveChatMessageView`.
- Renderer components are `memo()` wrapped.
- `estimateChatMessageViewHeight` feeds virtualized transcript windows.

## Extension checklist

1. Add view kind or block type in `pc-types/chat-message-view.ts` if the shape is cross-engine.
2. Add block renderer in `contentBlocks/`.
3. Register default renderer in `defaultRegistry.ts`.
4. Add engine override in `plugins/enginePlugins.ts` when presentation differs by agent.
5. Add contract coverage in `scripts/chat-message-renderer-contract.test.ts`.
