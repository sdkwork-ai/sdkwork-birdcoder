# SDKWork Birdcoder Flutter Mobile Application

<!-- SDKWORK-AGENTS-GENERATED: v1 -->

## SDKWORK Soul

Read `../../sdkwork-specs/SOUL.md` before executing tasks in this root. Follow specs before memory, dictionary before context, stop on ambiguity, and evidence before completion.

## SDKWORK Standards

Canonical SDKWORK specs path from this root:

- `../../sdkwork-specs/README.md`
- `../../sdkwork-specs/SOUL.md`
- `../../sdkwork-specs/AGENTS_SPEC.md`
- `../../sdkwork-specs/FLUTTER_APP_MOBILE_ARCHITECTURE_SPEC.md`
- `../../sdkwork-specs/APP_FLUTTER_UI_SPEC.md`

Do not copy root standard text into this application. If these relative paths do not resolve, stop and report the broken workspace layout.

## Application Identity

This is the Flutter mobile application root for sdkwork-birdcoder. It supports:
- iOS native mode
- Android native mode

Read `sdkwork.app.config.json` before changing application behavior.

## Local Dictionary Structure

- `lib/`: Root shell entry (main.dart, app.dart, auth_gate.dart, bootstrap/)
- `packages/`: Flutter-specific packages (snake_case naming)
- `sdks/`: SDK families and generation manifests
- `specs/`: Component specs
- `config/`: Runtime config templates (app/host/server/container)
- `scripts/`: App-specific build/validation scripts
- `test/`: App-level integration tests
- `pubspec.yaml`: Flutter/Dart package manifest

## Spec Resolution Order

1. Read this `AGENTS.md` and any nearer component-level `AGENTS.md`.
2. Read `sdkwork.app.config.json` when present.
3. Read local `specs/README.md` and `specs/component.spec.json` when present.
4. Read `../../sdkwork-specs/README.md` and the task-specific root specs.
5. Inspect implementation files only after the relevant dictionary entries are clear.

## Build, Test, and Development

- `flutter run`: Run on connected device
- `flutter build apk`: Build Android APK
- `flutter build ios`: Build iOS app
- `flutter analyze`: Run Dart analysis
- `flutter test`: Run tests
