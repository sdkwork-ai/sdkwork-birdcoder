import assert from 'node:assert/strict';
import fs from 'node:fs';

const serviceSource = fs.readFileSync(
  new URL('../packages/sdkwork-birdcoder-infrastructure/src/services/impl/ApiBackedCoreReadService.ts', import.meta.url),
  'utf8',
);

const maxEntriesMatch = serviceSource.match(
  /const CORE_READ_CACHE_MAX_ENTRIES = (?<value>\d+);/,
);

assert.ok(
  maxEntriesMatch?.groups?.value,
  'ApiBackedCoreReadService must define a hard maximum for the shared read cache.',
);

const maxEntries = Number(maxEntriesMatch.groups.value);

assert.ok(
  maxEntries >= 128 && maxEntries <= 512,
  'Core read cache capacity should be large enough for normal navigation but bounded for long-running IDE sessions.',
);

assert.match(
  serviceSource,
  /private pruneReadCache\(now: number = Date\.now\(\)\): void \{/,
  'ApiBackedCoreReadService must prune expired and excess read cache entries through a dedicated helper.',
);

assert.match(
  serviceSource,
  /if \(entry\.inflight\) \{\s*continue;\s*\}[\s\S]*entry\.expiresAt <= now[\s\S]*this\.readCache\.delete\(cacheKey\);/s,
  'Core read cache pruning must drop expired settled entries without canceling in-flight requests.',
);

assert.match(
  serviceSource,
  /while \(this\.readCache\.size > CORE_READ_CACHE_MAX_ENTRIES\) \{[\s\S]*if \(entry\.inflight\) \{\s*continue;\s*\}[\s\S]*this\.readCache\.delete\(cacheKey\);/s,
  'Core read cache pruning must evict oldest settled entries when the cache exceeds its capacity.',
);

assert.match(
  serviceSource,
  /this\.pruneReadCache\(now\);[\s\S]*const cachedEntry = this\.readCache\.get\(key\)/s,
  'Core read cache reads must opportunistically prune stale entries before consulting the cache.',
);

assert.match(
  serviceSource,
  /this\.readCache\.delete\(key\);\s*this\.readCache\.set\(key,\s*cachedEntry as ReadCacheEntry<unknown>\);/s,
  'Core read cache hits must refresh Map insertion order so capacity eviction behaves as LRU.',
);

assert.match(
  serviceSource,
  /this\.readCache\.set\(key,\s*\{[\s\S]*inflight: request[\s\S]*\}\);\s*this\.pruneReadCache\(\);/s,
  'Core read cache must enforce the capacity limit after registering in-flight reads.',
);

console.log('core read cache memory bound contract passed.');
