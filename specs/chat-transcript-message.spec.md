# Chat Transcript Message System

## Authority

| Layer | Package | Responsibility |
| --- | --- | --- |
| Shared message contract | `@sdkwork/birdcoder-chat-contracts` | Provider-independent chat records, tool calls, and structured result blocks |
| PC message projection | `@sdkwork/birdcoder-pc-contracts-commons` | Event projection, provider compatibility, activity aggregation, and `BirdCoderChatMessageView` |
| Renderer registry | `@sdkwork/birdcoder-pc-ui` -> `components/chat/messages/` | Pluggable message renderers, content blocks, and engine presentation plugins |
| Composer and virtualization | `@sdkwork/birdcoder-pc-ui` -> `UniversalChat` | Transcript windowing, composer behavior, and message interaction callbacks |
| Editor file resolution | `@sdkwork/birdcoder-pc-workbench` | Safe resolution of provider file paths against the active project tree |

Legacy `sdkwork-birdcoder-pc-chat*` turn-adapter packages remain retired by
`kernel-birdcoder-alignment.spec.json`. UI code must not execute engine turns or
interpret raw provider payloads directly.

## Data Flow

```text
Provider-native history + BirdCoderCodingSessionEvent[]
  -> native-session hydration + mergeBirdCoderProjectionMessages
     (@sdkwork/birdcoder-pc-contracts-commons)
BirdCoderChatMessage[]
  -> provider tool projection + turn activity aggregation
     (@sdkwork/birdcoder-pc-contracts-commons)
  -> resolveChatMessageView
     (@sdkwork/birdcoder-pc-contracts-commons)
BirdCoderChatMessageView { kind, blocks, engineId, layoutHints }
  -> ChatMessageRendererRegistry.resolve(view)
React renderer component
  -> ContentBlockList(view.blocks)
```

Provider payloads are changeable protocol input. The projection layer is the
compatibility boundary; React receives stable view models and must not branch on
provider-specific JSON fields.

## Stable View Contract

`BirdCoderChatMessageView` is defined in
`sdkwork-birdcoder-pc-contracts-commons/src/chat-message-view.ts`. Activity and
file projection live in `chat-message-activity-projection.ts`, tool compatibility
in `chat-message-tool-calls.ts`, and task normalization in
`chat-message-task-progress.ts`.

View kinds are `user.text`, `assistant.text`, `assistant.activity`,
`tool.result`, `system.notice`, `planner.plan`, and `reviewer.feedback`.

Content blocks are `markdown`, `activity`, `file-changes`, `commands`,
`task-progress`, and `tool-calls`. View resolution is pure, memoizable, and
layout-aware (`sidebar` or `main`). For `assistant.activity`, commands and file
changes collapse into one activity block rather than separate transcript cards.

The shared `BirdCoderChatMessageToolCall` contract is defined in
`apps/sdkwork-birdcoder-common/packages/sdkwork-birdcoder-chat-contracts/src/index.ts`
and consumed through `@sdkwork/birdcoder-pc-contracts-commons`. Stable fields are
`id`, `type`, `kind`, `name`, `arguments`, `status`, `output`, `command`, `target`,
`serverName`, `title`, `durationMs`, and `resultBlocks`. Stable kinds are
`command`, `file`, `search`, `web`, `mcp`, `agent`, `skill`, `media`, `task`,
`approval`, `question`, and `other`.

Structured `resultBlocks` use these discriminants:

| Type | Semantic content |
| --- | --- |
| `text` | Human-readable output text |
| `image` | Image source, MIME type, and optional title |
| `audio` | Audio source, MIME type, and optional title |
| `resource` | URI-backed or embedded resource metadata and optional text |
| `link` | Navigable URL with optional title and description |
| `diff` | Patch content and optional file path |
| `list` | Bounded semantic items and optional total count |
| `error` | User-facing failure message |

Render structured blocks with dedicated components. Do not flatten them into a
JSON dump or duplicate them in Markdown.

## Provider Compatibility

`chat-message-tool-calls.ts` projects each provider protocol into the stable tool
contract before rendering.

| Engine shape | Accepted source fields | Stable projection |
| --- | --- | --- |
| Codex / OpenAI | `function.name`, `function.arguments`, `local_shell_call.action.command[]`, `custom_tool_call`, `tool_search_call`, `web_search_call`, `mcp_tool_call`, and correlated output items | Command, MCP, search, web, media, skill, task, or generic semantic activity |
| Claude Code | `tool_use` with `id`, `name`, and `input`; correlated `tool_result.content/is_error`; server tool-use and result blocks | Normalized operation and result lifecycle; `Task` and `Agent` tools become agent activity |
| OpenCode | `part.type='tool'`, `callID`, `tool`, and `state.status/input/output/title/time`; `subtask` parts | Normalized lifecycle, title, duration, attachments, and agent identity |
| Gemini | `functionCall.name/args`, `functionResponse.response`, and `tool_call_request/response/confirmation` with nested `value` | Correlated operation or approval request with success, error, and cancelled lifecycle support |

Reasoning, thinking, tool-use/result, function-call/result, retry, compaction, and
step-boundary protocol blocks are non-answer content. Text extraction skips them
so private reasoning and raw protocol payloads never enter Markdown. Compression,
retry, cancellation, blocked, and stopped lifecycle events become localized,
compact `system.notice` rows. Citations remain visible answer content. A provider
failure becomes a notice, with the raw body shown only when it is itself the
user-facing reason.

