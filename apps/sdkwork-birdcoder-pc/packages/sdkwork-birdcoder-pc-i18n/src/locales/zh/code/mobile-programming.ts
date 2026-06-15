import { defineLocaleModule } from '../../resource.ts';

export default defineLocaleModule('code/mobile-programming', {
  code: {
    mobileProgramming: {
      eyebrow: '移动端编程模拟器',
      title: '像在真实手机上一样体验移动端编程',
      description:
        '扫码打开当前项目，在手机里继续通过代码编程助手完成需求、改代码、看预览。',
      workspaceLabel: '\u5de5\u4f5c\u533a',
      projectLabel: '\u9879\u76ee',
      sessionLabel: '\u4f1a\u8bdd',
      unavailable: '\u6682\u672a\u63d0\u4f9b',
      qrAlt: '\u79fb\u52a8\u7aef\u7f16\u7a0b\u4e8c\u7ef4\u7801',
      qrLoadingTitle: '\u6b63\u5728\u751f\u6210\u4e8c\u7ef4\u7801',
      qrUnavailableTitle: '\u4e8c\u7ef4\u7801\u751f\u6210\u5931\u8d25',
      contextHint:
        '\u8fd9\u4e2a\u4e8c\u7ef4\u7801\u5df2\u7ecf\u5305\u542b\u5f53\u524d\u5de5\u4f5c\u533a\u3001\u9879\u76ee\u548c\u4f1a\u8bdd\u4e0a\u4e0b\u6587\uff0c\u624b\u673a\u7aef\u53ef\u4ee5\u4ece\u540c\u4e00\u4e2a\u7f16\u7a0b\u573a\u666f\u7ee7\u7eed\u3002',
      simulatorLabel: '展示移动端代码助手对话的手机模拟器',
      simulatorStatus: '移动端助手在线',
      simulatorSubtitle: '已接入当前代码会话',
      sessionFallback: '当前编程会话',
      projectFallback: 'BirdCoder 移动端项目',
      userMessage: '帮我把登录页改成手机验证码一键登录。',
      assistantMessagePlan:
        '已定位登录页面，我会同步调整表单、验证码状态和移动端预览。',
      codeFileLabel: 'src/pages/Login.tsx',
      assistantMessageCode:
        'export function LoginPanel() {\n  return <OtpLogin mode="mobile" />;\n}',
      assistantMessagePreview:
        '已完成。修改 2 个文件，并启动移动端模拟预览进行校验。',
      changeChip: '已修改 2 个文件',
      runChip: '预览运行中',
      composerPlaceholder: '继续让 BirdCoder 修改应用...',
      sendLabel: '发送移动端编程请求',
      scanPanelTitle: '移动端入口',
      scanTitle: '扫一扫',
      scanCta: '开始移动端编程',
      scanDescription:
        '打开 SDKWORK 手机端扫码，即可进入同一个项目、会话和代码上下文。',
      stepsEyebrow: '\u4f7f\u7528\u65b9\u5f0f',
      stepsTitle: '\u5728 SDKWORK app \u4e2d\u6253\u5f00',
      stepDownloadTitle: '\u4e0b\u8f7d SDKWORK app',
      stepDownloadDescription:
        '\u5148\u5728\u624b\u673a\u4e0a\u5b89\u88c5\u6700\u65b0\u7248 SDKWORK app\uff0c\u518d\u626b\u63cf\u5f53\u524d\u7f16\u7a0b\u4f1a\u8bdd\u3002',
      stepScanTitle: '\u6253\u5f00 app \u626b\u7801',
      stepScanDescription:
        '\u5728 SDKWORK app \u5185\u6253\u5f00\u626b\u7801\u5165\u53e3\uff0c\u626b\u63cf code \u89c6\u56fe\u4e2d\u7684\u8fd9\u4e2a\u4e8c\u7ef4\u7801\u3002',
      stepContinueTitle: '\u7ee7\u7eed\u79fb\u52a8\u7aef\u7f16\u7a0b',
      stepContinueDescription:
        '\u626b\u7801\u6210\u529f\u540e\uff0c\u5373\u53ef\u5728\u5173\u8054\u7684\u79fb\u52a8\u7aef\u754c\u9762\u4e2d\u7ee7\u7eed\u5f53\u524d\u7f16\u7a0b\u4f1a\u8bdd\u3002',
      installHint:
        '\u5982\u679c\u624b\u673a\u8fd8\u6ca1\u6709\u5b89\u88c5 SDKWORK app\uff0c\u8bf7\u5148\u5b89\u88c5\u540e\u518d\u56de\u5230\u8fd9\u91cc\u626b\u7801\u3002',
    },
  },
});
