import { defineLocaleModule } from '../../resource.ts';

export default defineLocaleModule('app/deeplink', {
  app: {
    deepLinkImportDialogTitle: '导入模型通道',
    deepLinkImportDialogEndpoint: '端点',
    deepLinkImportDialogApiKey: 'API Key',
    deepLinkImportDialogModel: '默认模型',
    deepLinkImportDialogHint: '确认后将写入客户端本地模型配置，可在 设置 → 模型接入 中查看并绑定引擎。',
    deepLinkChannelKindOfficial: '官方',
    deepLinkChannelKindRelay: '中转站',
    deepLinkChannelKindCustom: '高级自定义',
    deepLinkImportCancel: '取消',
    deepLinkImportConfirm: '确认导入',
    deepLinkImporting: '导入中…',
    deepLinkImportSucceeded: '已导入{{kind}}通道「{{name}}」，可在 设置 → 模型接入 中查看并绑定引擎。',
    deepLinkImportFailed: 'Deep link 导入失败：{{message}}',
    deepLinkParseFailed: 'Deep link 链接解析失败：{{error}}',
  },
});
