# Repository Guidelines

<!-- SDKWORK-AGENTS-GENERATED: v1 -->

## SDKWORK Soul

Read `../../../sdkwork-specs/SOUL.md` before executing tasks in this root. Follow specs before memory, dictionary before context, stop on ambiguity, and evidence before completion.

## SDKWORK Standards


<!-- SDKWORK-PROGRESSIVE-LOADING: v1 -->
Resolve this standards root once and use it as the global authority for the current task:

- `../../../sdkwork-specs/README.md`
- `../../../sdkwork-specs/SOUL.md`
- `../../../sdkwork-specs/AGENTS_SPEC.md`

Read only the relevant README task-matrix row or navigation heading, then load the selected authority sections.
<!-- /SDKWORK-PROGRESSIVE-LOADING: v1 -->

Canonical SDKWORK specs path from this root:

- `../../../sdkwork-specs/README.md`
- `../../../sdkwork-specs/SOUL.md`
- `../../../sdkwork-specs/AGENTS_SPEC.md`
- `../../../sdkwork-specs/MINI_PROGRAM_APP_ARCHITECTURE_SPEC.md`
- `../../../sdkwork-specs/APP_MINI_PROGRAM_UI_SPEC.md`
- `../../../sdkwork-specs/TYPESCRIPT_CODE_SPEC.md`

Do not copy root standard text into this application. If these relative paths do not resolve, stop and report the broken workspace layout.

## Application Identity

This is the WeChat-native Mini Program application root for sdkwork-birdcoder.

Read `sdkwork.app.config.json` for mini-program surface identity and
`../../sdkwork.app.config.json` for repository-wide application identity before
changing application behavior, runtime config, SDK wiring, or release metadata.

## Local Dictionary Structure

- `src/`: Root shell entry, bootstrap, route projection outputs, and runtime bundles
- `packages/sdkwork-birdcoder-mp-*`: business source; `wx.*` platform APIs are allowed only in `packages/sdkwork-birdcoder-mp-host` and generated native entry wrappers
- `specs/`: Local contracts
- `etc/`: Deployable-root source configuration (environment, Base URL, bind, topology, deployment values) per `../../../sdkwork-specs/SOURCE_CONFIG_SPEC.md`

## Build, Test, and Verification

Choose the narrowest verification selected by the changed surface; run workspace-wide checks only when the change crosses that boundary. Mutating repair commands are not verification defaults.

- List/search pagination: `../../../sdkwork-specs/PAGINATION_SPEC.md` with `check-pagination.mjs` verification
- Packaging/workflow changes: `../../../sdkwork-specs/GITHUB_WORKFLOW_SPEC.md`
- Command standardization: `../../../sdkwork-specs/PNPM_SCRIPT_SPEC.md`
- Language-specific specs (TypeScript/JavaScript) are on-demand, loaded for the touched language only

This application is WeChat-native. Do not introduce uni-app here; a future multi-platform mini program must use a separate application root.

## Code Style Rules

Read `../../../sdkwork-specs/CODE_STYLE_SPEC.md` and `../../../sdkwork-specs/NAMING_SPEC.md` before code changes in this root; keep contracts, services, and UI packages inside their owning boundaries.

## Required Specs By Task Type

- Mini-program architecture/UI work: `../../../sdkwork-specs/MINI_PROGRAM_APP_ARCHITECTURE_SPEC.md`, `../../../sdkwork-specs/APP_MINI_PROGRAM_UI_SPEC.md`
- TypeScript/JavaScript code: `../../../sdkwork-specs/TYPESCRIPT_CODE_SPEC.md` (on-demand)
- Frontend/UI code: `../../../sdkwork-specs/FRONTEND_CODE_SPEC.md` (on-demand)

## Spec Resolution Order

1. Read this `AGENTS.md` and `../../AGENTS.md` routing material and classify the owned surface.
2. Read `../../../sdkwork-specs/README.md`, then only the task-selected root specs.
3. Read local `specs/` contracts when local contracts are relevant.
4. Inspect implementation files after the dictionary and relevant specs are clear.

## Agent Execution Rules

Use dynamic progressive loading: resolve this file and the standards root, then load only the task-selected spec sections before inspecting implementation files. Treat indexes and cross-references as discovery, not as a startup bundle.

