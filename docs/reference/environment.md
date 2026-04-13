# Environment

BirdCoder keeps release-time configuration explicit and machine-readable.

## Common release variables

- `SDKWORK_RELEASE_TAG`
- `SDKWORK_RELEASE_OUTPUT_DIR`
- `SDKWORK_RELEASE_ASSETS_DIR`
- `SDKWORK_RELEASE_PLATFORM`
- `SDKWORK_RELEASE_ARCH`
- `SDKWORK_RELEASE_TARGET`
- `SDKWORK_RELEASE_ACCELERATOR`
- `SDKWORK_RELEASE_IMAGE_REPOSITORY`
- `SDKWORK_RELEASE_IMAGE_TAG`
- `SDKWORK_RELEASE_IMAGE_DIGEST`

## Guidance

Use workspace defaults for normal development. Override these variables only when you need to package or verify a specific release slice.
