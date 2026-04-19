import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Copy,
  Download,
  ExternalLink,
  FileText,
  Github,
  Globe,
  Loader2,
  Package,
  Search,
  Server,
  Settings,
  Shield,
  Tag,
  Zap,
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import {
  useIDEServices,
  usePersistedState,
  useToast,
} from '@sdkwork/birdcoder-commons';
import type {
  BirdCoderSkillCatalogEntrySummary,
  BirdCoderSkillPackageSummary,
} from '@sdkwork/birdcoder-types';
import type { Skill, SkillPackage } from './types';

const REGISTRIES = [
  { id: 'official', name: 'Official Registry', url: 'registry://official' },
  { id: 'aliyun', name: 'Alibaba Cloud Mirror', url: 'registry://aliyun' },
  { id: 'tencent', name: 'Tencent Cloud Mirror', url: 'registry://tencent' },
] as const;

type SkillTab = 'hub' | 'sdkwork' | 'installed' | 'packages';
type SkillView = 'main' | 'package-detail' | 'skill-detail';

interface SkillsPageProps {
  workspaceId?: string;
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

function mapSkill(entry: BirdCoderSkillCatalogEntrySummary): Skill {
  return {
    id: entry.id,
    packageId: entry.packageId,
    name: entry.name,
    desc: entry.description,
    icon: entry.icon || entry.name.slice(0, 2).toUpperCase(),
    installs: formatCount(entry.installCount),
    author: entry.author || 'Unknown',
    longDesc: entry.longDescription,
    version: entry.versionLabel,
    tags: entry.tags,
    isInstalled: entry.installed,
    license: entry.license,
    repository: entry.repositoryUrl,
    lastUpdated: entry.lastUpdated,
    readme: entry.readme,
  };
}

function mapSkillPackage(summary: BirdCoderSkillPackageSummary): SkillPackage {
  return {
    id: summary.id,
    name: summary.name,
    desc: summary.description,
    icon: summary.icon || summary.name.slice(0, 2).toUpperCase(),
    installs: formatCount(summary.installCount),
    author: summary.author || 'Unknown',
    version: summary.versionLabel,
    isInstalled: summary.installed,
    longDesc: summary.longDescription,
    sourceUri: summary.sourceUri,
    skills: summary.skills.map(mapSkill),
  };
}

export function SkillsPage({ workspaceId }: SkillsPageProps) {
  const { catalogService } = useIDEServices();
  const { addToast } = useToast();
  const normalizedWorkspaceId = workspaceId?.trim() ?? '';
  const [selectedRegistryId, setSelectedRegistryId] = usePersistedState<string>(
    'skills',
    'registry',
    REGISTRIES[0].id,
  );
  const [activeSkillTab, setActiveSkillTab] = useState<SkillTab>('hub');
  const [currentView, setCurrentView] = useState<SkillView>('main');
  const [selectedPackageId, setSelectedPackageId] = useState<string | null>(null);
  const [selectedSkillId, setSelectedSkillId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedCommand, setCopiedCommand] = useState<string | null>(null);
  const [installingId, setInstallingId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [packages, setPackages] = useState<SkillPackage[]>([]);
  const [showRegistryMenu, setShowRegistryMenu] = useState(false);
  const registryMenuRef = useRef<HTMLDivElement>(null);
  const selectedRegistry =
    REGISTRIES.find((registry) => registry.id === selectedRegistryId) ?? REGISTRIES[0];

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        registryMenuRef.current &&
        !registryMenuRef.current.contains(event.target as Node)
      ) {
        setShowRegistryMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadCatalog() {
      setIsLoading(true);
      setError(null);
      try {
        const nextPackages = await catalogService.getSkillPackages(
          normalizedWorkspaceId || undefined,
        );
        if (cancelled) {
          return;
        }
        setPackages(nextPackages.map(mapSkillPackage));
      } catch (loadError) {
        if (cancelled) {
          return;
        }
        setError(
          loadError instanceof Error && loadError.message.trim()
            ? loadError.message
            : 'Failed to load skill catalog.',
        );
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    void loadCatalog();
    return () => {
      cancelled = true;
    };
  }, [catalogService, normalizedWorkspaceId]);

  const skills = useMemo(() => packages.flatMap((skillPackage) => skillPackage.skills), [packages]);

  const filteredPackages = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();
    return packages.filter((skillPackage) => {
      if (!normalizedQuery) {
        return true;
      }
      return (
        skillPackage.name.toLowerCase().includes(normalizedQuery) ||
        skillPackage.desc.toLowerCase().includes(normalizedQuery) ||
        skillPackage.skills.some((skill) =>
          skill.name.toLowerCase().includes(normalizedQuery),
        )
      );
    });
  }, [packages, searchQuery]);

