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

## Provider Source Audit Baseline

The compatibility matrix was audited on 2026-07-20 against these pinned upstream
sources. The pins are audit evidence, not runtime dependencies, and a provider
upgrade must repeat the relevant fixture and source review before claiming
protocol parity.

| Provider | Audited revision | Primary protocol and presentation sources |
| --- | --- | --- |
| Codex | `20440a0833c475b899074f1794e543350fccf5b8` | app-server v2 `ThreadItem`, dynamic result types, TUI exec cells, MCP history cells, and multi-agent history |
| OpenCode | `43e472bba70728d79ad9a2003067b08104e24f7a` | generated v2 SDK types, `message-part.tsx`, and session timeline regression tests |
| Claude Code | repository `015170d3fd84fb57ef4685a64b673fadd0690dc1`; Agent SDK `0.3.215`; CLI `2.1.215` | published SDK message unions and tool/task lifecycle declarations |
| Gemini CLI | `acae7124bdd849e554eaa5e090199a0cf08cd782` | scheduler/tool types, chat recording/output types, message components, and stream-json tests |

Public product documentation can describe interaction intent, but the pinned
protocol types and source tests govern field names, lifecycle precedence, and
lossless replay behavior.

## Stable View Contract

`BirdCoderChatMessageView` is defined in
`sdkwork-birdcoder-pc-contracts-commons/src/chat-message-view.ts`. Activity and
file projection live in `chat-message-activity-projection.ts`, tool compatibility
in `chat-message-tool-calls.ts`, and task normalization in
`chat-message-task-progress.ts`.

View kinds are `user.text`, `assistant.text`, `assistant.activity`,
`tool.result`, `system.notice`, `planner.plan`, and `reviewer.feedback`.

Content blocks are `markdown`, `notice`, `reasoning`, `activity`,
`file-changes`, `commands`, `resources`, `task-progress`, and `tool-calls`.
View resolution is pure, memoizable, and layout-aware (`sidebar` or `main`). For
`assistant.activity`, commands and file changes collapse into one activity block
rather than separate transcript cards. Reasoning and resources remain separate
blocks even when their provider record also owns activity or authored text.

Canonical reasoning items expose only `id`, user-safe `summary`, optional
`title`, timestamps, and `durationMs`. Provider raw thought content, signatures,
encrypted payloads, and private chain-of-thought fields are never members of the
stable view contract. Reasoning is capped at 32 items and merged by canonical id
in first-seen provider order; an update for an existing id replaces stale
metadata without creating a second transcript row.

Canonical message resources expose only semantic file, image, audio, URI,
citation, mention, or skill metadata. Resources are capped at 32 items and
deduplicated by canonical id in first-seen provider order. A later update for an
existing id replaces its stale metadata. Resource-only and reasoning-only
records remain visible and distinct when their canonical ids differ, including
when they share a provider turn and have empty authored content.

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
JSON dump or duplicate them in Markdown. Structured lists are bounded by depth,
item count, and per-item length. A truncated text, error, resource, or diff
preview must retain an explicit action that copies the complete value.

## Provider Compatibility

`chat-message-tool-calls.ts` projects each provider protocol into the stable tool
contract before rendering. `chat-message-tool-results.ts` is the sole structured
result boundary: it validates unknown provider data, applies depth and item
bounds, detects semantic errors, and emits canonical result blocks. React must
not repeat that parsing or stringify provider objects as a display fallback.

