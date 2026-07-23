# SDKWork BirdCoder Flutter Mobile SDKs

This directory contains the owner-only BirdCoder App API consumer workspace and its generation
manifest for the Flutter mobile application. Surface composition is declared in
`specs/component.spec.json`; the Dart consumer declares its source authority and generated output in
its own `sdk-manifest.json`.

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
```

BirdCoder does not own a Backend API or Open API, so this application must not create Flutter
consumers for those surfaces. IAM and AI session capabilities are consumed directly from the
canonical IAM and Agents App SDK packages by the mobile core composition layer. Agents owns
Session, Turn, Session Item, Interaction, Runtime Binding, Artifact, and Checkpoint facts; no
BirdCoder or IM transcript model is generated here.

## Generation

From the BirdCoder repository root, generate the Flutter App SDK consumer with:

```bash
pnpm sdk:generate:flutter-mobile
```

Verify the mobile SDK boundary with `node scripts/flutter-sdk-assembly-contract.test.mjs` and
`node scripts/flutter-mobile-sdk-generation-contract.test.mjs`.
