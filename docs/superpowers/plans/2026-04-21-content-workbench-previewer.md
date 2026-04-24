# Content Workbench Previewer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a reusable content workbench for the code view that supports editing, previewing, and split-view rendering for HTML, Markdown, and plain-text content.

**Architecture:** Add generic UI-layer content primitives in `@sdkwork/birdcoder-ui`, then wire the code-view editor surface to consume the new workbench instead of directly embedding the Monaco editor. Keep preview strategy resolution isolated from page logic so preview capabilities stay reusable and easy to extend.

**Tech Stack:** React, TypeScript, Monaco, React Markdown, Tailwind utility classes

---

### Task 1: Add reusable content primitives

**Files:**
- Create: `packages/sdkwork-birdcoder-ui/src/components/ContentEditor.tsx`
- Create: `packages/sdkwork-birdcoder-ui/src/components/ContentPreviewer.tsx`
- Create: `packages/sdkwork-birdcoder-ui/src/components/ContentMarkdownPreview.tsx`
- Create: `packages/sdkwork-birdcoder-ui/src/components/contentPreview.ts`
- Modify: `packages/sdkwork-birdcoder-ui/src/components/CodeEditor.tsx`
- Modify: `packages/sdkwork-birdcoder-ui/src/editors.ts`
- Modify: `packages/sdkwork-birdcoder-ui/src/index.ts`

- [ ] Extract Monaco text editing into a generic `ContentEditor`.
- [ ] Add preview-kind resolution and preview document helpers.
- [ ] Implement `ContentPreviewer` with HTML iframe preview, Markdown preview, and plain-text fallback.
- [ ] Keep `CodeEditor` as a thin wrapper over `ContentEditor`.
- [ ] Export the new components from the UI package.

### Task 2: Add reusable content workbench composition

**Files:**
- Create: `packages/sdkwork-birdcoder-ui/src/components/ContentWorkbench.tsx`
- Modify: `packages/sdkwork-birdcoder-ui/src/editors.ts`
- Modify: `packages/sdkwork-birdcoder-ui/src/index.ts`

- [ ] Add a reusable workbench shell that supports `edit`, `preview`, and `split` modes.
- [ ] Make split mode responsive so narrow widths stack vertically.
- [ ] Keep the workbench configurable through props instead of code-view-specific state.

### Task 3: Wire the code view to the new workbench

**Files:**
- Modify: `packages/sdkwork-birdcoder-code/src/pages/CodeEditorSurface.tsx`

- [ ] Replace direct `CodeEditor` usage with `ContentWorkbench`.
- [ ] Preserve the existing diff flow and file-tab header behavior.
- [ ] Enable live preview for selected files without coupling page logic to preview internals.

### Task 4: Verify the integration

**Files:**
- Modify if needed: `scripts/*` only if a focused contract is required by the implementation

- [ ] Run focused existing verification for code-view component behavior and editor integration.
- [ ] Run one direct UI-layer verification path for the new preview capability.