| Engine shape | Accepted source fields | Stable projection |
| --- | --- | --- |
| Codex / OpenAI | `function.name`, `function.arguments`, `local_shell_call.action.command[]`, `custom_tool_call`, `tool_search_call`, `web_search_call`, `mcp_tool_call`, `collabAgentToolCall`, and correlated output items | Command, MCP, search, web, media, skill, task, agent, or generic semantic activity |
| Claude Code | `tool_use` with `id`, `name`, and `input`; correlated `toolUseResult` or `tool_result.content/is_error`; server tool-use and result blocks | Normalized operation and result lifecycle; `Task`, `Agent`, `SendMessage`, and team tools become agent activity |
| OpenCode | `part.type='tool'`, `callID`, `tool`, and `state.status/input/output/title/time`; `subtask` parts | Normalized lifecycle, title, duration, attachments, interruption, and agent identity |
| Gemini | `functionCall.name/args`, `functionResponse.response`, `tool_call_request/response/confirmation`, and direct `ToolCallRecord` `id/name/args/status/resultDisplay` shapes | Correlated operation, approval, file diff, todo, grep/list, ANSI output, or subagent activity with success, error, and cancelled lifecycle support |

The compatibility boundary also accepts current provider transport variants:

- Codex app-server camelCase `ThreadItem` values such as `commandExecution`,
  `dynamicToolCall`, `contentItems`, `imageView`, and `imageGeneration`;
  `webSearch`, `sleep`, `subAgentActivity`, `contextCompaction`, dynamic audio,
  and file move `movePath` values retain their distinct semantics.
- Claude SDK `system/task_started`, `task_progress`, `task_updated`, and
  `task_notification` agent lifecycle records, plus
  `toolUseResult.structuredPatch` file results. `skip_transcript`,
  `permission_denied`, `api_retry`, refusal fallback, `mirror_error`, and
  assistant `aborted` are control/lifecycle semantics rather than authored
  answer text. SDK `informational` levels become `info` or `warning` notices,
  `prevent_continuation` wins as `stopped`, and `local_command_output` remains
  visible as neutral transcript information. `Task`, `Agent`, `SendMessage`,
  team operations, and their SDK task aliases share one canonical agent/task
  lifecycle. `tool_use_summary` is structured task activity, not Markdown.
  `system/memory_recall` entries become bounded resources: local memory paths
  use the safe file-open boundary, HTTP(S) organization memory stays a URI, and
  `<synthesis:...>` entries remain non-file synthesis metadata. SDK `result`
  errors use bounded `errors` plus `terminal_reason` to produce a failed or
  cancelled notice without exposing the result envelope.
- OpenCode completed tool `state.metadata.files/filediff` and standalone Patch
  parts. Only successfully applied file records enter `fileChanges`, and
  `MessageAbortedError` remains cancellation rather than failure.
- Gemini stream-json `tool_use/tool_result` records with
  `tool_id/tool_name/parameters`, and nested subagent progress whose inner state
  overrides an incorrect outer success status. Explicit cancellation text wins
  even when a legacy tool result reports `status='success'`; warning events use
  a neutral `noticeKind=warning` presentation.
- MCP `structuredContent` and Codex dynamic `inputImage` values, which become
  semantic list, image, or audio blocks instead of JSON text.

Gemini direct `resultDisplay` values use this semantic projection:

| `resultDisplay` shape | Canonical result |
| --- | --- |
| `FileDiff` | `diff` result block plus a navigable `fileChanges` entry |
| `TodoList` | `list` result block plus canonical task progress |
| `GrepResult` | Summary text plus bounded `path:line: text` list items |
| Directory or read-many result | Bounded semantic `list` block |
| ANSI token array | One normalized `text` block |
| Subagent progress or history | Agent activity plus bounded list or text output |

Agent operation aliases are normalized before classification. This includes
Codex `spawnAgent`, `sendInput`, `resumeAgent`, `waitAgent`, `closeAgent`, and
their snake-case event equivalents; Claude `SendMessage`, `TeamCreate`, and
`TeamDelete`; OpenCode `subtask`; and Gemini `delegate_to_agent` or dynamic
subagent records.

Reasoning, thinking, tool-use/result, function-call/result, retry, compaction, and
step-boundary protocol blocks are non-answer content. Text extraction skips them
so private reasoning, signatures, and raw protocol payloads never enter Markdown.
Only an explicitly provider-authored display summary may enter the canonical
`reasoning` collection. Compression, retry, warning, cancellation, blocked, and
stopped lifecycle events become localized, compact `system.notice` rows.
Warnings are neutral status updates, not failed alerts. Citations remain visible
answer content. A provider failure becomes a notice, with the raw body shown
only when it is itself the user-facing reason.

