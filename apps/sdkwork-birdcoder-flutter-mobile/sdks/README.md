# SDKWork BirdCoder Flutter Mobile SDKs

This directory contains SDK family workspaces and generation manifests for the Flutter mobile application.

## SDK Families

Consumer SDK assembly is declared in `.sdkwork-assembly.json`. Dart consumer packages live under `sdks/sdkwork_birdcoder_flutter_mobile_*_sdk_consumer/` until OpenAPI Dart generation replaces the explicit pending markers.

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
