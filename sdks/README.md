# BirdCoder SDKs

`sdks/` contains the one BirdCoder-owned App SDK family. Authored OpenAPI and
SDK-family manifests live at the family root; language-specific generated
transports are derived output.

| SDK family | API plane | Owned operations |
| --- | --- | ---: |
| [`sdkwork-birdcoder-app-sdk`](sdkwork-birdcoder-app-sdk/README.md) | App API | 4 |

BirdCoder has no Backend SDK family and no Open SDK family because it owns zero
operations on those planes.

Project, composition, Session, Skill, IAM, Drive, and Document consumers must
import their owner SDK families. A separately enabled human messaging consumer
must import the IM SDK. None of these capabilities are re-exported as
BirdCoder domain operations or copied into this workspace.

## Source And Generated Boundaries

- `openapi/` contains the materialized BirdCoder App API authority.
- `sdk-manifest.json` declares SDK ownership and generation inputs.
- `sdkwork-birdcoder-app-sdk-*/generated/` is generated and never hand-edited.
- Language family facades may expose approved generated exports without
  implementing a second transport.

## Verification

```bash
pnpm sdk:generate
pnpm check:sdk-family-standard
pnpm check:sdk-family-generated
```

Run generation twice when validating reproducibility; the second run must
produce no new source diff.