Command tool calls are promoted into the activity block and deduplicated against
structured `commands`. Tool-result message bodies are not rendered as Markdown.
MCP and other non-command operations use compact semantic rows; normalized input
and output appear only after explicit expansion.

File mutation tool rows are deduplicated when the same operation is represented
by `fileChanges`. Read-only file operations such as `read_file` and
`read_many_files` remain visible even when the same turn also changed a file.

Error and cancellation normalization follows these precedence rules:

1. Explicit cancellation, interruption, decline, or rejection wins over an
   attached error reason and projects to `cancelled`.
2. A meaningful provider error projects to `error`; null, false, or empty error
   fields do not turn a successful operation into a failure.
3. MCP `isError` and `is_error` accept boolean `true` and the string `"true"`.
   Error text is extracted from structured content instead of displaying the
   raw content-block object.
4. Partial stdout or other useful output remains visible alongside an error or
   cancellation result.
5. A permission denial correlated by tool-call id becomes one cancelled tool
   lifecycle. Do not duplicate it as a second blocked notice in the same turn.

## Provider Order And Stable Slots

Provider-native part order is transcript data. A native assistant envelope that
contains `text -> tool -> text`, `tool -> reasoning -> text`, or another visible
sequence must become multiple stable records in that order when the canonical
message model cannot represent the sequence inside one record. Split records
share the provider turn but use deterministic source-part identities so replay,
deduplication, virtualization, and refresh cannot reorder or overwrite them.
Two completed provider records must not collapse merely because they share a
turn, role, timestamp, or rendered content. When both records carry an exact
provider sequence, that sequence is authoritative even when timestamps are equal
or arrive out of chronological order. If sequence and timestamp are both equal,
stable provider input order wins; role and message id are not ordering tie-breaks.

Structured-only deltas use independent event/part slots so resource, reasoning,
and tool records retain their cross-block order. A later update with the same
canonical reasoning or resource id replaces the first slot in place: it keeps
that slot's message identity and position rather than appending or moving it.
Canonical child matching is scoped by session, turn, role, and child kind, so a
reasoning id cannot match a resource id and an id reused in another turn cannot
collapse that turn. A structured delta ends the active text segment; later text
deltas start a new event-anchored segment instead of joining text from before the
structured boundary.

Tool request, progress, and result updates with the same provider call id fold
into one activity slot at the position of its primary request. Ancillary
reasoning or resources on a lifecycle update remain attached to that primary
slot and are merged by canonical id. They must not be copied onto every folded
record. Re-projecting an already folded transcript must preserve both array
identity and record order.

Codex thread items remain in app-server item order. OpenCode `content.parts`
remain in part order, including text, tool/subtask, reasoning, file, and patch
boundaries. Claude content blocks remain in content-array order, including
authored text, attachment, and tool-use boundaries. Gemini recorded message
order remains authoritative; within one recorded Gemini message, thoughts
precede its display text and recorded tool calls follow that text as defined by
the audited recording service.

## Live Structured Transport

Native history replay and live updates must enter the same provider-normalization
boundary. A live transport may retain `messages: string[]` as a compatibility
view, but it must also preserve ordered provider-native events or equivalent
typed chunks for tool calls, MCP results, approvals, questions, tasks, retries,
subagents, file changes, media, and lifecycle notices.

Dropping structured events and forwarding only assistant text is not protocol
parity: the renderer cannot reconstruct correlation ids, status transitions,
structured results, or file metadata from text. A transport implementation is
therefore incomplete until the structured side channel reaches
`BirdCoderCodingSessionEvent` projection without stringification. Event order,
provider ids, turn correlation, and partial-output semantics must survive that
path while duplicate text and native events remain deduplicated.

