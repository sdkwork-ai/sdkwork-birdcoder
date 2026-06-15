# SDKWork BirdCoder Flutter Mobile SDKs

This directory contains SDK family workspaces and generation manifests for the Flutter mobile application.

## SDK Families

No SDK families have been generated yet. SDK families will be created here following `SDK_WORKSPACE_GENERATION_SPEC.md`.

## Expected Structure

```
sdks/
  .sdkwork-assembly.json
  README.md
  specs/
    component.spec.json
    domain-catalog.json
    openapi/
  sdkwork_birdcoder_flutter_mobile_app_sdk/
    sdkwork_birdcoder_flutter_mobile_app_sdk_dart/
  sdkwork_birdcoder_flutter_mobile_backend_sdk/
    sdkwork_birdcoder_flutter_mobile_backend_sdk_dart/
```

## Generation

To generate Dart SDK families, run:
```bash
flutter pub run build_runner build
```
