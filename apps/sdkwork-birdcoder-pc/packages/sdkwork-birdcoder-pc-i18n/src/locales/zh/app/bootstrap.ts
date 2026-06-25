import { defineLocaleModule } from '../../resource.ts';

export default defineLocaleModule('app/bootstrap', {
  bootstrap: {
    startingTitle: '正在启动 SDKWork BirdCoder',
    bootingDescription: '正在准备本地运行时并加载应用壳层。',
    startupFailed: '启动未完成。请查看错误信息后重试。',
    retry: '重试',
    startupTimeout: '启动在 {{seconds}} 秒内未完成。',
    unknownFailure: '未知启动失败',
  },
});
