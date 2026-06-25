import { defineLocaleModule } from '../../resource.ts';

export default defineLocaleModule('ui/content-preview', {
  ui: {
    contentPreview: '内容预览',
    previewAvailableWhenVisible: '文件有可见内容后即可预览。',
    renderingCodePreview: '正在渲染代码预览...',
    renderingMarkdownPreview: '正在渲染 Markdown 预览...',
    renderingStructuredDataPreview: '正在渲染结构化数据预览...',
    renderingConfigPreview: '正在渲染配置预览...',
    renderingTablePreview: '正在渲染表格预览...',
  },
});
