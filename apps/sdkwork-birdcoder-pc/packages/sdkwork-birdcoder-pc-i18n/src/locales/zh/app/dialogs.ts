import { defineLocaleModule } from '../../resource.ts';

export default defineLocaleModule('app/dialogs', {
  app: {
    delete: '删除',
    deleteProjectTitle: '删除项目',
    deleteProjectConfirm: '您确定要删除此项目吗？此操作无法撤销。',
    aboutTitle: 'BirdCoder IDE',
    aboutVersion: '版本 1.0.0 (Beta)',
    aboutDescription: '面向未来编码体验打造的现代 AI 开发环境。',
    close: '关闭',
    whatsNewTitle: 'BirdCoder 新功能',
    whatsNewFeature1Title: 'AI 聊天集成',
    whatsNewFeature1Desc: '可直接在编码工作台中与 Codex、Claude 和 OpenCode 模型协作。',
    whatsNewFeature2Title: '高级文件资源管理器',
    whatsNewFeature2Desc: '轻松创建、重命名和删除文件与目录，完整支持嵌套层级。',
    whatsNewFeature3Title: '终端与调试',
    whatsNewFeature3Desc: '集成终端和调试能力，无需离开 IDE 即可运行与验证代码。',
    gotIt: '知道了',
    keyboardShortcutsTitle: '键盘快捷键',
    shortcutsGeneral: '常规',
    shortcutsEditor: '编辑器',
    shortcutsView: '视图',
    shortcutsNavigation: '导航',
  },
});
