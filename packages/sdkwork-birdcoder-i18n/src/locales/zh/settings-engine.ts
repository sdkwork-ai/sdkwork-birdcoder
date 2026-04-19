import { defineLocaleModule } from '../resource.ts';

export default defineLocaleModule('settings/engine', {
  settings: {
    engines: {
      title: '\u4ee3\u7801\u5f15\u64ce\u4e0e\u6a21\u578b',
      description:
        '\u4e3a\u6bcf\u4e2a\u5f15\u64ce\u5b9a\u4e49\u9ed8\u8ba4\u6a21\u578b\uff0c\u5e76\u901a\u8fc7\u81ea\u5b9a\u4e49\u6761\u76ee\u6269\u5c55\u53ef\u7528\u6a21\u578b\u5217\u8868\u3002',
      defaultModel: '\u9ed8\u8ba4\u6a21\u578b',
      defaultModelDesc:
        '\u5f53\u8be5\u5f15\u64ce\u88ab\u6fc0\u6d3b\u7528\u4e8e\u65b0\u4e00\u8f6e\u5bf9\u8bdd\u65f6\u4f7f\u7528\u3002',
      primaryLane: '\u4e3b\u901a\u9053',
      strategy: '\u63a5\u5165\u7b56\u7565',
      runtimeOwner: '\u8fd0\u884c\u5f52\u5c5e',
      bridgeProtocol: '\u6865\u63a5\u534f\u8bae',
      fallbackLanes: '\u964d\u7ea7\u901a\u9053',
      deliveryLanes: '\u4ea4\u4ed8\u901a\u9053',
      none: '\u65e0',
      strategyRustNative: 'Rust \u539f\u751f',
      strategyGrpcBridge: 'gRPC \u6865\u63a5',
      strategyOpenApiProxy: 'OpenAPI \u4ee3\u7406',
      strategyRemoteControl: '\u8fdc\u7a0b\u63a7\u5236',
      strategyCliSpawn: 'CLI \u542f\u52a8',
      runtimeOwnerRustServer: 'Rust Server',
      runtimeOwnerTypescriptBridge: 'TypeScript \u6865\u63a5',
      runtimeOwnerExternalService: '\u5916\u90e8\u670d\u52a1',
      bridgeProtocolDirect: '\u76f4\u8fde',
      bridgeProtocolGrpc: 'gRPC',
      bridgeProtocolHttp: 'HTTP',
      bridgeProtocolWebsocket: 'WebSocket',
      bridgeProtocolStdio: 'STDIO',
      serverReady: 'Rust Server \u5df2\u63a5\u5165',
      serverPlanned: '\u670d\u52a1\u7aef\u5f85\u5b9e\u73b0',
      serverUnavailable:
        '{{engine}} \u7684 server adapter \u5c1a\u672a\u5b9e\u73b0\u3002BirdCoder \u5f53\u524d\u901a\u8fc7 Rust server \u8def\u7531\u771f\u5b9e\u7684 coding turn\uff0c\u76ee\u524d\u53ea\u542f\u7528 Codex \u548c OpenCode\u3002',
      builtInModel: '\u5185\u7f6e',
      customModel: '\u81ea\u5b9a\u4e49',
      removeCustomModel: '\u79fb\u9664\u81ea\u5b9a\u4e49\u6a21\u578b',
      addCustomModel: '\u6dfb\u52a0\u81ea\u5b9a\u4e49\u6a21\u578b',
      addCustomModelDesc:
        '\u4e3a\u79c1\u6709\u5316\u90e8\u7f72\uff0c\u65b0\u7684 server adapter\uff0c\u6216\u7070\u5ea6\u53d1\u5e03\u6ce8\u518c\u989d\u5916\u7684 model ID\u3002',
      modelIdPlaceholder: '\u6a21\u578b ID\uff0c\u4f8b\u5982 codex-pro',
      modelLabelPlaceholder: '\u663e\u793a\u540d\u79f0\uff0c\u53ef\u9009',
      addModel: '\u6dfb\u52a0\u6a21\u578b',
      modelAdded: '{{engine}} \u7684\u6a21\u578b\u5217\u8868\u5df2\u66f4\u65b0\u3002',
      modelAlreadyExists: '{{engine}} \u4e2d\u5df2\u5b58\u5728\u8be5\u6a21\u578b\u3002',
      modelRemoved: '{{engine}} \u7684\u6a21\u578b\u5df2\u79fb\u9664\u3002',
      defaultModelUpdated: '{{engine}} \u7684\u9ed8\u8ba4\u6a21\u578b\u5df2\u66f4\u65b0\u3002',
    },
  },
});
