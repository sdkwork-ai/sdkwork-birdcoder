import { defineConfig } from 'vitepress';
import { localSearchOptions, publicDocsSrcExclude } from './searchIndexPolicy';

const nav = [
  { text: 'Guide', link: '/guide/getting-started' },
  { text: 'Architecture', link: '/architecture/tech/TECH_ARCHITECTURE' },
  { text: 'Operations', link: '/guides/operator/deployment-operations' },
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
  '/guides/operator/': [
    {
      text: 'Operator Guides',
      items: [
        { text: 'Overview', link: '/guides/operator/' },
        { text: 'Deployment Operations', link: '/guides/operator/deployment-operations' },
        { text: 'Windows Server Control Plane', link: '/guides/operator/windows-server-control-plane' },
        { text: 'Backup And Restore', link: '/guides/operator/backup-restore' },
        { text: 'Monitoring And Alerting', link: '/guides/operator/monitoring' },
        { text: 'Incident Response', link: '/guides/operator/incident-response' },
      ],
    },
  ],
  '/reference/': [
    {
      text: 'Reference',
      items: [
        { text: 'API Overview', link: '/reference/api-reference' },
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
};

export default defineConfig({
  title: 'SDKWork BirdCoder',
  description:
    'SDKWork BirdCoder product, coding-workbench architecture, operations, and API documentation.',
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
      message: 'SDKWork BirdCoder coding-workbench documentation.',
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
