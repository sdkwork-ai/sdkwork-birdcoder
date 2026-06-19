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

export const APP_SDK_OPENAPI_MIRROR_TARGETS = [
  {
    relativePath: 'sdks/specs/openapi/birdcoder-app-v3.openapi.json',
    mirrorRelativePath: 'apps/sdkwork-birdcoder-pc/sdks/specs/openapi/birdcoder-app-v3.openapi.json',
    apiSurface: 'app-api',
  },
  {
    relativePath: 'sdks/specs/openapi/birdcoder-backend-v3.openapi.json',
    mirrorRelativePath: 'apps/sdkwork-birdcoder-pc/sdks/specs/openapi/birdcoder-backend-v3.openapi.json',
    apiSurface: 'backend-api',
  },
  {
    relativePath: 'sdks/sdkwork-birdcoder-app-sdk/openapi/sdkwork-birdcoder-app-api.openapi.json',
    mirrorRelativePath:
      'apps/sdkwork-birdcoder-pc/sdks/sdkwork-birdcoder-app-sdk/openapi/sdkwork-birdcoder-app-api.openapi.json',
    apiSurface: 'app-api',
  },
  {
    relativePath: 'sdks/sdkwork-birdcoder-backend-sdk/openapi/sdkwork-birdcoder-backend-api.openapi.json',
    mirrorRelativePath:
      'apps/sdkwork-birdcoder-pc/sdks/sdkwork-birdcoder-backend-sdk/openapi/sdkwork-birdcoder-backend-api.openapi.json',
    apiSurface: 'backend-api',
  },
];
