import { useEffect, useMemo, useState } from 'react';
import {
  Check,
  FolderPlus,
  LayoutTemplate,
  Plus,
  Search,
  Star,
  Tag,
} from 'lucide-react';
import type { BirdCoderAppTemplateSummary } from '@sdkwork/birdcoder-types';
import {
  importLocalFolderProject,
  openLocalFolder,
  useIDEServices,
  useProjects,
  useToast,
} from '@sdkwork/birdcoder-commons';

interface TemplateCardModel {
  id: string;
  title: string;
  description: string;
  icon: string;
  tags: string[];
  author: string;
  downloads: string;
  stars: string;
  category: 'community' | 'saas' | 'mine';
  versionId: string;
  presetKey: string;
}

const CATEGORY_TABS: Array<{ id: 'all' | TemplateCardModel['category']; label: string }> = [
  { id: 'all', label: 'All templates' },
  { id: 'community', label: 'Community' },
  { id: 'saas', label: 'SDKWork SaaS' },
  { id: 'mine', label: 'Mine' },
];

interface TemplatesPageProps {
  isAuthenticated?: boolean;
  onRequireAuth?: () => void;
  workspaceId?: string;
  onProjectCreated?: (projectId: string) => void;
}

function formatCount(value?: number): string {
  if (!value || value <= 0) {
    return '0';
  }
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(1).replace(/\.0$/u, '')}m`;
  }
  if (value >= 1_000) {
    return `${(value / 1_000).toFixed(1).replace(/\.0$/u, '')}k`;
  }
  return String(value);
}

function toTemplateCardModel(summary: BirdCoderAppTemplateSummary): TemplateCardModel {
  let category: TemplateCardModel['category'] = 'community';
  if (summary.category === 'saas') {
    category = 'saas';
  } else if (summary.category === 'mine') {
    category = 'mine';
  }

  return {
    id: summary.id,
    title: summary.name,
    description: summary.description,
    icon: summary.icon || summary.name.slice(0, 2).toUpperCase(),
    tags: summary.tags,
    author: summary.author || 'Unknown',
    downloads: formatCount(summary.downloads),
    stars: formatCount(summary.stars),
    category,
    versionId: summary.versionId,
    presetKey: summary.presetKey,
  };
}

export function TemplatesPage({
  isAuthenticated = false,
  onProjectCreated,
  onRequireAuth,
  workspaceId,
}: TemplatesPageProps) {
  const { createProject, updateProject } = useProjects(workspaceId);
  const { catalogService, fileSystemService, projectService } = useIDEServices();
  const { addToast } = useToast();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<'all' | TemplateCardModel['category']>('all');
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [templates, setTemplates] = useState<TemplateCardModel[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadTemplates() {
      setIsLoading(true);
      setError(null);
      try {
        const nextTemplates = await catalogService.getAppTemplates();
        if (cancelled) {
          return;
        }
        setTemplates(nextTemplates.map(toTemplateCardModel));
      } catch (loadError) {
        if (cancelled) {
          return;
        }
        setError(
          loadError instanceof Error && loadError.message.trim()
            ? loadError.message
            : 'Failed to load app templates.',
        );
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    void loadTemplates();
    return () => {
      cancelled = true;
    };
  }, [catalogService]);

  const filteredTemplates = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();
    return templates.filter((template) => {
      const matchesCategory =
        activeCategory === 'all' || template.category === activeCategory;
      const matchesQuery =
        normalizedQuery.length === 0 ||
        template.title.toLowerCase().includes(normalizedQuery) ||
        template.description.toLowerCase().includes(normalizedQuery) ||
        template.tags.some((tag) => tag.toLowerCase().includes(normalizedQuery));

      return matchesCategory && matchesQuery;
    });
  }, [activeCategory, searchQuery, templates]);

  async function selectFolderAndImportProject(template: TemplateCardModel) {
    const folderInfo = await openLocalFolder();
    if (!folderInfo) {
      return null;
    }

    const normalizedWorkspaceId = workspaceId?.trim() ?? '';

    return importLocalFolderProject({
      createProject: (name, options) =>
        createProject(name, {
          ...options,
          appTemplateVersionId: template.versionId,
          templatePresetKey: template.presetKey,
        }),
      fallbackProjectName: template.title,
      folderInfo,
      getProjectByPath: (projectPath) =>
        normalizedWorkspaceId
          ? projectService.getProjectByPath(normalizedWorkspaceId, projectPath)
          : Promise.resolve(null),
      mountFolder: (projectId, nextFolderInfo) =>
        fileSystemService.mountFolder(projectId, nextFolderInfo),
      updateProject,
    });
  }

  async function handleCreateProjectFromTemplate(template: TemplateCardModel) {
    if (!isAuthenticated) {
      addToast('Sign in to create a project from a template.', 'info');
      onRequireAuth?.();
      return;
    }

    if (!workspaceId?.trim()) {
      addToast('Select a workspace before creating a project from a template.', 'error');
      return;
    }

    setSelectedTemplateId(template.id);
    try {
      const project = await selectFolderAndImportProject(template);
      if (!project) {
        return;
      }
      if (!project.reusedExistingProject && project.projectName !== template.title) {
        await updateProject(project.projectId, {
          name: template.title,
        });
      }
      addToast(`Created "${template.title}" from templates.`, 'success');
      onProjectCreated?.(project.projectId);
    } catch (createError) {
      addToast(
        createError instanceof Error && createError.message.trim()
          ? createError.message
          : `Failed to create "${template.title}".`,
        'error',
      );
    } finally {
      setSelectedTemplateId(null);
    }
  }

  return (
    <div className="flex h-full flex-col bg-[#0e0e11] text-gray-100">
      <div className="border-b border-white/10 px-6 py-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/5 text-sm font-semibold text-white ring-1 ring-white/10">
                <LayoutTemplate size={18} />
              </div>
              <div>
                <h1 className="text-xl font-semibold text-white">Project Templates</h1>
                <p className="text-sm text-gray-400">
                  Curated app starters served by the BirdCoder server catalog.
                </p>
              </div>
            </div>
          </div>

          <div className="relative w-full max-w-md">
            <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={16} />
            <input
              type="text"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search templates"
              className="w-full rounded-xl border border-white/10 bg-white/5 py-3 pl-10 pr-4 text-sm text-white outline-none transition focus:border-blue-500/50 focus:bg-white/[0.07]"
            />
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {CATEGORY_TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveCategory(tab.id)}
              className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
                activeCategory === tab.id
                  ? 'bg-white text-black'
                  : 'border border-white/10 bg-white/5 text-gray-300 hover:bg-white/10'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-auto px-6 py-6">
        {isLoading ? (
          <div className="flex min-h-[260px] items-center justify-center rounded-2xl border border-white/10 bg-white/[0.03]">
            <div className="flex items-center gap-3 text-sm text-gray-300">
              <LayoutTemplate size={18} />
              Loading templates...
            </div>
          </div>
        ) : error ? (
          <div className="flex min-h-[260px] flex-col items-center justify-center rounded-2xl border border-red-500/20 bg-red-500/5 text-center">
            <h2 className="text-base font-semibold text-white">Failed to load templates</h2>
            <p className="mt-1 max-w-md text-sm text-red-200/80">{error}</p>
          </div>
        ) : filteredTemplates.length === 0 ? (
          <div className="flex min-h-[260px] flex-col items-center justify-center rounded-2xl border border-dashed border-white/10 bg-white/[0.03] text-center">
            <LayoutTemplate size={28} className="mb-3 text-gray-500" />
            <h2 className="text-base font-semibold text-white">No templates matched</h2>
            <p className="mt-1 max-w-md text-sm text-gray-400">
              Try a different search term or switch to another category.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2 2xl:grid-cols-3">
            {filteredTemplates.map((template) => {
              const creating = selectedTemplateId === template.id;

              return (
                <article
                  key={template.id}
                  className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 shadow-[0_20px_60px_-40px_rgba(0,0,0,0.9)]"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-500/10 text-sm font-semibold text-blue-300 ring-1 ring-blue-400/20">
                        {template.icon}
                      </div>
                      <div>
                        <h2 className="text-base font-semibold text-white">{template.title}</h2>
                        <p className="text-xs uppercase tracking-[0.18em] text-gray-500">{template.author}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-gray-400">
                      <span className="inline-flex items-center gap-1">
                        <LayoutTemplate size={12} />
                        v1
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Star size={12} />
                        {template.stars}
                      </span>
                    </div>
                  </div>

                  <p className="mt-4 text-sm leading-6 text-gray-300">{template.description}</p>

                  <div className="mt-4 flex flex-wrap gap-2">
                    {template.tags.map((tag) => (
                      <span
                        key={tag}
                        className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] text-gray-300"
                      >
                        <Tag size={11} />
                        {tag}
                      </span>
                    ))}
                  </div>

                  <div className="mt-5 flex items-center justify-between gap-3">
                    <span className="inline-flex items-center gap-2 text-xs text-gray-500">
                      <Check size={12} />
                      Server catalog template
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        void handleCreateProjectFromTemplate(template);
                      }}
                      disabled={creating}
                      className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {creating ? <Check size={14} /> : <FolderPlus size={14} />}
                      {creating ? 'Creating...' : 'Use Template'}
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>

      <div className="border-t border-white/10 px-6 py-4">
        <div className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-white/[0.02] px-4 py-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-sm font-semibold text-white">Need a custom starter?</h2>
            <p className="text-sm text-gray-400">
              Template publishing stays server-managed; the current desktop surface is read and instantiate only.
            </p>
          </div>
          <button
            type="button"
            onClick={() => addToast('Template publishing is not implemented yet.', 'info')}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-gray-200 transition hover:bg-white/10"
          >
            <Plus size={14} />
            Publish Template
          </button>
        </div>
      </div>
    </div>
  );
}
