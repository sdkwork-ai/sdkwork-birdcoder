# SDKWork BirdCoder Mini Program

Read `../../AGENTS.md` first. This root implements the native WeChat Mini Program surface for BirdCoder.

- Architecture authority: `../../../sdkwork-specs/MINI_PROGRAM_APP_ARCHITECTURE_SPEC.md`
- UI authority: `../../../sdkwork-specs/APP_MINI_PROGRAM_UI_SPEC.md`
- Application identity: `sdkwork.app.config.json`
- Local contracts: `specs/`
- Source deployment authority: `etc/sdkwork.deployment.config.json`

Keep business source in `packages/sdkwork-birdcoder-mp-*`. Root `src/` owns only native entrypoints, bootstrap, route projection outputs, and runtime bundles. Platform `wx.*` APIs are allowed only in `packages/sdkwork-birdcoder-mp-host` and generated native entry wrappers.

This application is WeChat-native. Do not introduce uni-app here; a future multi-platform mini program must use a separate application root.
