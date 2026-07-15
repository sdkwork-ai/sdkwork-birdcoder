import { defineLocaleModule } from '../../resource.ts';

export default defineLocaleModule('app/bootstrap', {
  bootstrap: {
    startingTitle: 'SDKWork BirdCoder',
    bootingDescription: '正在连接本地运行时并准备工作区。',
    desktopApiUnavailable:
      '嵌入式运行时（{{apiBaseUrl}}）尚未就绪。请立即重试；若问题持续，请完全退出并重新启动 BirdCoder。',
    localApiUnavailable:
      '无法连接 BirdCoder 服务（{{apiBaseUrl}}）。请确认本地服务正在运行，然后重试。',
    runtimeStage: '本地运行时',
    sessionStage: '安全会话',
    workspaceStage: '工作区壳层',
    validatingSession: '正在验证安全会话。',
    loadingWorkspace: '正在加载工作区壳层。',
    startupFailed: '启动未完成。请查看错误信息后重试。',
    retry: '重试',
    startupTimeout: '启动在 {{seconds}} 秒内未完成。',
    unknownFailure: '未知启动失败',
  },
});
