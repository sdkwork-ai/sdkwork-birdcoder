import { useMemo, useState } from 'react';
import {
  Check,
  Download,
  FolderPlus,
  LayoutTemplate,
  Plus,
  Search,
  Star,
  Tag,
} from 'lucide-react';
import {
  importLocalFolderProject,
  useIDEServices,
  useProjects,
  useToast,
} from '@sdkwork/birdcoder-commons';

interface Template {
  id: string;
  title: string;
  description: string;
  icon: string;
  tags: string[];
  author: string;
  downloads: string;
  stars: string;
  category: 'community' | 'saas' | 'mine';
}

const MOCK_TEMPLATES: Template[] = [
  {
    id: 't1',
    title: 'Next.js Blog Starter',
    description: 'A modern blog starter with Next.js 14, App Router, Tailwind CSS, and MDX support.',
    icon: 'N',
    tags: ['Next.js', 'React', 'Tailwind'],
    author: 'Community',
    downloads: '12k',
    stars: '4.5k',
    category: 'community',
  },
  {
    id: 't2',
    title: 'Vue3 Admin Pro',
    description: 'Enterprise-level admin dashboard template built with Vue 3, Vite, and Element Plus.',
    icon: 'V',
    tags: ['Vue3', 'Admin', 'TypeScript'],
    author: 'Community',
    downloads: '8.2k',
    stars: '3.1k',
    category: 'community',
  },
  {
    id: 't3',
    title: 'Express API Boilerplate',
    description: 'Production-ready Node.js REST API boilerplate with Express, Mongoose, and JWT auth.',
    icon: 'E',
    tags: ['Node.js', 'Express', 'MongoDB'],
    author: 'Community',
    downloads: '15k',
    stars: '5.2k',
    category: 'community',
  },
  {
    id: 't4',
    title: 'React Native Expo',
    description: 'Cross-platform mobile app starter using React Native and Expo with navigation pre-configured.',
    icon: 'R',
    tags: ['React Native', 'Mobile', 'Expo'],
    author: 'Community',
    downloads: '9.5k',
    stars: '2.8k',
    category: 'community',
  },
  {
    id: 't5',
    title: 'Sdkwork ERP Base',
    description: 'Official Sdkwork enterprise resource planning base template with multi-tenant architecture.',
    icon: 'ERP',
    tags: ['SaaS', 'ERP', 'Multi-tenant'],
    author: 'Sdkwork',
    downloads: '5.1k',
    stars: '1.2k',
    category: 'saas',
  },
  {
    id: 't6',
    title: 'AI Agent Scaffolding',
    description: 'Quickly build and deploy AI agents with built-in LLM integrations and memory management.',
    icon: 'AI',
    tags: ['AI', 'LLM', 'Agent'],
    author: 'Sdkwork',
    downloads: '18k',
    stars: '6.5k',
    category: 'saas',
  },
  {
    id: 't7',
    title: 'E-commerce Core',
    description: 'High-performance e-commerce storefront template with cart, checkout, and payment integrations.',
    icon: 'EC',
    tags: ['E-commerce', 'Stripe', 'Next.js'],
    author: 'Sdkwork',
    downloads: '7.3k',
    stars: '2.4k',
    category: 'saas',
  },
  {
    id: 't8',
    title: 'My Personal Portfolio',
    description: 'A personal portfolio base with dark mode and smooth section transitions.',
    icon: 'PF',
    tags: ['Portfolio', 'Motion'],
    author: 'Me',
    downloads: '0',
    stars: '0',
    category: 'mine',
  },
  {
    id: 't9',
    title: 'Python FastAPI',
    description: 'High-performance API backend using FastAPI, SQLAlchemy, and Alembic.',
    icon: 'P',
    tags: ['Python', 'FastAPI', 'Backend'],
    author: 'Community',
    downloads: '11k',
    stars: '4.1k',
    category: 'community',
  },
  {
    id: 't10',
    title: 'Microservices Gateway',
    description: 'API gateway starter for a microservices deployment with auth, routing, and observability.',
    icon: 'MG',
    tags: ['Microservices', 'Gateway', 'Docker'],
    author: 'Sdkwork',
    downloads: '4.2k',
    stars: '1.8k',
    category: 'saas',
  },
  {
    id: 't11',
    title: 'SvelteKit E-commerce',
    description: 'A lightweight storefront starter built with SvelteKit and Stripe checkout.',
    icon: 'S',
    tags: ['Svelte', 'E-commerce', 'Stripe'],
    author: 'Community',
    downloads: '3.4k',
    stars: '1.2k',
    category: 'community',
  },
  {
    id: 't12',
    title: 'Go Microservice',
    description: 'A standardized Go microservice base with gRPC, structured logging, and metrics.',
    icon: 'G',
    tags: ['Go', 'Microservices', 'gRPC'],
    author: 'Community',
    downloads: '6.7k',
    stars: '2.9k',
    category: 'community',
  },
  {
    id: 't13',
    title: 'Data Analytics Dashboard',
    description: 'A real-time analytics dashboard with WebSockets, charts, and event streaming patterns.',
    icon: 'DA',
    tags: ['Analytics', 'WebSockets', 'Charts'],
    author: 'Sdkwork',
    downloads: '8.9k',
    stars: '3.4k',
    category: 'saas',
  },
  {
    id: 't14',
    title: 'Internal Tool Base',
    description: 'A shared internal tool base with auth, permissions, and reusable admin UI patterns.',
    icon: 'IT',
    tags: ['Internal', 'React', 'Tailwind'],
    author: 'Me',
    downloads: '0',
    stars: '0',
    category: 'mine',
  },
];