One transcript-level live announcer derives command lifecycle state from both
canonical `commands` and engine-aware provider `tool_calls`. This includes
providers that emit command tool calls without a separate derived command list.
Static history rows must not register their own live regions or repeat the same
announcement.

The current code-engine worker/service port remains a content-only compatibility
transport (`sequence` plus `content` / `content_delta`). Empty structured events
can be filtered before they reach the application event stream. Consequently,
approval, question, tool-progress, and similar execution-time structures cannot
yet claim real-time parity across every provider. Native-history refresh must
restore the final structured transcript after a turn completes, but refresh is
final consistency rather than a substitute for the required typed live side
channel. Completion reports must disclose this limitation until the shared
provider SPI and service port are upgraded.

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

Codex collab-agent begin/end events are correlated by call id and replayed as one
agent tool lifecycle for spawn, send-input, resume, wait, and close operations.
Unclosed operations remain running. MCP history must inspect both the outer
result and nested `Ok.isError` or `Ok.is_error` values before choosing a terminal
status.

Codex messages without an explicit turn id inherit the current `task_started` or
`turn_context` identity. Task lifecycle flags are reset when a later task starts;
an earlier `task_complete` must not leave a resumed or newly started session in a
completed state.

Paginated Codex rollouts persist `event_msg/item_completed` records whose
`item.type` is the protocol's PascalCase `TurnItem` discriminant. Visible Plan,
CommandExecution, DynamicToolCall, CollabAgentToolCall, SubAgentActivity,
Extension, EnteredReviewMode, and ExitedReviewMode items are projected through
the same semantic builders as app-server history. Their native item id is the
stable update key: completion replaces an earlier lifecycle slot in place rather
than appending a duplicate. Command argv arrays use display-safe shell quoting,
and review findings retain bounded title, body, file, and line citations instead
of becoming a serialized review envelope. HookPrompt remains intentionally
private and never enters the transcript.

Codex `thread_rolled_back` removes the requested number of most recent provider
turns, including their pending and consumed tool state. A subsequent turn starts
from the retained transcript and cannot resurrect removed activity. Persisted
`thread_goal_updated` is a current-state signal rather than a historical turn:
BirdCoder exposes one compact task lifecycle slot per thread and updates it in
place. The exact provider goal status remains available for `active`, `paused`,
`blocked`, `usageLimited`, `budgetLimited`, and `complete`; an optional provider
`turnId` stays in structured arguments and does not make the current-goal slot
subject to turn rollback. `thread_settings_applied` may update native model
metadata without creating a transcript row.

Claude Code history correlates `tool_result.tool_use_id` back to the preceding
`tool_use.id`, preserving the original name, turn identity, partial output, and
completed, error, or cancelled status. A tool-only assistant record has empty
authored content; it must not synthesize `Tool call: <name>` Markdown.
Boolean/string `is_error` and `isError` flags are accepted, while false, null,
empty-string, and empty-object error values do not create a failure.

Ordinary Claude user and assistant `image` and `document` blocks become message
resources at their original content positions; they must not synthesize `Image
attachment.` or `Document attachment.` Markdown. HTTPS sources may remain
navigable. Image base64 may become a typed `data:image/*;base64,...` media source
only when the complete source is at most 4 MiB. Oversized image data and all
document base64 are dropped whole rather than truncated or serialized. `data:`
and `blob:` values never become file paths, citation URIs, or editor targets.
The same complete-source 4 MiB limit applies to tool-result image/audio sources,
inline data, and MCP resource blobs. A recognized media envelope that exceeds
the limit, has an invalid media data URI, or otherwise cannot be normalized is
dropped as media and must not fall back to JSON, flattened text, or base64 text.
Inline base64 rejects whitespace, invalid characters, and inconsistent padding;
its declared MIME must match the data URI and image/audio block kind. Inline
images are limited to GIF, JPEG, PNG, and WebP, so SVG data cannot cross the
canonical or defensive renderer boundary. Media sources accept bounded HTTP(S),
blob, or validated data sources; `javascript:` and `file:` media sources are
dropped.

