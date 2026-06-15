export type LocaleLeaf = string;

export type LocaleTree = {
  [key: string]: LocaleLeaf | LocaleTree;
};

export type LocaleModule<TResource extends LocaleTree = LocaleTree> = {
  name: string;
  resource: TResource;
};

function isLocaleTree(value: LocaleLeaf | LocaleTree | undefined): value is LocaleTree {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function defineLocaleModule<TResource extends LocaleTree>(
  name: string,
  resource: TResource,
): LocaleModule<TResource> {
  return {
    name,
    resource,
  };
}

function mergeLocaleTree(
  locale: string,
  target: LocaleTree,
  source: LocaleTree,
  moduleName: string,
  seenPaths: Map<string, string>,
  pathSegments: string[] = [],
) {
  for (const [key, sourceValue] of Object.entries(source)) {
    const nextPathSegments = [...pathSegments, key];
    const dottedPath = nextPathSegments.join('.');
    const existingValue = target[key];

    if (isLocaleTree(sourceValue)) {
      if (existingValue === undefined) {
        const nextTarget: LocaleTree = {};
        target[key] = nextTarget;
        seenPaths.set(dottedPath, moduleName);
        mergeLocaleTree(locale, nextTarget, sourceValue, moduleName, seenPaths, nextPathSegments);
        continue;
      }

      if (!isLocaleTree(existingValue)) {
        throw new Error(
          `Locale "${locale}" key "${dottedPath}" from "${moduleName}" conflicts with leaf declared by "${seenPaths.get(dottedPath) ?? 'unknown'}".`,
        );
      }

      mergeLocaleTree(locale, existingValue, sourceValue, moduleName, seenPaths, nextPathSegments);
      continue;
    }

    if (existingValue !== undefined) {
      throw new Error(
        `Locale "${locale}" duplicate key "${dottedPath}" declared by "${moduleName}" conflicts with "${seenPaths.get(dottedPath) ?? 'unknown'}".`,
      );
    }

    target[key] = sourceValue;
    seenPaths.set(dottedPath, moduleName);
  }
}

export function buildLocaleResource(
  locale: string,
  modules: readonly LocaleModule[],
): LocaleTree {
  const resource: LocaleTree = {};
  const seenPaths = new Map<string, string>();

  for (const module of modules) {
    mergeLocaleTree(locale, resource, module.resource, module.name, seenPaths);
  }

  return resource;
}

export function flattenLocaleKeys(
  value: LocaleTree,
  prefix = '',
  output: string[] = [],
): string[] {
  for (const [key, nestedValue] of Object.entries(value)) {
    const nextKey = prefix ? `${prefix}.${key}` : key;
    if (isLocaleTree(nestedValue)) {
      flattenLocaleKeys(nestedValue, nextKey, output);
    } else {
      output.push(nextKey);
    }
  }

  return output;
}