  const filteredSkills = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();
    return skills.filter((skill) => {
      if (!normalizedQuery) {
        return true;
      }
      return (
        skill.name.toLowerCase().includes(normalizedQuery) ||
        skill.desc.toLowerCase().includes(normalizedQuery) ||
        skill.tags?.some((tag) => tag.toLowerCase().includes(normalizedQuery))
      );
    });
  }, [searchQuery, skills]);

  const visiblePackages = useMemo(() => {
    if (activeSkillTab !== 'packages') {
      return filteredPackages;
    }
    return filteredPackages;
  }, [activeSkillTab, filteredPackages]);

  const visibleSkills = useMemo(() => {
    switch (activeSkillTab) {
      case 'sdkwork':
        return filteredSkills.filter((skill) => skill.author === 'SDKWork');
      case 'installed':
        return filteredSkills.filter((skill) => skill.isInstalled);
      case 'packages':
        return [];
      case 'hub':
      default:
        return filteredSkills;
    }
  }, [activeSkillTab, filteredSkills]);

  const selectedPackage =
    selectedPackageId == null
      ? null
      : packages.find((skillPackage) => skillPackage.id === selectedPackageId) ?? null;
  const selectedSkill =
    selectedSkillId == null
      ? null
      : skills.find((skill) => skill.id === selectedSkillId) ?? null;

  function buildSkillInstallCommand(skill: Skill): string {
    return `sdkwork install ${skill.packageId}`;
  }

  function buildPackageInstallCommand(skillPackage: SkillPackage): string {
    return `sdkwork install-pkg ${skillPackage.id}`;
  }

  async function copyCommand(command: string) {
    await navigator.clipboard.writeText(command);
    setCopiedCommand(command);
    window.setTimeout(() => setCopiedCommand(null), 2000);
  }

  async function installPackage(skillPackage: SkillPackage) {
    if (!normalizedWorkspaceId) {
      addToast('Select a workspace before installing a skill package.', 'error');
      return;
    }

    setInstallingId(skillPackage.id);
    try {
      await catalogService.installSkillPackage(skillPackage.id, {
        workspaceId: normalizedWorkspaceId,
      });
      const nextPackages = await catalogService.getSkillPackages(normalizedWorkspaceId);
      setPackages(nextPackages.map(mapSkillPackage));
      addToast(
        `Installed ${skillPackage.name} from ${selectedRegistry.name}.`,
        'success',
      );
    } catch (installError) {
      addToast(
        installError instanceof Error && installError.message.trim()
          ? installError.message
          : `Failed to install ${skillPackage.name}.`,
        'error',
      );
    } finally {
      setInstallingId(null);
    }
  }

  async function installSkill(skill: Skill) {
    const skillPackage =
      packages.find((candidate) => candidate.id === skill.packageId) ?? null;
    if (!skillPackage) {
      addToast('Skill package was not found.', 'error');
      return;
    }
    await installPackage(skillPackage);
  }

  function handleBack() {
    if (currentView === 'skill-detail' && selectedPackageId) {
      setCurrentView('package-detail');
      return;
    }
    setCurrentView('main');
    setSelectedPackageId(null);
    setSelectedSkillId(null);
  }

  function openPackage(skillPackage: SkillPackage) {
    setSelectedPackageId(skillPackage.id);
    setSelectedSkillId(null);
    setCurrentView('package-detail');
  }

  function openSkill(skill: Skill) {
    setSelectedPackageId(skill.packageId);
    setSelectedSkillId(skill.id);
    setCurrentView('skill-detail');
  }

  function renderInstallButton(itemId: string, installed: boolean, onInstall: () => Promise<void>) {
    if (installed) {
      return (
        <div className="inline-flex items-center gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-2 text-sm font-medium text-emerald-300">
          <CheckCircle2 size={16} />
          Installed
        </div>
      );
    }

    return (
      <button
        type="button"
        onClick={() => {
          void onInstall();
        }}
        disabled={installingId === itemId}
        className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {installingId === itemId ? (
          <Loader2 size={16} className="animate-spin" />
        ) : (
          <Download size={16} />
        )}
        {installingId === itemId ? 'Installing...' : 'Install'}
      </button>
    );
  }

  return (
    <div className="flex h-full flex-col bg-[#0e0e11] text-gray-100">
      <div className="border-b border-white/10 bg-[#16161b]/80 px-6 py-5 backdrop-blur">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-500/10 text-blue-300 ring-1 ring-blue-400/20">
                <Zap size={18} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  {currentView !== 'main' && (
                    <button
                      type="button"
                      onClick={handleBack}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-gray-300 transition hover:bg-white/10 hover:text-white"
                    >
                      <ChevronLeft size={16} />
                    </button>
                  )}
                  <h1 className="text-xl font-semibold text-white">
                    {currentView === 'package-detail'
                      ? selectedPackage?.name || 'Skill Package'
                      : currentView === 'skill-detail'
                        ? selectedSkill?.name || 'Skill'
                        : 'Skills Hub'}
                  </h1>
                  {currentView !== 'main' && (
                    <ChevronRight size={16} className="text-gray-500" />
                  )}
                </div>
                <p className="text-sm text-gray-400">
                  Real catalog data served by the BirdCoder server authority.
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative" ref={registryMenuRef}>
              <button
                type="button"
                onClick={() => setShowRegistryMenu((value) => !value)}
                className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-gray-200 transition hover:bg-white/10"
              >
                <Server size={14} className="text-blue-300" />
                <span>{selectedRegistry.name}</span>
                <ChevronDown size={14} className="text-gray-500" />
              </button>
              {showRegistryMenu && (
                <div className="absolute right-0 top-full z-20 mt-2 min-w-[220px] rounded-2xl border border-white/10 bg-[#16161b] p-2 shadow-2xl">
                  {REGISTRIES.map((registry) => (
                    <button
                      key={registry.id}
                      type="button"
                      onClick={() => {
                        setSelectedRegistryId(registry.id);
                        setShowRegistryMenu(false);
                      }}
                      className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm text-gray-200 transition hover:bg-white/10"
                    >
                      <span>{registry.name}</span>
                      {registry.id === selectedRegistry.id ? (
                        <Check size={14} className="text-blue-300" />
                      ) : null}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="relative w-full min-w-[260px] max-w-md">
              <Search
                size={16}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-500"
              />
              <input
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search skills and packages"
                className="w-full rounded-xl border border-white/10 bg-white/5 py-2.5 pl-10 pr-4 text-sm text-white outline-none transition focus:border-blue-500/50"
              />
            </div>
          </div>
        </div>

        {currentView === 'main' && (
          <div className="mt-4 flex flex-wrap gap-2">
            {[
              { id: 'hub', label: 'All Skills', count: skills.length },
              { id: 'packages', label: 'Packages', count: packages.length },
              {
                id: 'sdkwork',
                label: 'SDKWork',
                count: skills.filter((skill) => skill.author === 'SDKWork').length,
              },
              {
                id: 'installed',
                label: 'Installed',
                count: skills.filter((skill) => skill.isInstalled).length,
              },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveSkillTab(tab.id as SkillTab)}
                className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
                  activeSkillTab === tab.id
                    ? 'bg-white text-black'
                    : 'border border-white/10 bg-white/5 text-gray-300 hover:bg-white/10'
                }`}
              >
                {tab.label} · {tab.count}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="flex-1 overflow-auto px-6 py-6">
        {isLoading ? (
          <div className="flex min-h-[240px] items-center justify-center rounded-2xl border border-white/10 bg-white/[0.03]">
            <div className="flex items-center gap-3 text-sm text-gray-300">
              <Loader2 size={18} className="animate-spin" />
              Loading skill catalog...
            </div>
          </div>
        ) : error ? (
          <div className="flex min-h-[240px] flex-col items-center justify-center rounded-2xl border border-red-500/20 bg-red-500/5 text-center">
            <p className="text-base font-semibold text-white">Failed to load skills</p>
            <p className="mt-2 max-w-xl text-sm text-red-200/80">{error}</p>
          </div>
        ) : currentView === 'main' ? (
          activeSkillTab === 'packages' ? (
            visiblePackages.length === 0 ? (
              <EmptyState query={searchQuery} />
            ) : (
              <div className="grid grid-cols-1 gap-4 xl:grid-cols-2 2xl:grid-cols-3">
                {visiblePackages.map((skillPackage) => (
                  <article
                    key={skillPackage.id}
                    className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 shadow-[0_20px_60px_-40px_rgba(0,0,0,0.9)]"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <button
                        type="button"
                        onClick={() => openPackage(skillPackage)}
                        className="flex items-center gap-3 text-left"
                      >
                        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-500/10 text-sm font-semibold text-blue-300 ring-1 ring-blue-400/20">
                          {skillPackage.icon}
                        </div>
                        <div>
                          <h2 className="text-base font-semibold text-white">{skillPackage.name}</h2>
                          <p className="text-xs uppercase tracking-[0.18em] text-gray-500">
                            {skillPackage.author}
                          </p>
                        </div>
                      </button>
                      <div className="text-right text-xs text-gray-400">
                        <div className="inline-flex items-center gap-1">
                          <Package size={12} />
                          {skillPackage.skills.length} skills
                        </div>
                        <div className="mt-1 inline-flex items-center gap-1">
                          <Download size={12} />
                          {skillPackage.installs}
                        </div>
                      </div>
                    </div>

                    <p className="mt-4 text-sm leading-6 text-gray-300">{skillPackage.desc}</p>

                    <div className="mt-5 flex items-center justify-between gap-3">
                      <span className="text-xs text-gray-500">v{skillPackage.version}</span>
                      {renderInstallButton(
                        skillPackage.id,
                        Boolean(skillPackage.isInstalled),
                        async () => installPackage(skillPackage),
                      )}
                    </div>
                  </article>
                ))}
              </div>
            )
          ) : visibleSkills.length === 0 ? (
            <EmptyState query={searchQuery} />
          ) : (
            <div className="grid grid-cols-1 gap-4 xl:grid-cols-2 2xl:grid-cols-3">
              {visibleSkills.map((skill) => (
                <article
                  key={skill.id}
                  className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 shadow-[0_20px_60px_-40px_rgba(0,0,0,0.9)]"
                >
                  <div className="flex items-start justify-between gap-4">
                    <button
                      type="button"
                      onClick={() => openSkill(skill)}
                      className="flex items-center gap-3 text-left"
                    >
                      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/5 text-sm font-semibold text-white ring-1 ring-white/10">
                        {skill.icon}
                      </div>
                      <div>
                        <h2 className="text-base font-semibold text-white">{skill.name}</h2>
                        <p className="text-xs uppercase tracking-[0.18em] text-gray-500">
                          {skill.author}
                        </p>
                      </div>
                    </button>
                    <span className="text-xs text-gray-500">v{skill.version || '1.0.0'}</span>
                  </div>

                  <p className="mt-4 text-sm leading-6 text-gray-300">{skill.desc}</p>

                  <div className="mt-4 flex flex-wrap gap-2">
                    {(skill.tags || []).map((tag) => (
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
                    <span className="inline-flex items-center gap-1 text-xs text-gray-500">
                      <Download size={12} />
                      {skill.installs}
                    </span>
                    {renderInstallButton(
                      skill.id,
                      Boolean(skill.isInstalled),
                      async () => installSkill(skill),
                    )}
                  </div>
                </article>
              ))}
            </div>
          )
        ) : currentView === 'package-detail' && selectedPackage ? (
          <div className="mx-auto max-w-6xl space-y-8">
            <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-6">
              <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
                <div className="flex items-start gap-4">
                  <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-blue-500/10 text-xl font-semibold text-blue-300 ring-1 ring-blue-400/20">
                    {selectedPackage.icon}
                  </div>
                  <div className="space-y-3">
                    <div>
                      <h2 className="text-3xl font-semibold text-white">{selectedPackage.name}</h2>
                      <p className="mt-1 text-sm text-gray-400">{selectedPackage.author}</p>
                    </div>
                    <p className="max-w-3xl text-sm leading-7 text-gray-300">
                      {selectedPackage.longDesc || selectedPackage.desc}
                    </p>
                    <div className="flex flex-wrap items-center gap-4 text-sm text-gray-400">
                      <span className="inline-flex items-center gap-1">
                        <Package size={14} />
                        {selectedPackage.skills.length} skills
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Download size={14} />
                        {selectedPackage.installs}
                      </span>
                      <span>v{selectedPackage.version}</span>
                    </div>
                  </div>
                </div>
                <div className="space-y-3">
                  {renderInstallButton(
                    selectedPackage.id,
                    Boolean(selectedPackage.isInstalled),
                    async () => installPackage(selectedPackage),
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      void copyCommand(buildPackageInstallCommand(selectedPackage));
                    }}
                    className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-gray-200 transition hover:bg-white/10"
                  >
                    {copiedCommand === buildPackageInstallCommand(selectedPackage) ? (
                      <Check size={16} className="text-emerald-300" />
                    ) : (
                      <Copy size={16} />
                    )}
                    Copy install command
                  </button>
                </div>
              </div>
            </section>

            <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-6">
              <div className="mb-4 flex items-center gap-2">
                <Package size={18} className="text-blue-300" />
                <h3 className="text-lg font-semibold text-white">Included Skills</h3>
              </div>
              <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                {selectedPackage.skills.map((skill) => (
                  <button
                    key={skill.id}
                    type="button"
                    onClick={() => openSkill(skill)}
                    className="rounded-2xl border border-white/10 bg-[#111117] px-4 py-4 text-left transition hover:border-white/20 hover:bg-white/[0.03]"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/5 text-sm font-semibold text-white">
                          {skill.icon}
                        </div>
                        <div>
                          <h4 className="text-sm font-semibold text-white">{skill.name}</h4>
                          <p className="text-xs text-gray-500">{skill.author}</p>
                        </div>
                      </div>
                      <ChevronRight size={16} className="text-gray-500" />
                    </div>
                    <p className="mt-3 text-sm leading-6 text-gray-300">{skill.desc}</p>
                  </button>
                ))}
              </div>
            </section>
          </div>
        ) : currentView === 'skill-detail' && selectedSkill ? (
          <div className="mx-auto max-w-6xl space-y-8">
            <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-6">
              <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
                <div className="flex items-start gap-4">
                  <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-white/5 text-xl font-semibold text-white ring-1 ring-white/10">
                    {selectedSkill.icon}
                  </div>
                  <div className="space-y-3">
                    <div>
                      <h2 className="text-3xl font-semibold text-white">{selectedSkill.name}</h2>
                      <p className="mt-1 text-sm text-gray-400">{selectedSkill.author}</p>
                    </div>
                    <p className="max-w-3xl text-sm leading-7 text-gray-300">
                      {selectedSkill.longDesc || selectedSkill.desc}
                    </p>
                    <div className="flex flex-wrap items-center gap-4 text-sm text-gray-400">
                      <span className="inline-flex items-center gap-1">
                        <Download size={14} />
                        {selectedSkill.installs}
                      </span>
                      <span>v{selectedSkill.version || '1.0.0'}</span>
                    </div>
                  </div>
                </div>
                <div className="space-y-3">
                  {renderInstallButton(
                    selectedSkill.id,
                    Boolean(selectedSkill.isInstalled),
                    async () => installSkill(selectedSkill),
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      void copyCommand(buildSkillInstallCommand(selectedSkill));
                    }}
                    className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-gray-200 transition hover:bg-white/10"
                  >
                    {copiedCommand === buildSkillInstallCommand(selectedSkill) ? (
                      <Check size={16} className="text-emerald-300" />
                    ) : (
                      <Copy size={16} />
                    )}
                    Copy install command
                  </button>
                </div>
              </div>
            </section>

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(280px,1fr)]">
              <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-6">
                <div className="mb-4 flex items-center gap-2">
                  <FileText size={18} className="text-blue-300" />
                  <h3 className="text-lg font-semibold text-white">Overview</h3>
                </div>
                <div className="prose prose-invert max-w-none">
                  {selectedSkill.readme ? (
                    <ReactMarkdown>{selectedSkill.readme}</ReactMarkdown>
                  ) : (
                    <p>{selectedSkill.longDesc || selectedSkill.desc}</p>
                  )}
                </div>
              </section>

              <aside className="space-y-4">
                <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-6">
                  <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-gray-400">
                    Metadata
                  </h3>
                  <div className="mt-4 space-y-4 text-sm">
                    {selectedSkill.repository ? (
                      <a
                        href={selectedSkill.repository}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-gray-200 transition hover:bg-white/10"
                      >
                        <span className="inline-flex items-center gap-2">
                          <Github size={14} />
                          Repository
                        </span>
                        <ExternalLink size={14} />
                      </a>
                    ) : null}
                    {selectedSkill.license ? (
                      <div className="flex items-center gap-2 text-gray-300">
                        <Shield size={14} className="text-gray-500" />
                        {selectedSkill.license}
                      </div>
                    ) : null}
                    {selectedSkill.lastUpdated ? (
                      <div className="flex items-center gap-2 text-gray-300">
                        <Globe size={14} className="text-gray-500" />
                        {selectedSkill.lastUpdated}
                      </div>
                    ) : null}
                    <div className="flex items-center gap-2 text-gray-300">
                      <Server size={14} className="text-gray-500" />
                      {selectedRegistry.name}
                    </div>
                  </div>
                </section>

                <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-6">
                  <div className="mb-3 flex items-center gap-2">
                    <Settings size={16} className="text-blue-300" />
                    <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-gray-400">
                      Tags
                    </h3>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {(selectedSkill.tags || []).map((tag) => (
                      <span
                        key={tag}
                        className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] text-gray-300"
                      >
                        <Tag size={11} />
                        {tag}
                      </span>
                    ))}
                  </div>
                </section>
              </aside>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function EmptyState({ query }: { query: string }) {
  return (
    <div className="flex min-h-[240px] flex-col items-center justify-center rounded-2xl border border-dashed border-white/10 bg-white/[0.03] text-center">
      <Search size={26} className="mb-3 text-gray-500" />
      <h2 className="text-base font-semibold text-white">No matching skills</h2>
      <p className="mt-1 max-w-md text-sm text-gray-400">
        {query.trim()
          ? `No catalog entries matched "${query}".`
          : 'The catalog is empty for the current filter.'}
      </p>
    </div>
  );
}
