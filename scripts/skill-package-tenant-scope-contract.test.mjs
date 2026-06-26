import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const repositorySource = readFileSync(
  'crates/sdkwork-birdcoder-skill-packages-repository-sqlx/src/repository/skill_package_repository.rs',
  'utf8',
);
const serviceSource = readFileSync(
  'crates/sdkwork-birdcoder-skill-packages-service/src/service/skill_package_service.rs',
  'utf8',
);
const handlerSource = readFileSync(
  'crates/sdkwork-routes-skill-packages-app-api/src/handlers.rs',
  'utf8',
);

assert.match(repositorySource, /tenant_id: i64/);
assert.match(repositorySource, /AND tenant_id = \?2/);
assert.match(serviceSource, /require_scoped_tenant_id/);
assert.match(serviceSource, /scope_exists\([\s\S]*tenant_id\)/);
assert.match(handlerSource, /tenant_id: iam\.0\.tenant_id\.clone\(\)/);

console.log('skill package tenant scope contract passed.');
