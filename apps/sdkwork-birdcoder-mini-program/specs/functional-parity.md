# Functional Parity Matrix

| Area | Initialization evidence | Status |
| --- | --- | --- |
| Route identity | `app.im.chat.index` and `route.chat` align with H5 and Flutter | Initialized |
| Route projection | Package-owned JSON contribution deterministically projects `src/app.json` and generated page path | Complete for initial route |
| Runtime config | Eight standalone/cloud environment JSON inputs materialize from repository topology | Complete |
| UI states | Loading, ready, empty, permission-denied, unavailable, and unknown-error states exist | Complete for scaffold |
| SDK boundary | Typed BirdCoder workbench port; component specs declare BirdCoder/Agents/IAM/Drive app SDK intent | Interface complete; generated SDK adapters deferred |
| AuthGate and IAM | Session clearing contract covers logout, refresh failure, account switch, tenant switch, and organization switch | Contract initialized; real appbase IAM runtime deferred |
| Host boundary | Storage, navigation, notification, and login-code WeChat adapter exists | Initial adapter complete; unused host capabilities deferred |
| Upload/media | No upload or media workflow moved in this round | Not applicable |
| H5 chat behavior | No Agents Session/Turn/Session Item workflow converted | Deferred |
| Settings route | H5 `app.account.settings.index` not converted | Deferred |
| Login and recovery | IAM routes and credential-entry UI not converted | Deferred |
| Build | Deterministic `dist/` is suitable for opening with WeChat DevTools | Implemented; IDE preview/upload evidence depends on local toolchain |
