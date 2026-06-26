import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const spec = JSON.parse(
  fs.readFileSync(path.join(root, 'specs/agents-birdcoder-alignment.spec.json'), 'utf8'),
);

for (const doc of spec.authorityDocs) {
  const docPath = path.join(root, doc);
  assert.equal(fs.existsSync(docPath), true, `missing authority doc: ${doc}`);
}

for (const task of spec.tasks.filter((entry) => entry.gate)) {
  assert.equal(task.status, 'done', `gate task ${task.id} must be done`);
  for (const rel of task.evidence?.paths ?? []) {
    const target = rel.startsWith('../')
      ? path.join(root, rel)
      : path.join(root, rel);
    assert.equal(fs.existsSync(target), true, `${task.id} missing evidence path ${rel}`);
  }
  for (const pattern of task.evidence?.requiredPatterns ?? []) {
    const file = pattern.file.startsWith('../')
      ? path.join(root, pattern.file)
      : path.join(root, pattern.file);
    const source = fs.readFileSync(file, 'utf8');
    assert.match(source, new RegExp(pattern.pattern), `${task.id} missing ${pattern.pattern}`);
  }
  for (const pattern of task.evidence?.forbiddenPatterns ?? []) {
    const file = pattern.file.startsWith('../')
      ? path.join(root, pattern.file)
      : path.join(root, pattern.file);
    const source = fs.readFileSync(file, 'utf8');
    const scope =
      pattern.section === 'dependencies'
        ? source.match(/\[dependencies\][\s\S]*?(?=\n\[|$)/)?.[0] ?? source
        : source;
    assert.doesNotMatch(
      scope,
      new RegExp(pattern.pattern),
      `${task.id} forbidden pattern ${pattern.pattern}`,
    );
  }
}

console.log('agents-birdcoder alignment contract passed.');
