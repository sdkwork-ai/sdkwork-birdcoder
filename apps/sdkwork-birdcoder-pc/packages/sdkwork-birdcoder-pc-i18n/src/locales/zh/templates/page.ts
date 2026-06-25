import { defineLocaleModule } from '../../resource.ts';

export default defineLocaleModule('templates/page', {
  templates: {
    title: '项目模板',
    subtitle: '由 BirdCoder 服务端目录提供的精选应用 starter。',
    searchPlaceholder: '搜索模板',
    signInRequired: '请先登录后再从模板创建项目。',
    selectWorkspaceRequired: '从模板创建项目前请先选择工作区。',
    createdFromTemplate: '已从模板创建“{{title}}”。',
    createFailed: '创建“{{title}}”失败。',
  },
});
