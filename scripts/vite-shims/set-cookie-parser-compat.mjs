function isCookieBoundary(fragment) {
  return /^\s*[^=\s;,]+=/u.test(fragment);
}

export function splitCookiesString(input) {
  if (Array.isArray(input)) {
    return input.flatMap((item) => splitCookiesString(item));
  }

  const source = typeof input === 'string' ? input : '';
  if (!source.trim()) {
    return [];
  }

  const segments = [];
  let startIndex = 0;
  let inExpiresAttribute = false;

  for (let index = 0; index < source.length; index += 1) {
    const nextExpires = source.slice(index, index + 8).toLowerCase();
    if (nextExpires === 'expires=') {
      inExpiresAttribute = true;
      index += 7;
      continue;
    }

    const currentCharacter = source[index];
    if (inExpiresAttribute && currentCharacter === ';') {
      inExpiresAttribute = false;
      continue;
    }

    if (currentCharacter !== ',' || inExpiresAttribute) {
      continue;
    }

    const remainder = source.slice(index + 1);
    if (!isCookieBoundary(remainder)) {
      continue;
    }

    const cookieSegment = source.slice(startIndex, index).trim();
    if (cookieSegment) {
      segments.push(cookieSegment);
    }

    startIndex = index + 1;
  }

  const trailingSegment = source.slice(startIndex).trim();
  if (trailingSegment) {
    segments.push(trailingSegment);
  }

  return segments;
}

export default {
  splitCookiesString,
};
