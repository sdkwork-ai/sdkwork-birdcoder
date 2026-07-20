import fs from 'node:fs';
import path from 'node:path';

const workspaceRoot = path.resolve(import.meta.dirname, '..');

export const CANONICAL_SERVER_RUST_PATHS = Object.freeze({
  apiServerAuth: 'crates/sdkwork-api-birdcoder-standalone-gateway/src/bootstrap/auth.rs',
  apiServerBootstrapSmoke: 'crates/sdkwork-api-birdcoder-standalone-gateway/tests/bootstrap_smoke.rs',
  codingSessionsPaths: 'crates/sdkwork-routes-coding-sessions-app-api/src/paths.rs',
  codingSessionsHandlers: 'crates/sdkwork-routes-coding-sessions-app-api/src/handlers.rs',
  codingSessionsMapper: 'crates/sdkwork-routes-coding-sessions-app-api/src/mapper/request.rs',
  codingSessionsService: 'crates/sdkwork-birdcoder-coding-sessions-service/src/service/coding_session_service.rs',
  codingSessionsEventPayload: 'crates/sdkwork-birdcoder-coding-sessions-service/src/event_payload.rs',
  engineCatalogRoutes: 'crates/sdkwork-routes-engine-catalog-app-api/src/routes.rs',
  engineCatalogHandlers: 'crates/sdkwork-routes-engine-catalog-app-api/src/handlers.rs',
  engineCatalogPaths: 'crates/sdkwork-routes-engine-catalog-app-api/src/paths.rs',
  sqlxCodingSessionsSchema: 'crates/sdkwork-birdcoder-coding-sessions-repository-sqlx/src/db/schema.rs',
  sqlxWorkspaceSchema: 'crates/sdkwork-birdcoder-workspace-repository-sqlx/src/db/schema.rs',
  sqlxSkillPackagesSchema: 'crates/sdkwork-birdcoder-skill-packages-repository-sqlx/src/db/schema.rs',
  sqlxModelConfigSchema: 'crates/sdkwork-birdcoder-model-config-repository-sqlx/src/db/schema.rs',
  skillPackagesHandlers: 'crates/sdkwork-routes-skill-packages-app-api/src/handlers.rs',
  appTemplatesRepository: 'crates/sdkwork-birdcoder-app-templates-repository-sqlx/src/lib.rs',
});

export const CANONICAL_DOMAIN_RUST_PATHS = Object.freeze({
  workspaceDomainResults: 'crates/sdkwork-birdcoder-workspace-service/src/domain/results.rs',
  projectDomainResults: 'crates/sdkwork-birdcoder-project-service/src/domain/results.rs',
  codingSessionsDomainModels: 'crates/sdkwork-birdcoder-coding-sessions-service/src/domain/models.rs',
  codingSessionsDomainCommands: 'crates/sdkwork-birdcoder-coding-sessions-service/src/domain/commands.rs',
  codingSessionsEventPayload: 'crates/sdkwork-birdcoder-coding-sessions-service/src/event_payload.rs',
  nativeSessionService: 'crates/sdkwork-birdcoder-native-sessions-service/src/service/native_session_service.rs',
  codeengineTurns: 'crates/sdkwork-birdcoder-codeengine/src/turns.rs',
});

const SQLITE_SCHEMA_PATHS = [
  CANONICAL_SERVER_RUST_PATHS.sqlxCodingSessionsSchema,
  CANONICAL_SERVER_RUST_PATHS.sqlxWorkspaceSchema,
  CANONICAL_SERVER_RUST_PATHS.sqlxSkillPackagesSchema,
  CANONICAL_SERVER_RUST_PATHS.sqlxModelConfigSchema,
];

const TURN_STREAM_PATHS = [
  CANONICAL_SERVER_RUST_PATHS.codingSessionsMapper,
  CANONICAL_SERVER_RUST_PATHS.codingSessionsService,
  CANONICAL_SERVER_RUST_PATHS.codingSessionsHandlers,
  CANONICAL_DOMAIN_RUST_PATHS.codingSessionsDomainCommands,
];

