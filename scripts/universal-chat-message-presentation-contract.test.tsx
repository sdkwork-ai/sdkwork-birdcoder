import assert from "node:assert/strict";
import fs from "node:fs";

import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import type { AgentSessionItemToolCallView, AgentSessionItemView } from "../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-contracts-commons/src/agent-session-view.ts";
import { resolveAgentSessionItemPresentation } from "../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-contracts-commons/src/agent-session-item-presentation.ts";
import { AGENT_SESSION_ITEM_TOOL_PROTOCOL_ADAPTER_ID_BY_ENGINE, resolvePreferredAgentSessionItemToolProtocolAdapterId } from "../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-contracts-commons/src/agent-session-item-tool-calls.ts";
import { ChatTranscriptAnchorRail } from "../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-ui/src/components/ChatTranscriptAnchorRail.tsx";
import { UniversalChatMarkdown } from "../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-ui/src/components/UniversalChatMarkdown.tsx";
import { resolveChatCodeFenceLanguage } from "../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-ui/src/components/chatMarkdownHeuristics.ts";
import { TurnFileChangesCard } from "../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-ui/src/components/chat/messages/activity/TurnFileChangesCard.tsx";
import { resolveTurnFileChangesMessagePresentations } from "../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-ui/src/components/chat/messages/activity/turnFileChanges.ts";
import { UserMessageAttachments } from "../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-ui/src/components/chat/messages/UserMessageAttachments.tsx";
import { resolveUserMessageDisplay } from "../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-ui/src/components/chat/messages/userMessageDisplay.ts";
import type { ChatMessageRenderContext } from "../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-ui/src/components/chat/messages/types.ts";
import { ChatTurnActiveTail } from "../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-ui/src/components/chat/messages/renderers/ChatTurnActiveTail.tsx";
import { ContextToolCallGroup } from "../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-ui/src/components/chat/messages/contentBlocks/ContextToolCallGroup.tsx";
import { groupToolCallsForPresentation } from "../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-ui/src/components/chat/messages/contentBlocks/toolCallPresentation.ts";
import {
  CHAT_PROVIDER_PRESENTATION_PROFILES,
  OPENCODE_ALIGNED_CHAT_TRANSCRIPT_POLICY,
  resolveChatProviderPresentationProfile,
} from "../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-ui/src/components/chat/messages/presentation/providerPresentationProfiles.ts";

assert.deepEqual(
  CHAT_PROVIDER_PRESENTATION_PROFILES.map((profile) => profile.engineId),
  ["codex", "claude-code", "opencode", "gemini"],
  "Every supported coding provider must participate in the shared transcript contract.",
);
for (const profile of CHAT_PROVIDER_PRESENTATION_PROFILES) {
  assert.strictEqual(
    profile.presentation,
    OPENCODE_ALIGNED_CHAT_TRANSCRIPT_POLICY,
    "Provider identity must not fork the shared transcript presentation policy.",
  );
  assert.equal(profile.presentation.transcriptStyle, "opencode-aligned");
  assert.deepEqual(profile.presentation.activityPresentation, {
    lifecycle: "inline",
    reasoning: "summary-disclosure",
    tools: "compact-disclosure",
  });
  assert.equal(
    profile.protocolAdapterId,
    resolvePreferredAgentSessionItemToolProtocolAdapterId(profile.engineId),
    "UI provider profiles must consume the contracts-owned protocol mapping.",
  );
  const activeTailHtml = renderToStaticMarkup(
    <ChatTurnActiveTail layout="main" providerProfile={profile} />,
  );
  assert.match(activeTailHtml, new RegExp(`data-chat-engine="${profile.engineId}"`, "u"));
  assert.match(activeTailHtml, />Working</u);
  assert.doesNotMatch(
    activeTailHtml,
    new RegExp(`${profile.surfaceLabel} is working`, "u"),
    "Active turns must use one localized working state instead of provider-specific visual copy.",
  );
}
assert.deepEqual(AGENT_SESSION_ITEM_TOOL_PROTOCOL_ADAPTER_ID_BY_ENGINE, {
  "claude-code": "claude.content-block",
  codex: "codex.item",
  gemini: "gemini.event",
  opencode: "opencode.part",
});
assert.equal(resolveChatProviderPresentationProfile(" CODEX ")?.engineId, "codex");
assert.equal(resolveChatProviderPresentationProfile("gemini-cli")?.engineId, "gemini");
assert.equal(resolveChatProviderPresentationProfile("open-code")?.engineId, "opencode");
assert.equal(resolveChatProviderPresentationProfile("openai-codex")?.engineId, "codex");
assert.equal(resolveChatProviderPresentationProfile("unknown"), undefined);

