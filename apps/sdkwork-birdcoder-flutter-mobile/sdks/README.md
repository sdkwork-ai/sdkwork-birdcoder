# SDKWork BirdCoder Flutter Mobile SDKs

This directory contains SDK family workspaces and generation manifests for the Flutter mobile application.

## SDK Families

Surface composition is declared in the root `.sdkwork-assembly.json`. Each Dart consumer SDK family declares its generation metadata in its own `sdk-manifest.json` under `sdks/sdkwork_birdcoder_flutter_mobile_*_sdk_consumer/`.

## Expected Structure

```
sdks/
  .sdkwork-assembly.json
  README.md
  specs/
    component.spec.json
    domain-catalog.json
    openapi/
  sdkwork_birdcoder_flutter_mobile_app_sdk_consumer/
    sdk-manifest.json
    generated/server-openapi/
    lib/
  sdkwork_birdcoder_flutter_mobile_backend_sdk_consumer/
    sdk-manifest.json
    generated/server-openapi/
    lib/
```

## Generation

To generate Dart SDK families, run:
```bash
flutter pub run build_runner build
```
