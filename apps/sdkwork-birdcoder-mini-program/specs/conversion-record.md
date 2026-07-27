# H5 To Native WeChat Mini Program Conversion Record

## Round Scope

This round initializes the native WeChat Mini Program root. It establishes SDKWork package boundaries, route projection, runtime configuration, WeChat host adapters, session clearing contracts, a representative workbench page, and deterministic build output. It is not a complete H5 feature conversion.

| Source capability | Target placement | Alignment | SDK and host | State and IAM | Evidence and current gap |
| --- | --- | --- | --- | --- | --- |
| H5 route `app.im.chat.index`, `/`, `ChatPage` | `sdkwork-birdcoder-mp-workbench`; native projection `pages/__generated__/workbench/index` | Preserves route id and `route.chat` title key | Declares injected BirdCoder app SDK workbench port; WeChat APIs remain in `mp-host`/native wrapper | Loading, ready, empty, permission-denied, unavailable, error; mandatory session clearing reasons declared | Route/config/build tests. Full chat, Agents session, and visual parity remain unconverted. |
| H5 root runtime config | `sdkwork-birdcoder-mp-core` plus generated `config/mini-program/runtime-env.*.json` | Preserves `standalone/cloud × development/test/staging/production` | Public application and platform gateway URLs only | No tokens or secrets in checked-in config | Eight-profile config test and source-config validator. |
| Capacitor/browser host boundary | `sdkwork-birdcoder-mp-host/src/weixin` | Replaces browser/Capacitor facts with typed WeChat host facts | Typed storage, navigation, toast, and login-code ports | Login code is returned to the caller and is not logged or persisted | Static host-boundary scan. Additional camera, QR, media, share, push, lifecycle, and payment adapters are deferred until capabilities need them. |
| H5 SDK dependency intent | Root and core component specs | BirdCoder, Agents, IAM, Drive app SDK families declared | No raw HTTP, manual auth headers, backend SDK, or local SDK fork | Token/session scope contract exists | Concrete generated mini-program SDK adapters and appbase IAM runtime are deferred. |

## Framework Decision

- User-selected platform: WeChat Mini Program only.
- Implementation: native WeChat Mini Program.
- Manifest runtime: `family = mini-program`, `framework = weixin-mini-program`, `platform = MP_WEIXIN`.
- Future multi-platform mini program work must use uni-app in a separate application root.
- Manifest `appType = NONE` is a compatibility choice because schema v3 currently has no native mini-program `PlusProjectType`; runtime and package metadata remain authoritative.
