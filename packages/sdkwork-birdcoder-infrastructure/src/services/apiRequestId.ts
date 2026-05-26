type BirdCoderWebCrypto = {
  getRandomValues?: <TArray extends Uint8Array>(array: TArray) => TArray;
  randomUUID?: () => string;
};

const UUID_V4_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;

function readWebCrypto(): BirdCoderWebCrypto | undefined {
  const value = (globalThis as typeof globalThis & { crypto?: BirdCoderWebCrypto }).crypto;
  return value && typeof value === 'object' ? value : undefined;
}

function createFallbackUuidV4(): string {
  const bytes = new Uint8Array(16);
  const crypto = readWebCrypto();
  if (typeof crypto?.getRandomValues === 'function') {
    crypto.getRandomValues(bytes);
  } else {
    for (let index = 0; index < bytes.length; index += 1) {
      bytes[index] = Math.floor(Math.random() * 256);
    }
  }

  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;

  const hex = [...bytes].map((byte) => byte.toString(16).padStart(2, '0'));
  return [
    hex.slice(0, 4).join(''),
    hex.slice(4, 6).join(''),
    hex.slice(6, 8).join(''),
    hex.slice(8, 10).join(''),
    hex.slice(10, 16).join(''),
  ].join('-');
}

export function createBirdCoderApiRequestId(): string {
  const randomUuid = readWebCrypto()?.randomUUID?.().toLowerCase();
  return randomUuid && UUID_V4_PATTERN.test(randomUuid)
    ? randomUuid
    : createFallbackUuidV4();
}