const localizedActiveTailHtml = renderToStaticMarkup(
  <ChatTurnActiveTail
    layout="main"
    providerProfile={CHAT_PROVIDER_PRESENTATION_PROFILES[0]}
    t={(key) => key === "chat.providerWorking" ? "\u6b63\u5728\u5904\u7406" : key}
  />,
);
assert.match(localizedActiveTailHtml, />\u6b63\u5728\u5904\u7406</u);

function createToolCall(
  id: string,
  name: string,
  kind: AgentSessionItemToolCallView["kind"],
  argumentsText = "{}",
): AgentSessionItemToolCallView {
  return {
    arguments: argumentsText,
    id,
    kind,
    name,
    status: "success",
    type: "tool",
  };
}

const groupedToolCalls = groupToolCallsForPresentation([
  createToolCall("read-1", "Read", "file", '{"path":"src/App.tsx"}'),
  createToolCall("grep-1", "grep_search", "search", '{"pattern":"ContextToolCallGroup"}'),
  createToolCall("edit-1", "replace", "file"),
  createToolCall("list-1", "list_directory", "search"),
  createToolCall("mcp-read-1", "read_file", "mcp"),
]);
assert.deepEqual(
  groupedToolCalls.map((item) => item.type === "context"
    ? { ids: item.calls.map((call) => call.id), type: item.type }
    : { id: item.call.id, type: item.type }),
  [
    { ids: ["read-1", "grep-1"], type: "context" },
    { id: "edit-1", type: "call" },
    { ids: ["list-1"], type: "context" },
    { id: "mcp-read-1", type: "call" },
  ],
  "Only consecutive provider-native read/search/list tools may share the OpenCode-aligned context group.",
);
const firstContextGroup = groupedToolCalls[0];
assert.ok(firstContextGroup && firstContextGroup.type === "context");
assert.deepEqual(firstContextGroup.summary, { list: 0, read: 1, search: 1 });
const collapsedContextGroupHtml = renderToStaticMarkup(
  <ContextToolCallGroup
    compact={false}
    copyMessageToClipboard={() => undefined}
    disclosureScopeKey="session\u0001turn\u0001tool"
    expandedDisclosureKeys={new Set()}
    group={firstContextGroup}
    isExpanded={false}
    onToggle={() => undefined}
    toggleDisclosure={() => undefined}
  />,
);
assert.match(collapsedContextGroupHtml, /data-chat-context-tool-group="true"/u);
assert.match(collapsedContextGroupHtml, /Gathered context/u);
assert.match(collapsedContextGroupHtml, /1 read/u);
assert.match(collapsedContextGroupHtml, /1 search/u);
assert.doesNotMatch(collapsedContextGroupHtml, /data-chat-tool-kind=/u);
const expandedContextGroupHtml = renderToStaticMarkup(
  <ContextToolCallGroup
    compact={false}
    copyMessageToClipboard={() => undefined}
    disclosureScopeKey="session\u0001turn\u0001tool"
    expandedDisclosureKeys={new Set()}
    group={firstContextGroup}
    isExpanded
    onToggle={() => undefined}
    toggleDisclosure={() => undefined}
  />,
);
assert.equal(
  [...expandedContextGroupHtml.matchAll(/data-chat-tool-kind=/gu)].length,
  2,
  "Expanded context groups must reuse one full ToolCallCard per normalized provider call.",
);
assert.match(expandedContextGroupHtml, />Read<\/span><span[^>]*>path:/u);
assert.match(expandedContextGroupHtml, />Search<\/span><span[^>]*>pattern:/u);
assert.doesNotMatch(expandedContextGroupHtml, />File operation<\/span><span[^>]*>Read/u);

