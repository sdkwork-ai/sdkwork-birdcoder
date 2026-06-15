export function resolveSafePreviewUrl(value: string | null | undefined): string {
  const normalizedValue = value?.trim() ?? '';
  if (!normalizedValue) {
    return 'about:blank';
  }

  if (normalizedValue.toLowerCase() === 'about:blank') {
    return 'about:blank';
  }

  try {
    const parsedUrl = new URL(normalizedValue);
    if (parsedUrl.protocol === 'http:' || parsedUrl.protocol === 'https:') {
      return normalizedValue;
    }
  } catch {
    return 'about:blank';
  }

  return 'about:blank';
}