const CATEGORY_TABS: Array<{ id: 'all' | Template['category']; label: string }> = [
  { id: 'all', label: 'All templates' },
  { id: 'community', label: 'Community' },
  { id: 'saas', label: 'Sdkwork SaaS' },
  { id: 'mine', label: 'Mine' },
];

interface TemplatesPageProps {
  workspaceId?: string;
  onProjectCreated?: (projectId: string) => void;
}

export function TemplatesPage({ workspaceId, onProjectCreated }: TemplatesPageProps) {
  const { createProject, updateProject } = useProjects(workspaceId);
  const { fileSystemService, projectService } = useIDEServices();
  const { addToast } = useToast();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<'all' | Template['category']>('all');
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);

  const filteredTemplates = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();
    return MOCK_TEMPLATES.filter((template) => {
      const matchesCategory = activeCategory === 'all' || template.category === activeCategory;
      const matchesQuery =
        normalizedQuery.length === 0
        || template.title.toLowerCase().includes(normalizedQuery)
        || template.description.toLowerCase().includes(normalizedQuery)
        || template.tags.some((tag) => tag.toLowerCase().includes(normalizedQuery));

      return matchesCategory && matchesQuery;
    });
  }, [activeCategory, searchQuery]);

  async function selectFolderAndImportProject(fallbackProjectName: string) {
    const { openLocalFolder } = await import('@sdkwork/birdcoder-commons/platform/fileSystem');
    const folderInfo = await openLocalFolder();
    if (!folderInfo) {
      return null;
    }

    const normalizedWorkspaceId = workspaceId?.trim() ?? '';

    return importLocalFolderProject({
      createProject,
      fallbackProjectName,
      folderInfo,
      getProjects: () =>
        normalizedWorkspaceId
          ? projectService.getProjects(normalizedWorkspaceId)
          : Promise.resolve([]),
      mountFolder: (projectId, nextFolderInfo) =>
        fileSystemService.mountFolder(projectId, nextFolderInfo),
      updateProject,
    });
  }

  async function handleCreateProjectFromTemplate(template: Template) {
    if (!workspaceId) {
      addToast('Select a workspace before creating a project from a template.', 'error');
      return;
    }

    setSelectedTemplateId(template.id);
    try {
      const project = await selectFolderAndImportProject(template.title);
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
    } catch (error) {
      addToast(`Failed to create "${template.title}".`, 'error');
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
                  Start BirdCoder workspaces from curated starter kits without changing the product shape.
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
              placeholder="Search templates (Ctrl+K)"
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
        {filteredTemplates.length === 0 ? (
          <div className="flex h-full min-h-[260px] flex-col items-center justify-center rounded-2xl border border-dashed border-white/10 bg-white/[0.03] text-center">
            <LayoutTemplate size={28} className="mb-3 text-gray-500" />
            <h2 className="text-base font-semibold text-white">No templates matched</h2>
            <p className="mt-1 max-w-md text-sm text-gray-400">
              Try a different search term or switch back to another category.
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
                        <Download size={12} />
                        {template.downloads}
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
                      Standardized BirdCoder starter
                    </span>
                    <button
                      type="button"
                      onClick={() => handleCreateProjectFromTemplate(template)}
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
              Turn an existing project into a reusable BirdCoder template once your workspace flow stabilizes.
            </p>
          </div>
          <button
            type="button"
            onClick={() => addToast('Template publishing is reserved for the next iteration.', 'info')}
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

