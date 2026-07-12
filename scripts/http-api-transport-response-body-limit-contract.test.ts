import assert from 'node:assert/strict';

import { BirdCoderApiTransportError } from '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-core/src/birdCoderApiTransportError.ts';
import { createBirdCoderHttpApiTransport } from '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-infrastructure/src/services/sdkTransportShared.ts';

const SUCCESS_BODY_LIMIT_BYTES = 10 * 1024 * 1024;
const ONE_MEBIBYTE = 1024 * 1024;
const textEncoder = new TextEncoder();

interface OversizedStreamProbe {
  cancelled: boolean;
  stream: ReadableStream<Uint8Array>;
}

function createOversizedJsonStream(): OversizedStreamProbe {
  const padding = new Uint8Array(ONE_MEBIBYTE);
  padding.fill(0x20);
  let emittedChunks = 0;
  let cancelled = false;

  return {
    get cancelled() {
      return cancelled;
    },
    stream: new ReadableStream<Uint8Array>({
      pull(controller) {
        if (emittedChunks <= SUCCESS_BODY_LIMIT_BYTES / ONE_MEBIBYTE) {
          emittedChunks += 1;
          controller.enqueue(padding);
          return;
        }

        controller.enqueue(textEncoder.encode('{"accepted":true}'));
        controller.close();
      },
      cancel() {
        cancelled = true;
      },
    }),
  };
}

function createTransport(response: Response) {
  return createBirdCoderHttpApiTransport({
    baseUrl: 'http://127.0.0.1:13002',
    fetchImpl: async () => response,
  });
}

async function requestAcceptedPayload(transport: ReturnType<typeof createTransport>): Promise<unknown> {
  return transport.request({
    method: 'GET',
    path: '/app/v3/api/response-body-limit-contract',
  });
}

{
  const response = new Response(
    new ReadableStream<Uint8Array>(),
    {
      status: 200,
      headers: {
        'Content-Length': String(SUCCESS_BODY_LIMIT_BYTES + 1),
      },
    },
  );

  await assert.rejects(
    () => requestAcceptedPayload(createTransport(response)),
    /body exceeds maximum size/u,
    'an oversized declared Content-Length must fail before reading the stream.',
  );
}

for (const [name, contentLength] of [
  ['missing Content-Length', undefined],
  ['malformed Content-Length', 'not-a-number'],
  ['misleading Content-Length', '1'],
] as const) {
  const probe = createOversizedJsonStream();
  const response = new Response(probe.stream, {
    status: 200,
    headers: contentLength === undefined ? undefined : { 'Content-Length': contentLength },
  });

  await assert.rejects(
    () => requestAcceptedPayload(createTransport(response)),
    /body exceeds maximum size/u,
    `${name} must not permit an oversized response body.`,
  );
  assert.equal(probe.cancelled, true, `${name} must cancel the stream on the first over-limit chunk.`);
}

{
  const probe = createOversizedJsonStream();
  const transport = createTransport(
    new Response(probe.stream, {
      status: 502,
      headers: {
        'Content-Type': 'application/problem+json',
      },
    }),
  );

  await assert.rejects(
    () => requestAcceptedPayload(transport),
    (error: unknown) => {
      assert.equal(error instanceof BirdCoderApiTransportError, true);
      assert.equal(
        (error as BirdCoderApiTransportError).httpStatus,
        502,
        'oversized problem bodies must retain the safe HTTP status.',
      );
      assert.equal(
        (error as BirdCoderApiTransportError).detail,
        undefined,
        'oversized problem bodies must not be surfaced to the UI as an unbounded detail string.',
      );
      return true;
    },
    'an oversized problem body must map to a status-only transport error.',
  );
  assert.equal(probe.cancelled, true, 'an oversized problem body must cancel its stream.');
}

{
  const transport = createTransport(
    new Response('{"accepted":true}', {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
      },
    }),
  );

  assert.deepEqual(
    await requestAcceptedPayload(transport),
    { accepted: true },
    'a bounded body must keep existing JSON parsing behavior.',
  );
}

{
  let bodyAbortObserved = false;
  const transport = createBirdCoderHttpApiTransport({
    baseUrl: 'http://127.0.0.1:13002',
    timeoutMs: 10,
    fetchImpl: async (_input, init) => {
      const body = new ReadableStream<Uint8Array>({
        start(controller) {
          init?.signal?.addEventListener(
            'abort',
            () => {
              bodyAbortObserved = true;
              controller.error(new DOMException('request aborted', 'AbortError'));
            },
            { once: true },
          );
        },
      });
      return new Response(body, {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
        },
      });
    },
  });

  const result = await Promise.race([
    requestAcceptedPayload(transport).then(
      () => 'resolved' as const,
      (error: unknown) => error,
    ),
    new Promise<'body-read-timeout-not-enforced'>((resolve) => {
      setTimeout(() => resolve('body-read-timeout-not-enforced'), 100);
    }),
  ]);

  assert.notEqual(
    result,
    'body-read-timeout-not-enforced',
    'the request timeout must remain active until the response body has been read within its byte cap.',
  );
  assert.equal(bodyAbortObserved, true, 'body reads must observe the request AbortSignal timeout.');
  assert.equal(result instanceof Error, true);
  assert.match((result as Error).message, /request timed out/u);
}

console.log('http api transport response body limit contract passed.');
