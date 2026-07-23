const HTTP_METHODS = new Set(['delete', 'get', 'patch', 'post', 'put', 'options', 'head']);

export function applyWebFrameworkOpenApiExtensions(document, apiSurface) {
  let changed = 0;
  const paths = document.paths ?? {};
  for (const pathItem of Object.values(paths)) {
    if (!pathItem || typeof pathItem !== 'object') {
      continue;
    }
    for (const [method, operation] of Object.entries(pathItem)) {
      if (!HTTP_METHODS.has(method)) {
        continue;
      }
      if (!operation || typeof operation !== 'object') {
        continue;
      }
      if (operation['x-sdkwork-request-context'] !== 'WebRequestContext') {
        operation['x-sdkwork-request-context'] = 'WebRequestContext';
        changed += 1;
      }
      if (operation['x-sdkwork-api-surface'] !== apiSurface) {
        operation['x-sdkwork-api-surface'] = apiSurface;
        changed += 1;
      }
    }
  }
  return changed;
}

export const BIRDCODER_OPENAPI_AUTHORITY_TARGETS = [
  {
    relativePath: 'sdks/sdkwork-birdcoder-app-sdk/openapi/sdkwork-birdcoder-app-api.openapi.json',
    apiSurface: 'app-api',
  },
];
