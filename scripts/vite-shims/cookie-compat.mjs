function decodeCookieComponent(value) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function encodeCookieComponent(value) {
  return encodeURIComponent(value);
}

function isFiniteDate(value) {
  return value instanceof Date && Number.isFinite(value.valueOf());
}

export function parse(input, options = {}) {
  const source = typeof input === 'string' ? input : '';
  const decode = typeof options.decode === 'function' ? options.decode : decodeCookieComponent;
  const cookies = Object.create(null);

  if (!source.trim()) {
    return cookies;
  }

  for (const segment of source.split(';')) {
    const separatorIndex = segment.indexOf('=');
    if (separatorIndex < 0) {
      continue;
    }

    const key = segment.slice(0, separatorIndex).trim();
    if (!key || Object.prototype.hasOwnProperty.call(cookies, key)) {
      continue;
    }

    const value = segment.slice(separatorIndex + 1).trim();
    cookies[key] = decode(value);
  }

  return cookies;
}

export function parseCookie(input, options = {}) {
  return parse(input, options);
}

export function serialize(name, value, options = {}) {
  const encode = typeof options.encode === 'function' ? options.encode : encodeCookieComponent;
  const encodedName = String(name ?? '').trim();
  const encodedValue = encode(String(value ?? ''));

  if (!encodedName) {
    throw new TypeError('cookie name is required');
  }

  let result = `${encodedName}=${encodedValue}`;

  if (options.maxAge !== undefined) {
    result += `; Max-Age=${Math.floor(Number(options.maxAge))}`;
  }

  if (options.domain) {
    result += `; Domain=${String(options.domain).trim()}`;
  }

  if (options.path) {
    result += `; Path=${String(options.path).trim()}`;
  }

  if (isFiniteDate(options.expires)) {
    result += `; Expires=${options.expires.toUTCString()}`;
  }

  if (options.httpOnly) {
    result += '; HttpOnly';
  }

  if (options.secure) {
    result += '; Secure';
  }

  if (options.partitioned) {
    result += '; Partitioned';
  }

  if (options.priority) {
    const priority = String(options.priority).trim().toLowerCase();
    if (priority === 'low' || priority === 'medium' || priority === 'high') {
      result += `; Priority=${priority.charAt(0).toUpperCase()}${priority.slice(1)}`;
    }
  }

  if (options.sameSite !== undefined) {
    if (options.sameSite === true) {
      result += '; SameSite=Strict';
    } else {
      const sameSite = String(options.sameSite).trim().toLowerCase();
      if (sameSite === 'lax' || sameSite === 'strict' || sameSite === 'none') {
        result += `; SameSite=${sameSite.charAt(0).toUpperCase()}${sameSite.slice(1)}`;
      }
    }
  }

  return result;
}

export function stringifySetCookie(name, value, options = {}) {
  if (typeof name === 'object' && name !== null) {
    return serialize(name.name, name.value, name);
  }

  return serialize(name, value, options);
}

export function stringifyCookie(cookie, options = {}) {
  const encode = typeof options.encode === 'function' ? options.encode : encodeCookieComponent;
  return Object.entries(cookie ?? {})
    .filter(([, value]) => value !== undefined)
    .map(([key, cookieValue]) => `${String(key).trim()}=${encode(String(cookieValue ?? ''))}`)
    .join('; ');
}

export default {
  parse,
  parseCookie,
  serialize,
  stringifyCookie,
  stringifySetCookie,
};