## HTTP API Response Envelope

All L2+ SDKWork-owned custom HTTP contracts, including `app-api`, `backend-api`, and SDKWork-owned business `open-api`, `MUST` follow `API_SPEC.md` section 4.5, section 14, and section 15:

- **Default classification:** omitted `x-sdkwork-wire-protocol` means SDKWork-owned custom API (`sdkwork-v3`); only operation-level `x-sdkwork-wire-protocol: external` plus `x-sdkwork-external-protocol-id` identifies a third-party compatibility `open-api` operation.
- **Input:** typed request bodies, section 14.1 list/search/command input, `SdkWorkListQuery`, and `q` for free-text search.
- **Success output:** `SdkWorkApiResponse` with `{ "code": 0, "data": <payload>, "traceId": "<server-uuid>" }`.
- **Error output:** HTTP 4xx/5xx `application/problem+json` (`ProblemDetail`) with numeric `code` and `traceId`; SDKWork-owned errors may include `i18nKey` and `locale` presentation metadata.
- Success `code` is numeric `int32`; HTTP 2xx JSON bodies `MUST` use `0` only. REST semantics remain on HTTP status (`201`, `202`, etc.).
- Platform error codes are numeric non-zero values per section 15.3 (`40001`, `40101`, `40401`, …).
- Single resource: `data.item`
- Lists: `data.items` + `data.pageInfo` (`PageInfo.mode` is `offset` or `cursor`)
- Commands: `data.accepted` plus optional `resourceId` / `status`
- Async accept (`202`): `data.operationId`, `data.status`, optional `pollUrl`
- Operation patterns: retrieve/list/search/create/update/delete/command/async/bulk semantics follow `API_SPEC.md` section 15.4; create uses `201`, delete uses `204` with no JSON body, and `PUT`/`PATCH` use SDK action `update`.

Vendor compatibility `open-api` routes that mirror upstream tool or provider wire (for example OpenAI `/v1/*`, Anthropic/Claude `/anthropic/v1/*`, Google/Gemini `/google/v1beta/*`, Claude Code, or Codex) `MAY` opt out only when every exempt operation declares operation-level `x-sdkwork-wire-protocol: external` and `x-sdkwork-external-protocol-id` per `API_SPEC.md` section 4.5.2. SDKWork-owned business `open-api` operations `MUST NOT` opt out. Mixed OpenAPI documents are validated per operation; one external operation never exempts SDKWork-owned operations in the same document.

Errors `MUST` use HTTP 4xx/5xx with `application/problem+json` (`ProblemDetail`) including required numeric `code` and `traceId`. Optional `i18nKey` and `locale` are display metadata only. Business failures `MUST NOT` use HTTP 2xx with non-zero `code`, string wire codes, `success`, or human `message`.

Forbidden legacy envelopes and fields: `PlusApiResult`, `AppbaseApiResult`, `StoreApiResult`, `SdkWorkResponse`, per-domain `*ApiResult`, wire field `requestId`, bare domain DTOs at the HTTP root, and top-level `{ items, pageInfo, traceId }` without `data`.

Handlers `MUST` serialize success and map errors through `sdkwork-web-framework` response mapping. Generated HTTP SDKs (`--standard-profile sdkwork-v3`) unwrap `data` by default and expose typed numeric `ProblemDetail.code` / `traceId` and returned localization metadata on errors; use `.raw` when the full envelope is required.

Before completing API contract, SDK generation, or frontend service work, run:

```bash
node <sdkwork-specs>/tools/check-api-operation-patterns.mjs --workspace <workspace-root>
node <sdkwork-specs>/tools/check-api-response-envelope.mjs --workspace <workspace-root>
```

Authority: `sdkwork-specs/API_SPEC.md` section 4.5 and sections 14–16, `SDK_SPEC.md` section 4.2, `FRONTEND_SPEC.md`, `MIGRATION_SPEC.md` section 4.2.

## Human Review Rules

Request human review before breaking SDKWork standards, changing public naming, altering security/auth behavior, changing database migrations or production deployment config, deleting data/files, changing generated SDK ownership, or modifying release/deployment governance in this root.
