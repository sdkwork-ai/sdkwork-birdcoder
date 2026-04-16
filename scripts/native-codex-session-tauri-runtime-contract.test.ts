import assert from 'node:assert/strict';

const storeModulePath = new URL(
  '../packages/sdkwork-birdcoder-commons/src/workbench/nativeCodexSessionStore.ts',
  import.meta.url,
);

const originalWindowDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'window');
const originalProcessDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'process');

async function withTauriOnlyRuntime<T>(operation: () => Promise<T>): Promise<T> {
  const tauriSessionFilePath =
    'C:\\Users\\admin\\.codex\\sessions\\2026\\04\\16\\rollout-2026-04-16T15-00-00-native-tauri-session.jsonl';
  const tauriSessionIndexPath = 'C:\\Users\\admin\\.codex\\session_index.jsonl';
  const tauriSessionContent = [
    JSON.stringify({
      timestamp: '2026-04-16T15:00:00.000Z',
      type: 'session_meta',
      payload: {
        id: 'native-tauri-session',
        timestamp: '2026-04-16T15:00:00.000Z',
        cwd: 'D:\\workspace\\birdcoder',
      },
    }),
    JSON.stringify({
      timestamp: '2026-04-16T15:01:00.000Z',
      type: 'event_msg',
      payload: {
        type: 'user_message',
        turn_id: 'turn-1',
        message: 'Load native Codex sessions through the Tauri bridge.',
      },
    }),
    JSON.stringify({
      timestamp: '2026-04-16T15:02:00.000Z',
      type: 'response_item',
      payload: {
        type: 'message',
        role: 'assistant',
        turn_id: 'turn-1',
        content: [
          {
            type: 'output_text',
            text: 'Tauri runtime successfully loaded the native session transcript.',
          },
        ],
      },
    }),
  ].join('\n');
  const tauriSessionIndexContent = JSON.stringify({
    id: 'native-tauri-session',
    thread_name: 'Tauri imported Codex session',
    updated_at: '2026-04-16T15:03:00.000Z',
  });

  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: {
      __TAURI_INTERNALS__: {
        async invoke(command: string, payload?: Record<string, unknown>) {
          if (command === 'codex_native_session_file_list') {
            return [
              {
                filePath: tauriSessionFilePath,
                modifiedAtMs: Date.parse('2026-04-16T15:03:00.000Z'),
                size: tauriSessionContent.length,
              },
            ];
          }

          if (command === 'codex_native_session_index_read') {
            return {
              content: tauriSessionIndexContent,
              filePath: tauriSessionIndexPath,
              modifiedAtMs: Date.parse('2026-04-16T15:03:00.000Z'),
            };
          }

          if (command === 'codex_native_session_read_file') {
            assert.deepEqual(payload, {
              filePath: tauriSessionFilePath,
            });
            return tauriSessionContent;
          }

          throw new Error(`Unexpected Tauri command: ${command}`);
        },
      },
    } as Window & typeof globalThis,
  });

  Object.defineProperty(globalThis, 'process', {
    configurable: true,
    value: {
      env: originalProcessDescriptor?.value?.env ?? {},
    },
  });

  try {
    return await operation();
  } finally {
    if (originalWindowDescriptor) {
      Object.defineProperty(globalThis, 'window', originalWindowDescriptor);
    } else {
      Reflect.deleteProperty(globalThis, 'window');
    }

    if (originalProcessDescriptor) {
      Object.defineProperty(globalThis, 'process', originalProcessDescriptor);
    } else {
      Reflect.deleteProperty(globalThis, 'process');
    }
  }
}

await withTauriOnlyRuntime(async () => {
  const moduleVersion = Date.now();
  const {
    listNativeCodexSessions,
    readNativeCodexSessionRecord,
  } = await import(`${storeModulePath.href}?t=${moduleVersion}`);

  const inventory = await listNativeCodexSessions();
  assert.deepEqual(
    inventory.map((session) => ({
      id: session.id,
      title: session.title,
      status: session.status,
      nativeCwd: session.nativeCwd,
      updatedAt: session.updatedAt,
    })),
    [
      {
        id: 'codex-native:native-tauri-session',
        title: 'Tauri imported Codex session',
        status: 'completed',
        nativeCwd: 'D:\\workspace\\birdcoder',
        updatedAt: '2026-04-16T15:03:00.000Z',
      },
    ],
    'native Codex inventory must work in Tauri WebView runtimes without Node builtins.',
  );

  const record = await readNativeCodexSessionRecord('codex-native:native-tauri-session');
  assert.ok(record, 'native Codex record lookup must work in Tauri WebView runtimes.');
  assert.deepEqual(
    record?.messages.map((message) => ({
      role: message.role,
      content: message.content,
    })),
    [
      {
        role: 'user',
        content: 'Load native Codex sessions through the Tauri bridge.',
      },
      {
        role: 'assistant',
        content: 'Tauri runtime successfully loaded the native session transcript.',
      },
    ],
    'Tauri-native Codex session reads must load the same visible message transcript as the Node fast path.',
  );
});

console.log('native codex session tauri runtime contract passed.');