const ENGINE_CATALOG_PATHS = [
  CANONICAL_SERVER_RUST_PATHS.engineCatalogPaths,
  CANONICAL_SERVER_RUST_PATHS.engineCatalogRoutes,
  CANONICAL_SERVER_RUST_PATHS.engineCatalogHandlers,
];

const APP_TEMPLATES_PATHS = [
  CANONICAL_SERVER_RUST_PATHS.skillPackagesHandlers,
  CANONICAL_SERVER_RUST_PATHS.appTemplatesRepository,
];

export const CANONICAL_CODING_SESSIONS_REALTIME_PATHS = Object.freeze({
  eventsPort: 'crates/sdkwork-birdcoder-coding-sessions-service/src/ports/events.rs',
  service: CANONICAL_SERVER_RUST_PATHS.codingSessionsService,
  eventPayload: CANONICAL_DOMAIN_RUST_PATHS.codingSessionsEventPayload,
});

export function readCanonicalCodingSessionsRealtimeBundle() {
  return readCanonicalServerRustBundle([
    CANONICAL_CODING_SESSIONS_REALTIME_PATHS.eventsPort,
    CANONICAL_CODING_SESSIONS_REALTIME_PATHS.service,
    CANONICAL_CODING_SESSIONS_REALTIME_PATHS.eventPayload,
  ]);
}

export function readCanonicalServerRustSource(relativePath) {
  const absolutePath = path.join(workspaceRoot, relativePath);
  if (!fs.existsSync(absolutePath)) {
    throw new Error(`Canonical server Rust source is missing: ${relativePath}`);
  }

  return fs.readFileSync(absolutePath, 'utf8').replace(/\r\n?/g, '\n');
}

export function readCanonicalServerRustBundle(relativePaths) {
  return relativePaths.map((relativePath) => readCanonicalServerRustSource(relativePath)).join('\n');
}

export function readCanonicalSqliteSchemaBundle() {
  return readCanonicalServerRustBundle(SQLITE_SCHEMA_PATHS);
}

export function readCanonicalTurnStreamBundle() {
  return readCanonicalServerRustBundle(TURN_STREAM_PATHS);
}

export const CANONICAL_CODEENGINE_RUST_PATHS = Object.freeze({
  lib: 'crates/sdkwork-birdcoder-codeengine/src/lib.rs',
  catalog: 'crates/sdkwork-birdcoder-codeengine/src/catalog.rs',
  provider: 'crates/sdkwork-birdcoder-codeengine/src/provider.rs',
  turns: 'crates/sdkwork-birdcoder-codeengine/src/turns.rs',
  sdkBridge: 'crates/sdkwork-birdcoder-codeengine/src/sdk_bridge.rs',
  codeengineDialect: 'crates/sdkwork-birdcoder-codeengine/src/codeengine_dialect.rs',
  claudeCodeProvider: 'crates/sdkwork-birdcoder-codeengine/src/claude_code_provider.rs',
  geminiProvider: 'crates/sdkwork-birdcoder-codeengine/src/gemini_provider.rs',
  codexSessions: 'crates/sdkwork-birdcoder-codeengine/src/codex_sessions.rs',
  codexProvider: 'crates/sdkwork-birdcoder-codeengine/src/codex_provider.rs',
  opencodeProvider: 'crates/sdkwork-birdcoder-codeengine/src/opencode_provider.rs',
});

export const CANONICAL_CODEENGINE_ARTIFACT_PATHS = Object.freeze({
  engineCatalogJson: 'crates/sdkwork-birdcoder-codeengine/generated/engine-catalog.json',
});

export function readCanonicalCodeengineRustBundle(relativePaths) {
  return readCanonicalServerRustBundle(relativePaths);
}

export function readCanonicalEngineCatalogBundle() {
  return readCanonicalServerRustBundle(ENGINE_CATALOG_PATHS);
}

export function readCanonicalAppTemplatesBundle() {
  return readCanonicalServerRustBundle(APP_TEMPLATES_PATHS);
}
