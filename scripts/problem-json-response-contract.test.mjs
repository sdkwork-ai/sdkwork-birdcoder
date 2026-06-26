import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const rootDir = process.cwd();
const routerErrorDir = path.join(rootDir, 'crates');

function readText(relativePath) {
  return fs.readFileSync(path.join(rootDir, relativePath), 'utf8');
}

function listRouterErrorFiles() {
  return fs
    .readdirSync(routerErrorDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && entry.name.startsWith('sdkwork-routes-'))
    .map((entry) => path.join('crates', entry.name, 'src', 'error.rs'))
    .filter((relativePath) => fs.existsSync(path.join(rootDir, relativePath)));
}

for (const relativePath of listRouterErrorFiles()) {
  const source = readText(relativePath);
  assert.match(
    source,
    /ProblemJsonBody|IntoResponse for AppError|traced_problem_json|problem_json|application\/problem\+json/u,
    `${relativePath} must emit application/problem+json via ProblemJsonBody or AppError.`,
  );
  assert.doesNotMatch(
    source,
    /-> \(StatusCode, Json<ProblemDetailsPayload>\)/u,
    `${relativePath} must not return bare Json<ProblemDetailsPayload> without problem+json content type.`,
  );
}

const handlerFiles = fs
  .globSync('crates/sdkwork-routes-*/src/handlers.rs', { cwd: rootDir })
  .map((relativePath) => relativePath.replaceAll('\\', '/'));

for (const relativePath of handlerFiles) {
  const source = readText(relativePath);
  assert.doesNotMatch(
    source,
    /Json<error::ProblemDetailsPayload>/u,
    `${relativePath} must use error::ProblemJsonBody or error::AppError for typed error responses.`,
  );
}

console.log('problem json response contract passed.');
