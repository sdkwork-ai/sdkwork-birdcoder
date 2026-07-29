# REQ-2026-0005 PC Appearance Settings

Status: in-progress
Owner: SDKWork maintainers
Source: customer
Priority: P1
Updated: 2026-07-29
Specs: REQUIREMENTS_SPEC.md, APP_PC_ARCHITECTURE_SPEC.md, APP_PC_REACT_UI_SPEC.md, FRONTEND_SPEC.md, UI_ARCHITECTURE_SPEC.md, TYPESCRIPT_CODE_SPEC.md, I18N_SPEC.md, TEST_SPEC.md

## Problem

BirdCoder PC persists an appearance model, but the Settings Center and much of
the workbench remain visually fixed to a dark palette. Several visible controls
write values that are not consumed by the shell or Monaco editors, and theme
import can partially mutate settings before discovering invalid input. This
makes the appearance page misleading and leaves light and system modes
incomplete.

## Required Outcome

- The PC application offers explicit light, dark, and follow-system modes.
- Follow-system mode reacts to operating-system color-scheme changes while the
  application is running.
- Theme colors, fonts, contrast, sidebar translucency, pointer behavior, UI and
  code sizes, line numbers, wrapping, and minimap preferences all affect their
  owned PC surfaces immediately and persist across reloads.
- The appearance surface uses SDKWork design tokens and semantic controls in
  both color modes.
- Theme presets, import, export, and reset are validated, atomic, and
  reversible.
- All appearance copy and accessible names are available in English and
  Simplified Chinese.

## Non-Goals

- Changing H5, Capacitor, Flutter, or other mobile appearance behavior.
- Adding cloud synchronization for local PC preferences.
- Reworking product areas unrelated to appearance compatibility.
- Replacing the existing canonical BirdCoder app-settings persistence owner.

## Acceptance Criteria

1. Light, dark, and system options are keyboard operable and update the full PC
   shell, Settings Center, and editor color scheme without a reload.
2. System mode uses the current OS preference and responds to media-query
   changes until the user chooses an explicit mode.
3. The selected theme mode and all appearance values survive a PC reload
   through the canonical `sdkwork-birdcoder.ui.v1:settings:app` state.
4. Accent, background, foreground, UI font, code font, contrast, and sidebar
   translucency apply to the active light or dark theme.
5. Pointer cursor, UI font size, code font size, line numbers, word wrap, and
   minimap controls affect their corresponding PC workbench and Monaco
   surfaces.
6. Theme presets and resets update related fields as one state transition.
7. Theme JSON import rejects malformed, unsupported, or invalid values without
   changing settings; exported JSON round-trips through the importer.
8. Every appearance label, description, status, toast, placeholder, action, and
   accessible name has matching `en-US` and `zh-CN` resources.
9. Switches, sliders, segmented choices, color fields, and the import dialog
   expose semantic keyboard and screen-reader behavior with visible focus.
10. The appearance layout remains usable without overlap or horizontal
    overflow at 1440x900 and 900x800 PC/tablet-sized viewports.
11. Focused theme/config tests, PC typecheck, i18n validation, architecture
    validation, production build, and browser interaction checks pass.

## Non-Functional Requirements

| Area | Requirement |
| --- | --- |
| Ownership | Canonical app settings remain owned by the PC workbench package; presentation remains in the PC settings package. |
| Reliability | Invalid imports are side-effect free and system listeners are detached when no longer used. |
| Accessibility | All controls have programmatic names, keyboard behavior, focus indication, and valid dialog semantics. |
| Internationalization | English and Simplified Chinese resources maintain key parity with no appearance fallback copy. |
| Performance | Theme changes update CSS variables and editor options without remounting the application shell. |
| Scope | Verification evidence comes from PC only; H5 and Flutter are unchanged. |

## Traceability

- [Product requirements](../prd/PRD.md)
- [PC product supplement](../../../apps/sdkwork-birdcoder-pc/docs/product/prd/PRD.md)
- [PC architecture supplement](../../../apps/sdkwork-birdcoder-pc/docs/architecture/tech/TECH_ARCHITECTURE.md)

## Verification

```bash
pnpm --dir apps/sdkwork-birdcoder-pc --filter @sdkwork/birdcoder-pc-workbench test -- appearanceTheme.test.ts
pnpm --dir apps/sdkwork-birdcoder-pc --filter @sdkwork/birdcoder-pc-settings typecheck
pnpm --dir apps/sdkwork-birdcoder-pc --filter @sdkwork/birdcoder-pc-ui typecheck
pnpm --dir apps/sdkwork-birdcoder-pc --filter @sdkwork/birdcoder-pc-shell typecheck
pnpm --dir apps/sdkwork-birdcoder-pc typecheck
node ../sdkwork-specs/tools/check-i18n-standard.mjs --root .
node ../sdkwork-specs/tools/check-application-layering.mjs --root .
pnpm --dir apps/sdkwork-birdcoder-pc build
```