const activitySummarySource = fs.readFileSync(
  new URL(
    "../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-ui/src/components/chat/messages/activity/ChatActivitySummary.tsx",
    import.meta.url,
  ),
  "utf8",
);
const disclosurePresentationSource = fs.readFileSync(
  new URL(
    "../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-ui/src/components/chat/messages/revealChatDisclosureDetails.ts",
    import.meta.url,
  ),
  "utf8",
);

assert.match(
  `${activitySummarySource}\n${disclosurePresentationSource}`,
  /function revealChatDisclosureDetails\([\s\S]*scrollIntoView\(\{[\s\S]*block: 'nearest'/,
  "Expanded disclosure details must be scrolled into the nearest visible transcript area.",
);

const markdown = [
  "| Check | Result |",
  "| --- | --- |",
  "| TypeScript | Passed |",
  "",
  "- [x] Render the completed item",
  "- [ ] Preserve the pending item",
  "",
  "This result is ~~obsolete~~ current.",
  "",
  "Open [the package manifest](./package.json#L12).",
].join("\n");

const markdownHtml = renderToStaticMarkup(
  <UniversalChatMarkdown
    content={markdown}
    mode="basic"
    onOpenFile={() => undefined}
    openFileLabel="Open file in editor"
  />,
);

assert.match(
  markdownHtml,
  /data-chat-markdown-table="true"[\s\S]*<table/u,
  "GFM tables must render as scrollable semantic tables.",
);
assert.doesNotMatch(
  markdownHtml,
  /min-w-\[28rem\]/u,
  "Simple GFM tables must not force a horizontal scrollbar in narrow conversations.",
);
assert.match(
  markdownHtml,
  /<input[^>]*type="checkbox"[^>]*disabled/u,
  "GFM task-list checkboxes must render as non-interactive transcript state.",
);
assert.match(
  markdownHtml,
  /<ul class="my-3 flex list-none flex-col gap-1 pl-0 contains-task-list">/u,
  "GFM task lists must use compact spacing without duplicate list markers.",
);
assert.match(
  markdownHtml,
  /<li class="my-0 flex list-none items-start gap-2 pl-0 before:hidden marker:hidden task-list-item">/u,
  "Each GFM task row must align its checkbox and content without prose list spacing.",
);
assert.match(
  markdownHtml,
  /<del>obsolete<\/del>/u,
  "GFM strikethrough must render semantically.",
);
assert.match(
  markdownHtml,
  /data-chat-markdown-file-link="true"[\s\S]*package manifest/u,
  "Local Markdown links must render as editor file controls.",
);
assert.match(
  markdownHtml,
  /aria-label="Open file in editor: \.\/package\.json"/u,
  "Local Markdown file controls must expose the normalized editor target.",
);

assert.equal(
  resolveChatCodeFenceLanguage("language-shell-session"),
  "shell-session",
);
assert.equal(resolveChatCodeFenceLanguage("token language-c++ extra"), "c++");
assert.equal(resolveChatCodeFenceLanguage("language-csharp"), "csharp");
assert.equal(resolveChatCodeFenceLanguage(undefined), "");

const firstImageSource =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9ZQmcAAAAASUVORK5CYII=";
const secondImageSource =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";
const userAttachmentView = resolveAgentSessionItemPresentation({
  id: "user-attachments",
  sessionId: "message-presentation-session",
  role: "user",
  content: [
    "Please inspect these attachments.",
    "",
    `![first screenshot](${firstImageSource})`,
    `![second screenshot](${secondImageSource})`,
    "",
    '[DRIVE_MEDIA:{"id":"drive-file","kind":"document","fileName":"notes.txt","mimeType":"text/plain","uri":"drive://nodes/drive-file","previewUrl":"https://example.test/preview/drive-file"}]',
    "",
    "File: notes.txt",
    "```text",
    "This payload is model context and must not be visible in the message bubble.",
    "```",
  ].join("\n"),
  resources: [
    {
      id: "duplicate-first-image",
      kind: "image",
      name: "duplicate.png",
      mediaSource: firstImageSource,
      mimeType: "image/png",
    },
    {
      id: "drive-file",
      kind: "file",
      name: "notes.txt",
      uri: "drive://nodes/drive-file",
      mimeType: "text/plain",
    },
    {
      id: "fresh-drive-file",
      kind: "file",
      name: "fresh-notes.txt",
      uri: "drive://nodes/fresh-drive-file",
      mimeType: "text/plain",
    },
    {
      id: "local-file",
      kind: "file",
      name: "local.ts",
      path: "src/local.ts",
      mimeType: "text/typescript",
    },
    {
      id: "image-without-preview",
      kind: "image",
      name: "unavailable.png",
      mimeType: "image/png",
    },
  ],
  createdAt: "2026-07-27T00:00:00.000Z",
});
const userAttachmentDisplay = resolveUserMessageDisplay(userAttachmentView);
assert.equal(userAttachmentDisplay.imageAttachments.length, 2);
assert.deepEqual(
  userAttachmentDisplay.imageAttachments.map((image) => image.title),
  ["first screenshot", "second screenshot"],
  "Markdown and structured image resources must preserve image order without duplicate previews.",
);
assert.deepEqual(
  userAttachmentDisplay.fileAttachments.map((file) => file.title),
  ["notes.txt", "fresh-notes.txt", "local.ts", "unavailable.png"],
  "Drive files, local files, and images without a preview source must remain visible without duplicate attachments.",
);
assert.equal(
  userAttachmentDisplay.fileAttachments[0]?.externalUrl,
  "https://example.test/preview/drive-file",
  "Duplicate Drive resources must preserve the richer preview URL from the message marker.",
);
assert.equal(userAttachmentDisplay.textBlocks.length, 1);
assert.equal(
  userAttachmentDisplay.textBlocks[0]?.type === "markdown"
    ? userAttachmentDisplay.textBlocks[0].content
    : "",
  "Please inspect these attachments.",
  "Image syntax, Drive markers, and uploaded file payloads must not leak into the text bubble.",
);
const attachmentContext = {
  environment: {
    onOpenFile: () => undefined,
    onOpenDriveAttachment: () => undefined,
    t: (key: string) =>
      ({
        "chat.closeImagePreview": "Close image preview",
        "chat.messageImages": "Message images",
        "chat.messageResources": "Message resources",
        "chat.openFileInEditor": "Open file in editor",
        "chat.previewFile": "Preview file",
        "chat.previewImage": "Preview image",
      })[key] ?? key,
  },
} as ChatMessageRenderContext;
const userAttachmentsHtml = renderToStaticMarkup(
  <UserMessageAttachments
    context={attachmentContext}
    files={userAttachmentDisplay.fileAttachments}
    images={userAttachmentDisplay.imageAttachments}
  />,
);
assert.equal(
  [...userAttachmentsHtml.matchAll(/data-chat-user-image="true"/gu)].length,
  2,
);
assert.equal(
  [...userAttachmentsHtml.matchAll(/data-chat-user-file-attachment="true"/gu)]
    .length,
  4,
);
assert.match(
  userAttachmentsHtml,
  /<ul[^>]*aria-label="Message images"[\s\S]*<li[^>]*>[\s\S]*<button[^>]*data-chat-user-image="true"/u,
  "Image collections must preserve native button semantics inside semantic list items.",
);
assert.match(
  userAttachmentsHtml,
  /<ul[^>]*aria-label="Message resources"[\s\S]*<li[^>]*>[\s\S]*<a[^>]*data-chat-user-file-attachment="true"/u,
  "Previewable files must preserve native link semantics inside semantic list items.",
);
assert.ok(
  userAttachmentsHtml.indexOf('data-chat-user-image-grid="true"') <
    userAttachmentsHtml.indexOf('data-chat-user-file-list="true"'),
  "User image previews must render before file attachments.",
);
assert.match(
  userAttachmentsHtml,
  /href="https:\/\/example\.test\/preview\/drive-file"/u,
);
assert.match(
  userAttachmentsHtml,
  /aria-label="Preview file: fresh-notes\.txt"/u,
);
assert.match(
  userAttachmentsHtml,
  /aria-label="Open file in editor: src\/local\.ts"/u,
);

function createMessage(
  id: string,
  role: AgentSessionItemView["role"],
  content: string,
): AgentSessionItemView {
  return {
    id,
    sessionId: "message-presentation-session",
    role,
    content,
    createdAt: "2026-07-27T00:00:00.000Z",
  };
}

const twoTurns = [
  createMessage("user-1", "user", "First turn"),
  createMessage("assistant-1", "assistant", "First response"),
  createMessage("user-2", "user", "Second turn"),
];
const twoTurnRailHtml = renderToStaticMarkup(
  <ChatTranscriptAnchorRail
    label="Conversation map"
    messages={twoTurns}
    onSelectTurn={() => undefined}
    turnLabel="Go to conversation turn"
  />,
);

assert.equal(
  twoTurnRailHtml,
  "",
  "Short conversations must not reserve space for a conversation map.",
);

const threeTurnRailHtml = renderToStaticMarkup(
  <ChatTranscriptAnchorRail
    label="Conversation map"
    messages={[
      ...twoTurns,
      createMessage("assistant-2", "assistant", "Second response"),
      createMessage("user-3", "user", "Third turn"),
    ]}
    onSelectTurn={() => undefined}
    turnLabel="Go to conversation turn"
  />,
);

assert.match(threeTurnRailHtml, /data-chat-transcript-anchor-rail="true"/u);
assert.match(threeTurnRailHtml, /aria-label="Conversation map"/u);
assert.match(
  threeTurnRailHtml,
  /aria-label="Go to conversation turn 3: Third turn"/u,
);

const turnFileChanges = Array.from({ length: 5 }, (_, index) => ({
  path: `src/messages/file-${index + 1}.tsx`,
  additions: index + 1,
  deletions: 1,
  originalContent: `before ${index + 1}`,
  content: `after ${index + 1}`,
}));
const fileChangeTurn: AgentSessionItemView[] = [
  {
    ...createMessage("file-user", "user", "Update the message view"),
    turnId: "file-turn",
  },
  {
    ...createMessage("file-tool", "tool", ""),
    turnId: "file-turn",
    fileChanges: turnFileChanges,
  },
  {
    ...createMessage(
      "file-assistant",
      "assistant",
      "The message view is updated.",
    ),
    turnId: "file-turn",
  },
];
const completedTurnPresentations =
  resolveTurnFileChangesMessagePresentations(fileChangeTurn);
assert.equal(completedTurnPresentations[1]?.suppressInlineFileChanges, true);
assert.equal(completedTurnPresentations[2]?.card?.fileChanges.length, 5);
assert.equal(completedTurnPresentations[2]?.card?.messageId, "file-assistant");

const twoCompletedFileChangeTurns: AgentSessionItemView[] = [
  {
    ...createMessage("multi-user-1", "user", "Update the first file"),
    turnId: "multi-turn-1",
  },
  {
    ...createMessage("multi-tool-1", "tool", ""),
    turnId: "multi-turn-1",
    fileChanges: [turnFileChanges[0]!],
  },
  {
    ...createMessage(
      "multi-assistant-1",
      "assistant",
      "The first file is updated.",
    ),
    turnId: "multi-turn-1",
  },
  {
    ...createMessage("multi-user-2", "user", "Update the second file"),
    turnId: "multi-turn-2",
  },
  {
    ...createMessage("multi-tool-2", "tool", ""),
    turnId: "multi-turn-2",
    fileChanges: [turnFileChanges[1]!],
  },
  {
    ...createMessage(
      "multi-assistant-2",
      "assistant",
      "The second file is updated.",
    ),
    turnId: "multi-turn-2",
  },
];
const twoCompletedTurnPresentations =
  resolveTurnFileChangesMessagePresentations(twoCompletedFileChangeTurns);
assert.deepEqual(
  twoCompletedTurnPresentations.flatMap((presentation) =>
    presentation.card?.messageId ? [presentation.card.messageId] : [],
  ),
  ["multi-assistant-1", "multi-assistant-2"],
  "Every completed turn with file changes must receive its own summary card.",
);

const fallbackTurnPresentations = resolveTurnFileChangesMessagePresentations([
  createMessage("fallback-user-1", "user", "Update the first fallback file"),
  {
    ...createMessage("fallback-tool-1", "tool", ""),
    fileChanges: [turnFileChanges[0]!],
  },
  createMessage(
    "fallback-assistant-1",
    "assistant",
    "The first fallback file is updated.",
  ),
  createMessage("fallback-user-2", "user", "Update the second fallback file"),
  {
    ...createMessage("fallback-tool-2", "tool", ""),
    fileChanges: [turnFileChanges[1]!],
  },
  createMessage(
    "fallback-assistant-2",
    "assistant",
    "The second fallback file is updated.",
  ),
]);
assert.deepEqual(
  fallbackTurnPresentations.flatMap((presentation) =>
    presentation.card?.messageId ? [presentation.card.messageId] : [],
  ),
  ["fallback-assistant-1", "fallback-assistant-2"],
  "User-message epochs must preserve one file summary per turn when turn ids are unavailable.",
);

const activityOnlyTurnPresentations =
  resolveTurnFileChangesMessagePresentations([
    {
      ...createMessage("activity-only-user", "user", "Apply the file update"),
      turnId: "activity-only-turn",
    },
    {
      ...createMessage("activity-only-tool", "tool", ""),
      turnId: "activity-only-turn",
      fileChanges: [turnFileChanges[0]!],
    },
    {
      ...createMessage("activity-only-assistant", "assistant", ""),
      turnId: "activity-only-turn",
    },
  ]);
assert.equal(
  activityOnlyTurnPresentations[2]?.card?.messageId,
  "activity-only-assistant",
  "A completed authored reply must receive the file summary even without visible Markdown.",
);

const liveTurnPresentations = resolveTurnFileChangesMessagePresentations(
  fileChangeTurn,
  {
    deferLatestTurn: true,
  },
);
assert.equal(
  liveTurnPresentations.some((presentation) => presentation.card),
  false,
);
assert.equal(
  liveTurnPresentations.some(
    (presentation) => presentation.suppressInlineFileChanges,
  ),
  false,
);

const fileChangesPresentation = completedTurnPresentations[2]?.card;
assert.ok(fileChangesPresentation);
const cardEnvironment = {
  addToast: () => undefined,
  onOpenFile: () => undefined,
  onRestore: () => undefined,
  onViewChanges: () => undefined,
  skills: [],
  t: (key: string, options?: Record<string, unknown>) => {
    if (key === "chat.editedFilesSummary") {
      return `Edited ${String(options?.count)} files`;
    }
    if (key === "chat.showMoreFiles") {
      return `Show ${String(options?.count)} more files`;
    }
    const labels: Record<string, string> = {
      "chat.changedLinesUnknown": "Line impact not captured",
      "chat.openFileInEditor": "Open file in editor",
      "chat.reviewChanges": "Review",
      "chat.showFewerFiles": "Show fewer files",
      "chat.undoChanges": "Undo",
    };
    return labels[key] ?? key;
  },
};
const collapsedFileCardHtml = renderToStaticMarkup(
  <TurnFileChangesCard
    environment={cardEnvironment}
    expandedDisclosureKeys={new Set()}
    presentation={fileChangesPresentation}
    toggleDisclosure={() => undefined}
  />,
);
assert.equal(
  [...collapsedFileCardHtml.matchAll(/data-chat-file-change-row="turn-card"/gu)]
    .length,
  3,
);
assert.match(collapsedFileCardHtml, /Edited 5 files/u);
assert.match(collapsedFileCardHtml, /\+15/u);
assert.match(collapsedFileCardHtml, /-5/u);
assert.match(collapsedFileCardHtml, /Show 2 more files/u);
assert.match(collapsedFileCardHtml, /data-chat-turn-file-undo="true"/u);
assert.match(collapsedFileCardHtml, /data-chat-turn-file-review="true"/u);

const expandedFileCardHtml = renderToStaticMarkup(
  <TurnFileChangesCard
    environment={cardEnvironment}
    expandedDisclosureKeys={
      new Set([`${fileChangesPresentation.scopeKey}\u0001turn-file-changes`])
    }
    presentation={fileChangesPresentation}
    toggleDisclosure={() => undefined}
  />,
);
assert.equal(
  [...expandedFileCardHtml.matchAll(/data-chat-file-change-row="turn-card"/gu)]
    .length,
  5,
);
assert.match(expandedFileCardHtml, /Show fewer files/u);

console.log("universal chat message presentation contract passed.");
