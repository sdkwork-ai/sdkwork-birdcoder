import { defineConfig } from 'vitepress';
import { localSearchOptions, publicDocsSrcExclude } from './searchIndexPolicy';

const nav = [
  { text: 'Guide', link: '/guide/getting-started' },
  { text: 'Architecture', link: '/core/architecture' },
  { text: 'Architecture Standards', link: '/架构/' },
  { text: 'API Reference', link: '/reference/api-reference' },
  { text: 'Reference', link: '/reference/commands' },
  { text: 'Contributing', link: '/contributing/' },
];

const sidebar = {
  '/guide/': [
    {
      text: 'Guide',
      items: [
        { text: 'Getting Started', link: '/guide/getting-started' },
        { text: 'Application Modes', link: '/guide/application-modes' },
        { text: 'Install And Deploy', link: '/guide/install-and-deploy' },
        { text: 'Development', link: '/guide/development' },
      ],
    },
  ],
  '/core/': [
    {
      text: 'Architecture',
      items: [
        { text: 'Architecture', link: '/core/architecture' },
        { text: 'Packages', link: '/core/packages' },
        { text: 'Desktop Runtime', link: '/core/desktop' },
        { text: 'Release And Deployment', link: '/core/release-and-deployment' },
      ],
    },
  ],
  '/架构/': [
    {
      text: 'Architecture Standards',
      items: [
        { text: 'Overview', link: '/架构/' },
        { text: '01 Product Scope', link: '/架构/01-产品设计与需求范围' },
        { text: '02 Overall Design', link: '/架构/02-架构标准与总体设计' },
        { text: '03 Modules And Boundaries', link: '/架构/03-模块规划与边界' },
        { text: '04 Technology And Extensibility', link: '/架构/04-技术选型与可插拔策略' },
        { text: '05 Kernel And Code Engine', link: '/架构/05-统一Kernel与Code%20Engine标准' },
        { text: '06 Build Preview Simulator Test', link: '/架构/06-编译环境-预览-模拟器-测试体系' },
        { text: '07 Data State API Contracts', link: '/架构/07-数据模型-状态模型-接口契约' },
        { text: '08 Performance Security Observability', link: '/架构/08-性能-安全-可观测性标准' },
        { text: '09 Install Deploy Release', link: '/架构/09-安装-部署-发布标准' },
        { text: '10 Workflow And Quality Gates', link: '/架构/10-开发流程-质量门禁-评估标准' },
        { text: '11 Benchmark Matrix', link: '/架构/11-行业对标与能力矩阵' },
        { text: '12 Tool Protocol Sandbox Audit', link: '/架构/12-统一工具协议-权限沙箱-审计标准' },
        { text: '13 Rules Skills MCP Knowledge', link: '/架构/13-规则-技能-MCP-知识系统标准' },
        { text: '14 Current Baseline And Roadmap', link: '/架构/14-现状基线-差距-演进路线' },
        { text: '21 Multi-Engine SDK Adapter Standard', link: '/架构/21-多Code-Engine协议-SDK-适配标准' },
      ],
    },
  ],
  '/reference/': [
    {
      text: 'Reference',
      items: [
        { text: 'API Overview', link: '/reference/api-reference' },
        { text: 'Engine SDK Integration', link: '/reference/engine-sdk-integration' },
        { text: 'Commands', link: '/reference/commands' },
        { text: 'Environment', link: '/reference/environment' },
      ],
    },
  ],
  '/contributing/': [
    {
      text: 'Contributing',
      items: [{ text: 'Contributor Guide', link: '/contributing/' }],
    },
  ],
  '/release/': [
    {
      text: 'Release History',
      items: [
        { text: 'Legacy Release Entry', link: '/release' },
        { text: 'Release 2026-04-08-01', link: '/release/release-2026-04-08-01' },
        { text: 'Release 2026-04-08-02', link: '/release/release-2026-04-08-02' },
      ],
    },
  ],
};

export default defineConfig({
  title: 'SDKWork BirdCoder',
  description:
    'Official SDKWork BirdCoder documentation for the AI IDE workspace, release system, and deployment modes.',
  cleanUrls: true,
  lastUpdated: true,
  srcExclude: publicDocsSrcExclude,
  themeConfig: {
    nav,
    sidebar,
    outline: {
      level: [2, 3],
      label: 'On this page',
    },
    footer: {
      message: 'Built for the SDKWork BirdCoder package-first AI IDE workspace and unified release architecture.',
      copyright: 'Copyright 2026 SDKWork BirdCoder contributors',
    },
    docFooter: {
      prev: 'Previous page',
      next: 'Next page',
    },
    sidebarMenuLabel: 'Menu',
    darkModeSwitchLabel: 'Appearance',
    returnToTopLabel: 'Back to top',
    search: {
      provider: 'local',
      options: localSearchOptions,
    },
  },
});