Claude SDK result failures combine all bounded user-facing `errors` and the
optional `terminal_reason` into one notice. Explicit aborted or hook-stopped
terminal reasons are cancellation; other error results are failures. Permission
denials update their correlated tool lifecycle by `tool_use_id`; only an
uncorrelated denial may fall back to a concise cancelled notice. A successful
result with an optional denied tool does not by itself mark the whole session as
failed.

Claude Agent SDK user records marked `isSynthetic` are provider-generated
protocol frames, not authored user messages. SDK ingestion may persist the same
semantic as `isMeta`; camel-case and compatible snake-case history variants are
normalized at the Claude boundary. Synthetic text stays out of user Markdown,
but a synthetic user wrapper containing `tool_result` plus `toolUseResult` or
`tool_use_result` remains a correlated tool lifecycle with its structured
output. `shouldQuery: false` only suppresses a new assistant query: the authored
user record still belongs in the transcript and must not be filtered.

OpenCode history can deliver `content.parts` where `part.type='tool'`, `callID`,
and `state` define the operation and lifecycle. Tool metadata marked
`interrupted` projects to `cancelled`, while partial output and structured error
details remain available in the expanded result. OpenCode `TextPart` records
marked `synthetic: true` are provider-authored bridge prompts for compaction,
shell execution, or attachment context and must not appear as authored user
messages.

OpenCode assistant records inherit their user turn through official `parentID`,
`parentId`, or `parent_id` fields. False, null, empty, or empty-object error
values are absence, not output and not failure.

OpenCode native replay also reads the official pending permission and question
inventories. Requests are filtered by native session id and become canonical
approval or user-question activity with their request id retained for reply.
This history recovery is independent from the content-only live transport
limitation above.

Gemini assistant, tool, and notice records inherit the nearest user turn.
Provider `info`, `warning`, and `error` records become system notices rather than
tool results; error notices carry `noticeKind=failed`. Native replay preserves
the same FileDiff, TodoList, GrepResult, ANSI-output, nested error/cancellation,
and subagent semantics as the TypeScript compatibility boundary.

Gemini native discovery accepts both legacy `session-*.json` snapshots and the
current `session-*.jsonl` log. JSONL replay applies records in physical order:
initial metadata is merged, message records are inserted or replaced by id
without moving an existing slot, `$set.messages` replaces the checkpoint, other
allowlisted `$set` metadata updates the session, and `$rewindTo` removes the
target message and everything after it. Unknown control records and malformed
individual lines are ignored rather than displayed as system or Markdown text.

Native JSON/JSONL ingestion is bounded before line or file allocation. Codex
allows 1 MiB index records and 16 MiB session records; Gemini allows 16 MiB
records inside a 64 MiB session file; Claude Code allows 32 MiB records; SDK
bridge snapshots allow 128 MiB plus bounded nested collections. Readers use a
64 KiB fixed buffer. An oversized JSONL record is discarded in chunks through
its newline, after which later valid records continue to replay with their
physical order intact. Codex `.jsonl.zst` belongs to an upstream
under-development feature that is disabled by default at the audited revision;
this compatibility baseline does not claim compressed-rollout discovery.

OpenCode reasoning, step, file-placeholder, and patch-placeholder parts are not
assistant answers. Gemini thoughts and function-call or function-response
placeholders are also not assistant answers. After structured activity is
projected, any non-user history record with neither visible text nor commands,
tool calls, file changes, or task progress is removed so replay cannot create a
blank transcript row. Tool-only and patch-only records remain valid.

The provider replay authority is covered by:

- `scripts/selected-session-native-authority-hydration-contract.test.ts`
- `scripts/chat-message-projection-contract.test.ts`
- `scripts/chat-message-tool-calls-contract.test.ts`

## OpenAPI And SDK Persistence

`BirdCoderNativeSessionMessage` must carry canonical `reasoning` and `resources`
through the application OpenAPI authority, materialized coding-server schema,
SDK generator input, generated TypeScript/Rust transports, native-history
service response, and PC hydration. These fields are not UI-only extensions and
must survive server-mode refresh and desktop/native replay.

