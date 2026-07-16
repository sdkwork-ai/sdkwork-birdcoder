# SDKWork BirdCoder Flutter Mobile SDKs

This directory contains SDK consumer workspaces and generation manifests for the Flutter mobile
application. Surface composition is declared in `specs/component.spec.json`. Each Dart consumer SDK
family declares its generation metadata in its own `sdk-manifest.json`.

## Expected Structure

```text
sdks/
  README.md
  specs/
    component.spec.json
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
