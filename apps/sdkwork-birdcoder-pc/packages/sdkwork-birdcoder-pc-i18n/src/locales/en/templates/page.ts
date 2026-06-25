import { defineLocaleModule } from '../../resource.ts';

export default defineLocaleModule('templates/page', {
  templates: {
    title: 'Project Templates',
    subtitle: 'Curated app starters served by the BirdCoder server catalog.',
    searchPlaceholder: 'Search templates',
    signInRequired: 'Sign in to create a project from a template.',
    selectWorkspaceRequired: 'Select a workspace before creating a project from a template.',
    createdFromTemplate: 'Created "{{title}}" from templates.',
    createFailed: 'Failed to create "{{title}}".',
  },
});
