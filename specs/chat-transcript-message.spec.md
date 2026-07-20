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

## Engine protocol compatibility

Provider payloads are changeable inputs. `chat-message-tool-calls.ts` is the compatibility boundary and projects them into the stable `BirdCoderChatMessageToolCall` contract before React rendering.

| Engine shape | Accepted source fields | Stable projection |
| --- | --- | --- |
| Codex / OpenAI | `function.name`, `function.arguments`, `local_shell_call.action.command[]`, `custom_tool_call`, `tool_search_call`, `web_search_call`, `mcp_tool_call`, correlated output items | semantic command, MCP, search, web, media, skill, or generic tool operation |
| Claude Code | `tool_use`, `id`, `name`, `input`; correlated `tool_result.content/is_error` | semantic operation with normalized success/error result state; `Task`/`Agent` tools become subagent activity |
| OpenCode | `part.type=tool`, `callID`, `tool`, `state.status/input/output/title/time`; `subtask` parts | semantic operation with normalized lifecycle state, title, duration, and subagent identity |
| Gemini | `functionCall.name/args`, `functionResponse.response`, `tool_call_request/response/confirmation` with nested `value` | semantic operation, correlated result, or approval request with cancelled/error lifecycle support |

Stable fields are `id`, `kind`, `name`, `arguments`, `status`, `output`, `command`, `target`, `serverName`, `title`, and `durationMs`. Stable kinds include command, file, search, web, MCP, subagent, skill, media, task, approval, question, and generic tool activity. UI components must not branch on provider JSON fields.

Reasoning, thinking, tool-use/result, function-call/result, retry, compaction, and step-boundary protocol blocks are non-answer content. Text extraction must skip them so private reasoning and raw protocol payloads never enter Markdown. Compression, retry, cancellation, blocked, and stopped lifecycle events become localized compact `system.notice` rows; citations remain visible answer content. Provider failures also become `system.notice` messages, with raw error bodies retained only when they are the user-facing failure reason.

Command tool calls are promoted into the `activity` block and deduplicated against structured `commands`. Tool result message bodies are not rendered as markdown. MCP and other non-command operations render as compact semantic rows; raw arguments and output are available only after explicit expansion.

## Expansion behavior

- The activity summary is one flat clickable row. It is collapsed by default.
- Expanding a command-only summary reveals the command list.
- Each command row owns independent expansion state and reveals the full command plus captured output.
- Each file row separates three actions: the disclosure icon toggles the inline diff, the file name opens the file in the editor, and the eye icon opens the full diff viewer.
- Each MCP/tool row owns independent expansion state and reveals normalized input/output details.
- Expansion controls expose `aria-expanded`; icon-only actions retain accessible names.

Tool detail rendering follows the desktop-client patterns shared by Codex, Claude Code, OpenCode, and Gemini: dense status-first rows, stable tool-call identity, provider-independent labels, controlled expansion, and bounded rendered output. Tool input/output previews are capped for transcript performance while copy actions retain access to the complete content.

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
