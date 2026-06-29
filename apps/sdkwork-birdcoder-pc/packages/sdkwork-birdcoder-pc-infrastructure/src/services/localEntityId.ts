import { randomBytes } from '@sdkwork/utils/id';

export function createBirdCoderLocalEntityId(prefix?: string): string {
  void prefix;
  const timestampPart = BigInt(Date.now()) * 1_000_000n;
  const randomPart = BigInt(
    randomBytes(4).reduce((acc: bigint, byte: number) => acc * 256n + BigInt(byte), 0n) % 1_000_000n,
  );
  return (timestampPart + randomPart).toString();
}