Command tool calls are promoted into the activity block and deduplicated against
structured `commands`. Tool-result message bodies are not rendered as Markdown.
MCP and other non-command operations use compact semantic rows; normalized input
and output appear only after explicit expansion.

## Provider-Native History Replay

Native session identifiers are recognized for Codex (`codex-native:`), Claude
Code (`claude-code-native:`), Gemini (`gemini-native:`), and OpenCode
(`opencode-native:`). When a native session is selected, native history is loaded
first and later canonical coding-session events are appended. Hydration must
preserve commands, `tool_calls`, `fileChanges`, task progress, and native session
metadata.

Codex history can deliver `content.items` containing `command_execution`,
`file_change`, `web_search`, and `todo_list`. These items become semantic activity
without manufacturing duplicate authored `tool_calls`. Every
`file_change.changes[]` entry becomes an independently navigable file row, and a
unified diff remains available even when no original or modified file content is
present.

OpenCode history can deliver `content.parts` where `part.type='tool'`, `callID`,
and `state` define the operation and lifecycle. Tool metadata marked
`interrupted` projects to `cancelled`, while partial output and structured error
details remain available in the expanded result.

The provider replay authority is covered by:

- `scripts/selected-session-native-authority-hydration-contract.test.ts`
- `scripts/chat-message-projection-contract.test.ts`
- `scripts/chat-message-tool-calls-contract.test.ts`

## Expansion And Interaction

- The activity summary is one flat clickable row, collapsed by default.
- Expanding the summary reveals command and file activity without creating nested cards.
- Each command row owns independent expansion state and reveals the complete command and captured output.
- Each file row keeps inline disclosure, editor open, and full diff as independent actions.
- Each MCP or tool row owns independent expansion state and reveals normalized input and structured output.
- Expansion controls expose `aria-expanded`; icon-only controls retain localized accessible names.
- Without `onOpenFile`, the file-name control must not expose a dead editor action. It becomes a disclosure control and exposes `aria-expanded`.

Tool details follow the dense, status-first interaction patterns used by Codex,
Claude Code, OpenCode, and Gemini desktop clients. Identity and status stay
visible while raw details remain opt-in. Rendered previews are bounded for
transcript performance; copy actions still resolve the complete content lazily.

## File Navigation And Historical Diff Safety

Provider file paths are protocol data, not trusted IDE virtual paths. Resolve
them against the selected session's project file index. Resolution supports an
exact virtual path and a safe relative provider path under one known project
root. Reject control characters, unsafe traversal, paths outside the project
root, and ambiguous suffix matches.

A file click during editor cold start must queue the provider path and replay it
after the first project file-tree synchronization. An unresolved path must not
create a phantom editor tab. Ordinary explorer selection and provider-message
selection remain separate operations so unrelated navigation cannot replay a
stale provider path.

Transcript inline diff, editor file open, and historical full diff are separate
actions. The historical full diff is always read-only:

1. Prefer the complete unified `diff` when supplied.
2. Otherwise compare `originalContent` and `content` in a read-only diff editor.
3. Show a localized unavailable state when neither source exists.

Transcript history must never render Accept or Reject actions. It must not coerce
a missing `content` field to an empty write. Approval of a proposed edit belongs
to a separate proposal lifecycle and component, not the historical transcript
viewer.

## Renderer Registry

`createChatMessageRendererRegistry(entries, fallback)` matches on `viewKind`, then
optional `engineId`, then optional `role`. Each entry provides a memoized
`Component` and an `estimateHeight` virtualization hint. Engine-specific entries
register in `plugins/enginePlugins.ts` with higher priority only when presentation
must differ; they still consume the same stable view contract.

Renderers prefer `view.blocks` through `ContentBlockList` instead of reading raw
message fields. `ChatMessageRenderContext` keeps `renderMarkdownContent` for lazy
Markdown. Copy actions resolve text through `resolveMessageCopyContent` in
`@sdkwork/birdcoder-pc-contracts-commons`, so hidden activity summaries and tool
results are neither lost nor duplicated.

## Performance And Verification

- `ChatTranscriptMessage` memoizes `resolveChatMessageView`.
- Renderer components are wrapped in `memo()`.
- `estimateChatMessageViewHeight` feeds virtualized transcript windows.
- Long command and provider output is previewed with explicit truncation and bounded scrolling.
- Desktop and 680px layouts must avoid horizontal document overflow while preserving file names, parent paths, status, and actions.
- MCP rich results, expanded multi-command activity, workspace-backed editor opens, and diff-only historical views require E2E screenshot coverage.

## Extension Checklist

1. Add a cross-engine view kind or block type in `sdkwork-birdcoder-pc-contracts-commons/src/chat-message-view.ts`.
2. Add provider normalization in `sdkwork-birdcoder-pc-contracts-commons/src/chat-message-tool-calls.ts`; do not branch in React.
3. Add the block renderer under `@sdkwork/birdcoder-pc-ui` `contentBlocks/`.
4. Register the default renderer in `defaultRegistry.ts`.
5. Add an engine presentation override in `plugins/enginePlugins.ts` only when stable view data cannot express the shared presentation.
6. Add focused provider, projection, accessibility, and responsive E2E contract coverage.
