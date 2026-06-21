import assert from 'node:assert/strict';
import { readCanonicalAppTemplatesBundle } from './birdcoder-canonical-server-rust-sources.mjs';

const bundle = readCanonicalAppTemplatesBundle();

assert.match(
  bundle,
  /app_template_service\.list_templates\(\)\.await/u,
  'list_app_templates must delegate to AppTemplateService instead of returning 501.',
);
assert.doesNotMatch(
  bundle,
  /App template listing is not implemented yet/u,
  'list_app_templates must not keep the retired 501 placeholder response.',
);
assert.match(
  bundle,
  /studio_app_template/u,
  'Sqlite app template repository must read from studio_app_template tables.',
);
assert.match(
  bundle,
  /impl AppTemplateRepository for SqliteAppTemplateRepository/u,
  'Sqlite app template repository must implement AppTemplateRepository.',
);

console.log('app templates list contract passed.');
