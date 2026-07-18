# SDKWork Birdcoder Flutter Mobile Application

<!-- SDKWORK-AGENTS-GENERATED: v1 -->

## SDKWORK Soul

Read `../../../sdkwork-specs/SOUL.md` before executing tasks in this root. Follow specs before memory, dictionary before context, stop on ambiguity, and evidence before completion.

## SDKWORK Standards


<!-- SDKWORK-PROGRESSIVE-LOADING: v1 -->
Resolve this standards root once and use it as the global authority for the current task:

- `../../../sdkwork-specs/README.md`
- `../../../sdkwork-specs/SOUL.md`
- `../../../sdkwork-specs/AGENTS_SPEC.md`

Read only the relevant README task-matrix row or navigation heading, then load the selected authority sections.
<!-- /SDKWORK-PROGRESSIVE-LOADING: v1 -->

Canonical SDKWORK specs path from this root:

- `../../../sdkwork-specs/README.md`
- `../../../sdkwork-specs/SOUL.md`
- `../../../sdkwork-specs/AGENTS_SPEC.md`
- `../../../sdkwork-specs/FLUTTER_APP_MOBILE_ARCHITECTURE_SPEC.md`
- `../../../sdkwork-specs/APP_FLUTTER_UI_SPEC.md`

Do not copy root standard text into this application. If these relative paths do not resolve, stop and report the broken workspace layout.

## Application Identity

This is the Flutter mobile application root for sdkwork-birdcoder. It supports:
- iOS native mode
- Android native mode

Read `../../sdkwork.app.config.json` before changing application behavior.

## Local Dictionary Structure

- `lib/`: Root shell entry (main.dart, app.dart, auth_gate.dart, bootstrap/)
- `packages/`: Flutter-specific packages (snake_case naming)
- `sdks/`: SDK families and generation manifests
- `specs/`: Component specs
- `config/`: Runtime config templates (app/host/server/container)
- `etc/`: Flutter source configuration and repository deployment-authority reference.
- `scripts/`: App-specific build/validation scripts
- `test/`: App-level integration tests
- `pubspec.yaml`: Flutter/Dart package manifest

## Required Specs By Task Type

Select only the current task authorities from `../../../sdkwork-specs/README.md` and `../../../sdkwork-specs/AGENTS_SPEC.md`; expand to adjacent specs only when a new contract boundary is reached.

## Code Style Rules

Use `../../../sdkwork-specs/CODE_STYLE_SPEC.md` and `../../../sdkwork-specs/NAMING_SPEC.md` for authored changes, then load only the language or framework authority touched by the current task.

## Build, Test, and Verification

<!-- SDKWORK-VERIFICATION-ROUTING: v1 -->
Choose only the narrowest verification selected by the changed surface. This is not a default full-suite command list.
Run workspace-wide checks only when the change crosses that boundary.
`bootstrap-*`, `align-*`, `sync-*`, `--write`, and other mutating repair commands are not verification defaults; use them only for an explicitly scoped repair, migration, bootstrap, or alignment task and inspect the resulting diff.
<!-- /SDKWORK-VERIFICATION-ROUTING: v1 -->

## Agent Execution Rules

<!-- SDKWORK-PROGRESSIVE-LOADING: v1 -->
Use dynamic progressive loading for the current task; treat indexes and cross-references as discovery, not as a startup bundle.
Keep `../../../sdkwork-specs/SOUL.md` and the task-selected standards authoritative; expand context only when evidence exposes a new contract boundary.
Language-specific specs are on-demand: only the touched language loads `../../../sdkwork-specs/RUST_CODE_SPEC.md`, `../../../sdkwork-specs/JAVA_CODE_SPEC.md`, `../../../sdkwork-specs/TYPESCRIPT_CODE_SPEC.md`, or `../../../sdkwork-specs/FRONTEND_CODE_SPEC.md`.
Package command standardization loads `../../../sdkwork-specs/PNPM_SCRIPT_SPEC.md` only when the current task changes package commands or scripts; GitHub packaging work loads `../../../sdkwork-specs/GITHUB_WORKFLOW_SPEC.md` only when it reaches that workflow boundary.
Do not infer a recursive workspace scan or a broad validation suite from the presence of a path alone.
<!-- /SDKWORK-PROGRESSIVE-LOADING: v1 -->

## Spec Resolution Order


<!-- SDKWORK-PROGRESSIVE-LOADING: v1 -->
Use dynamic progressive loading for the current task: resolve the selected root and task category before reading broad source context.

1. Read this `AGENTS.md` routing material and classify the owned surface.
2. Read `sdkwork.app.config.json`, module `specs/`, repository/application `specs/`, and `.sdkwork/` only when the task reaches the contract each item governs.
3. Locate only the relevant task-matrix row or navigation heading in `../../../sdkwork-specs/README.md`; do not load the full catalog.
4. Read only the task-specific global spec sections selected by that route, then inspect implementation files.
<!-- /SDKWORK-PROGRESSIVE-LOADING: v1 -->

1. Read this `AGENTS.md` and any nearer component-level `AGENTS.md`.
2. Read `../../sdkwork.app.config.json` when present.
3. Read local `specs/README.md` and `specs/component.spec.json` when present.
4. Read `../../../sdkwork-specs/README.md` and the task-specific root specs.
5. Inspect implementation files only after the relevant dictionary entries are clear.

## Build, Test, and Development

- `flutter run`: Run on connected device
- `flutter build apk`: Build Android APK
- `flutter build ios`: Build iOS app
- `flutter analyze`: Run Dart analysis
- `flutter test`: Run tests

## Task-Specific Standards

API work loads `../../../sdkwork-specs/API_SPEC.md` and its validators. List/search work loads `../../../sdkwork-specs/PAGINATION_SPEC.md` and `check-pagination.mjs`. Source configuration work loads `../../../sdkwork-specs/SOURCE_CONFIG_SPEC.md` and `check-source-config-standard.mjs`. Link these authorities instead of copying their normative bodies into `AGENTS.md`.

## Human Review Rules

Require human review for breaking standards, security exceptions, naming migrations, public contract changes, destructive operations, and changes that affect all repositories or application roots.