Generated SDK files are never edited by hand. Change the owning schema and
generator mappings, then run the repository materialization, SDK synchronization,
generation, standard generation, generated-family checks, TypeScript package
typechecks, and Rust generated-client checks. Root and PC SDK mirrors must remain
byte-for-byte semantically aligned after generation.

## Expansion And Interaction

- The activity summary is one flat clickable row, collapsed by default.
- Expanding the summary reveals command and file activity without creating nested cards.
- Each command row owns independent expansion state and reveals the complete command and captured output.
- Each file row keeps inline disclosure, editor open, and full diff as independent actions.
- Each MCP or tool row owns independent expansion state and reveals normalized input and structured output.
- Reasoning summaries are collapsed by default. Each message reasoning block has
  independent disclosure state, a bounded scroll region, and item-level copy
  actions that copy only public summaries.
- Expansion controls expose `aria-expanded`; icon-only controls retain localized accessible names.
- Task progress uses localized copy and native progressbar value semantics.
- Without `onOpenFile`, the file-name control must not expose a dead editor action. It becomes a disclosure control and exposes `aria-expanded`.

Tool details follow the dense, status-first interaction patterns used by Codex,
Claude Code, OpenCode, and Gemini desktop clients. Identity and status stay
visible while raw details remain opt-in. Rendered previews are bounded for
transcript performance; copy actions still resolve the complete content lazily.
If a structured input omits fields or shortens any visible field, the expanded
view must disclose that truncation while retaining the complete input copy
action. Both structured and fallback inputs use bounded scroll regions so a
valid multi-line MCP argument cannot resize the transcript by thousands of
lines. Resource and media metadata is line-bounded while its semantic copy
representation retains the complete provider value.

Message-level copy represents authored user, assistant, planner, and reviewer
content only. It excludes `role='tool'` protocol bodies, because those rows are
rendered and copied through their normalized semantic tool controls. A reply
group with no authored copy content does not expose an empty Copy action.
Command-output previews preserve significant indentation and trailing
whitespace; bounding affects only the preview and never the complete copy
value.

Persisted `system.notice` rows are static `note` semantics. They must not own
`alert` or `status` live regions, because history hydration and transcript
virtualization can mount the same row repeatedly. Live arrival announcements
belong to a stable non-virtualized event surface, not each historical row.

## File Navigation And Historical Diff Safety

Provider file paths are protocol data, not trusted IDE virtual paths. Resolve
them against the selected session's project file index. Resolution supports an
exact virtual path and a safe relative provider path under one known project
root. Reject control characters, unsafe traversal, paths outside the project
root, and ambiguous suffix matches.

File resources may carry their editor target in either top-level `path` or
canonical `origin.path`; both use the same safe workbench resolver. Resource
HTTP(S) URIs may open externally, while `data:` and `blob:` values are media-only
and never enter either navigation path.

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
- Desktop, 680px, and 420px layouts must avoid horizontal document overflow
  while preserving file names, parent paths, status, and actions. At compact
  widths the fixed sessions explorer and its resize handle yield space to the
  transcript instead of compressing message content below a usable width.
- MCP rich results, expanded multi-command activity, workspace-backed editor opens, and diff-only historical views require E2E screenshot coverage.

## Extension Checklist

1. Add a cross-engine view kind or block type in `sdkwork-birdcoder-pc-contracts-commons/src/chat-message-view.ts`.
2. Add provider normalization in `sdkwork-birdcoder-pc-contracts-commons/src/chat-message-tool-calls.ts`; do not branch in React.
3. Add the block renderer under `@sdkwork/birdcoder-pc-ui` `contentBlocks/`.
4. Register the default renderer in `defaultRegistry.ts`.
5. Add an engine presentation override in `plugins/enginePlugins.ts` only when stable view data cannot express the shared presentation.
6. Add focused provider, projection, accessibility, and responsive E2E contract coverage.
