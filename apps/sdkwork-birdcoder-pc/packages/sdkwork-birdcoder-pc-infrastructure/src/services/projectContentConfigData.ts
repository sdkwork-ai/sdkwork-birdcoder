import { parseBirdCoderApiJson } from './apiJson.ts';

function normalizeOptionalText(value: string | null | undefined): string | undefined {
  const normalizedValue = value?.trim();
  return normalizedValue && normalizedValue.length > 0 ? normalizedValue : undefined;
}

export function parseBirdCoderProjectContentConfigData(
  configData: string | null | undefined,
): Record<string, unknown> {
  const normalizedConfigData = normalizeOptionalText(configData);
  if (!normalizedConfigData) {
    return {};
  }

  try {
    const parsedConfigData = parseBirdCoderApiJson(normalizedConfigData) as unknown;
    return parsedConfigData && typeof parsedConfigData === 'object' && !Array.isArray(parsedConfigData)
      ? { ...(parsedConfigData as Record<string, unknown>) }
      : {};
  } catch {
    return {};
  }
}

export function readBirdCoderProjectRootPathFromConfigData(
  configData: string | null | undefined,
): string | undefined {
  const parsedConfigData = parseBirdCoderProjectContentConfigData(configData);
  const rootPath =
    typeof parsedConfigData.rootPath === 'string'
      ? parsedConfigData.rootPath
      : typeof parsedConfigData.root_path === 'string'
        ? parsedConfigData.root_path
        : undefined;
  return normalizeOptionalText(rootPath);
}

export function buildBirdCoderProjectContentConfigData(
  rootPath: string,
  options: {
    existingConfigData?: string | null;
  } = {},
): string {
  const configData = parseBirdCoderProjectContentConfigData(options.existingConfigData);
  delete configData.root_path;
  return JSON.stringify({
    ...configData,
    rootPath: normalizeOptionalText(rootPath) ?? rootPath,
  });
}
