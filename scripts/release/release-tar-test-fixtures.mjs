import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

function splitTarPath(normalizedName) {
  const nameBuffer = Buffer.from(normalizedName, 'utf8');
  if (nameBuffer.length <= 100) {
    return {
      headerName: normalizedName,
      headerPrefix: '',
    };
  }

  const segments = normalizedName.split('/');
  for (let index = segments.length - 1; index > 0; index -= 1) {
    const prefix = segments.slice(0, index).join('/');
    const suffix = segments.slice(index).join('/');
    if (Buffer.byteLength(prefix, 'utf8') <= 155 && Buffer.byteLength(suffix, 'utf8') <= 100) {
      return {
        headerName: suffix,
        headerPrefix: prefix,
      };
    }
  }

  throw new Error(`Tar entry path is too long for release smoke fixtures: ${normalizedName}`);
}

function createTarHeader({
  name,
  size,
  type = '0',
} = {}) {
  const header = Buffer.alloc(512, 0);
  const normalizedName = String(name ?? '').replaceAll('\\', '/');
  const { headerName, headerPrefix } = splitTarPath(normalizedName);

  header.write(headerName, 0, 100, 'utf8');
  header.write('0000755\0', 100, 8, 'ascii');
  header.write('0000000\0', 108, 8, 'ascii');
  header.write('0000000\0', 116, 8, 'ascii');
  header.write((size ?? 0).toString(8).padStart(11, '0') + '\0', 124, 12, 'ascii');
  header.write('00000000000\0', 136, 12, 'ascii');
  header.fill(0x20, 148, 156);
  header.write(String(type ?? '0').slice(0, 1), 156, 1, 'ascii');
  header.write('ustar\0', 257, 6, 'ascii');
  header.write('00', 263, 2, 'ascii');
  if (headerPrefix) {
    header.write(headerPrefix, 345, 155, 'utf8');
  }

  let checksum = 0;
  for (const byte of header.values()) {
    checksum += byte;
  }
  header.write(checksum.toString(8).padStart(6, '0') + '\0 ', 148, 8, 'ascii');

  return header;
}

export function createTarRecord({
  name,
  content = '',
  type = '0',
} = {}) {
  const contentBuffer = Buffer.isBuffer(content)
    ? content
    : Buffer.from(String(content ?? ''), 'utf8');
  const paddingSize = (512 - (contentBuffer.length % 512)) % 512;

  return Buffer.concat([
    createTarHeader({
      name,
      size: contentBuffer.length,
      type,
    }),
    contentBuffer,
    Buffer.alloc(paddingSize, 0),
  ]);
}

export function writeTarGzArchive(archivePath, records) {
  fs.mkdirSync(path.dirname(archivePath), { recursive: true });
  fs.writeFileSync(
    archivePath,
    zlib.gzipSync(Buffer.concat([
      ...records,
      Buffer.alloc(1024, 0),
    ])),
  );
}
