import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Bot,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  Link2,
  Loader2,
  Search,
  ShieldAlert,
  Sparkles,
  Wifi,
  Wrench,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type {
  CatalogPageInfo,
  ICatalogService,
} from '@sdkwork/birdcoder-pc-infrastructure-runtime';

export interface WorkResourcesPageProps {
  catalogService: ICatalogService;
  isVisible?: boolean;
}

type ResourceTab = 'experts' | 'skills' | 'connectors';
type AgentRecord = Awaited<ReturnType<ICatalogService['listAgents']>>['items'][number];
type SkillRecord = Awaited<ReturnType<ICatalogService['listSkills']>>['items'][number];
type ConnectorRecord = Awaited<ReturnType<ICatalogService['listConnectors']>>['items'][number];

const PAGE_SIZE = 24;

function initialOf(value: string): string {
  return value.trim().slice(0, 1).toUpperCase() || '?';
}

function colorFor(value: string): string {
  const palette = ['#5c7cfa', '#37b24d', '#f08c46', '#cc5de8', '#15aabf', '#e8590c', '#748ffc'];
  let hash = 0;
  for (const character of value) hash = (hash * 31 + character.charCodeAt(0)) | 0;
  return palette[Math.abs(hash) % palette.length] ?? palette[0];
}

function humanize(value: string): string {
  return value
    .replace(/[-_.]+/gu, ' ')
    .replace(/\b\p{L}/gu, (letter) => letter.toUpperCase());
}

function isPermissionError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /\b(401|403|permission|forbidden|unauthorized)\b/iu.test(message);
}

function displayNumber(value: string | undefined): string {
  if (!value) return '0';
  const number = Number(value);
  if (!Number.isFinite(number)) return value;
  return new Intl.NumberFormat(undefined, { notation: number > 9999 ? 'compact' : 'standard' }).format(number);
}

function Avatar({
  alt,
  color,
  src,
}: {
  alt: string;
  color?: string;
  src?: string | null;
}) {
  const [failed, setFailed] = useState(false);
  const normalizedSrc = src?.trim();
  if (normalizedSrc && !failed) {
    return (
      <img
        src={normalizedSrc}
        alt=""
        className="h-10 w-10 shrink-0 rounded-lg object-cover ring-1 ring-white/10"
        onError={() => setFailed(true)}
      />
    );
  }
  return (
    <span
      aria-label={alt}
      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-sm font-semibold text-white ring-1 ring-white/10"
      style={{ backgroundColor: color ?? colorFor(alt) }}
    >
      {initialOf(alt)}
    </span>
  );
}

function TabButton({
  active,
  icon,
  label,
  onClick,
}: {
  active: boolean;
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-selected={active}
      className={`inline-flex h-8 items-center gap-2 rounded-md px-3 text-[12px] font-medium transition-colors ${active ? 'bg-white/[0.13] text-white shadow-sm' : 'text-gray-500 hover:bg-white/[0.06] hover:text-gray-200'}`}
      onClick={onClick}
      role="tab"
    >
      {icon}
      {label}
    </button>
  );
}

function FeaturedScenes({
  agents,
  labels,
  onCategorySelect,
}: {
  agents: readonly AgentRecord[];
  labels: { featured: string; expertsCount: (count: number) => string; featuredScenes: string; viewMore: string };
  onCategorySelect: (category: string) => void;
}) {
  const scenes = useMemo(() => {
    const groups = new Map<string, AgentRecord[]>();
    agents.forEach((agent) => {
      const category = agent.managementProfile?.categoryId?.trim()
        || agent.tags[0]?.trim()
        || 'general';
      const current = groups.get(category) ?? [];
      if (current.length < 3) current.push(agent);
      groups.set(category, current);
    });
    return [...groups.entries()].slice(0, 8);
  }, [agents]);

  if (scenes.length === 0) return null;
  return (
    <section className="mb-8" aria-labelledby="work-resources-featured-scenes">
      <div className="mb-3 flex items-center justify-between">
        <h2 id="work-resources-featured-scenes" className="text-sm font-semibold text-gray-100">
          {labels.featuredScenes}
        </h2>
        <span className="text-[11px] text-gray-600">{labels.featured}</span>
      </div>
      <div className="flex gap-3 overflow-x-auto pb-1 [scrollbar-width:thin]">
        {scenes.map(([category, sceneAgents]) => (
          <article
            key={category}
            className="group relative min-w-[220px] flex-1 overflow-hidden rounded-lg border border-white/[0.08] bg-gradient-to-br from-white/[0.09] to-white/[0.025] p-4 transition-colors hover:border-white/[0.16]"
          >
            <div className="absolute right-3 top-3 h-14 w-14 rounded-full opacity-20 blur-2xl" style={{ backgroundColor: colorFor(category) }} />
            <h3 className="relative truncate text-[13px] font-semibold text-gray-100">{humanize(category)}</h3>
            <p className="relative mt-1 text-[11px] text-gray-500">{labels.expertsCount(sceneAgents.length)}</p>
            <div className="relative mt-4 space-y-2">
              {sceneAgents.map((agent) => (
                <div key={agent.agentId} className="flex min-w-0 items-center gap-2">
                  <Avatar
                    alt={agent.displayName}
                    color={agent.managementProfile?.color}
                    src={agent.managementProfile?.avatar}
                  />
                  <span className="min-w-0 truncate text-[11px] font-medium text-gray-300">{agent.displayName}</span>
                </div>
              ))}
            </div>
            <button type="button" className="relative mt-4 inline-flex items-center gap-1 text-[11px] text-gray-500 transition-colors hover:text-gray-200" onClick={() => onCategorySelect(category)}>
              {labels.viewMore} <ChevronRight size={12} aria-hidden="true" />
            </button>
          </article>
        ))}
      </div>
    </section>
  );
}

function AgentCard({ agent, activeLabel, noDescription }: { agent: AgentRecord; activeLabel: string; noDescription: string }) {
  const profile = agent.managementProfile;
  return (
    <article className="min-w-0 rounded-lg border border-white/[0.07] bg-white/[0.055] p-4 transition-colors hover:border-white/[0.15] hover:bg-white/[0.075]">
      <div className="flex min-w-0 items-start gap-3">
        <Avatar alt={agent.displayName} color={profile?.color} src={profile?.avatar} />
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-2">
            <h3 className="min-w-0 truncate text-[13px] font-semibold text-gray-100">{agent.displayName}</h3>
            {agent.status === 'active' ? <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-400" title={activeLabel} /> : null}
          </div>
          <p className="mt-0.5 truncate text-[11px] text-gray-500">{profile?.author || agent.code}</p>
        </div>
      </div>
      <p className="mt-3 line-clamp-2 min-h-8 text-[11px] leading-5 text-gray-400">{agent.description?.trim() || noDescription}</p>
      <div className="mt-3 flex min-w-0 gap-1.5 overflow-hidden">
        {agent.tags.slice(0, 3).map((tag) => <span key={tag} className="truncate rounded bg-white/[0.08] px-2 py-1 text-[10px] text-gray-500">{tag}</span>)}
      </div>
    </article>
  );
}

function SkillCard({ skill, featuredLabel, installCount, noDescription }: { skill: SkillRecord; featuredLabel: string; installCount: string; noDescription: string }) {
  return (
    <article className="min-w-0 rounded-lg border border-white/[0.07] bg-white/[0.055] p-4 transition-colors hover:border-white/[0.15] hover:bg-white/[0.075]">
      <div className="flex items-start gap-3">
        <Avatar alt={skill.name} />
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-[13px] font-semibold text-gray-100">{skill.name}</h3>
          <p className="mt-0.5 truncate text-[11px] text-gray-500">{skill.skillKey}</p>
        </div>
        {skill.featured ? <Sparkles size={14} className="shrink-0 text-amber-300" aria-label={featuredLabel} /> : null}
      </div>
      <p className="mt-3 line-clamp-2 min-h-8 text-[11px] leading-5 text-gray-400">{skill.summary?.trim() || skill.description?.trim() || noDescription}</p>
      <div className="mt-3 flex items-center justify-between text-[10px] text-gray-600">
        <span>{installCount}</span>
        <span>{skill.version}</span>
      </div>
      <div className="mt-3 flex min-w-0 gap-1.5 overflow-hidden">
        {skill.categories.slice(0, 2).map((category) => <span key={category} className="truncate rounded bg-white/[0.08] px-2 py-1 text-[10px] text-gray-500">{category}</span>)}
      </div>
    </article>
  );
}

function ConnectorCard({
  connector,
  labels,
}: {
  connector: ConnectorRecord;
  labels: { noDescription: string; transport: string; status: string };
}) {
  const healthy = connector.health_status.toLowerCase() === 'healthy' || connector.lifecycle_status.toLowerCase() === 'active';
  return (
    <article className="min-w-0 rounded-lg border border-white/[0.07] bg-white/[0.055] p-4 transition-colors hover:border-white/[0.15] hover:bg-white/[0.075]">
      <div className="flex items-start gap-3">
        <Avatar alt={connector.name} src={connector.icon_ref} />
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-2">
            <h3 className="truncate text-[13px] font-semibold text-gray-100">{connector.name}</h3>
            <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${healthy ? 'bg-emerald-400' : 'bg-amber-400'}`} title={connector.health_status} />
          </div>
          <p className="mt-0.5 truncate text-[11px] text-gray-500">{connector.server_key}</p>
        </div>
        <Link2 size={14} className="shrink-0 text-gray-600" aria-hidden="true" />
      </div>
      <p className="mt-3 line-clamp-2 min-h-8 text-[11px] leading-5 text-gray-400">{connector.description?.trim() || labels.noDescription}</p>
      <dl className="mt-3 grid grid-cols-2 gap-2 text-[10px] text-gray-600">
        <div><dt>{labels.transport}</dt><dd className="mt-1 truncate text-gray-400">{connector.transport}</dd></div>
        <div><dt>{labels.status}</dt><dd className="mt-1 truncate text-gray-400">{connector.lifecycle_status}</dd></div>
      </dl>
      <div className="mt-3 flex min-w-0 gap-1.5 overflow-hidden">
        {(connector.tags ?? []).slice(0, 3).map((tag) => <span key={tag} className="truncate rounded bg-white/[0.08] px-2 py-1 text-[10px] text-gray-500">{tag}</span>)}
      </div>
    </article>
  );
}

export function WorkResourcesPage({ catalogService, isVisible = true }: WorkResourcesPageProps) {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<ResourceTab>('experts');
  const [scope, setScope] = useState<'market' | 'mine'>('market');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [agents, setAgents] = useState<AgentRecord[]>([]);
  const [skills, setSkills] = useState<SkillRecord[]>([]);
  const [connectors, setConnectors] = useState<ConnectorRecord[]>([]);
  const [pageInfo, setPageInfo] = useState<CatalogPageInfo>({ mode: 'offset', page: 1, pageSize: PAGE_SIZE });
  const [state, setState] = useState<'idle' | 'loading' | 'ready' | 'error' | 'permission'>('idle');
  const [error, setError] = useState<unknown>(null);
  const requestIdRef = useRef(0);
  const requestControllerRef = useRef<AbortController | null>(null);

  const load = useCallback(async () => {
    if (!isVisible) return;
    const requestId = ++requestIdRef.current;
    requestControllerRef.current?.abort();
    const controller = new AbortController();
    requestControllerRef.current = controller;
    setState('loading');
    setError(null);
    try {
      if (activeTab === 'experts') {
        const result = await catalogService.listAgents({ scope, page, pageSize: PAGE_SIZE, query, signal: controller.signal });
        if (requestId !== requestIdRef.current) return;
        setAgents(result.items);
        setPageInfo(result.pageInfo);
      } else if (activeTab === 'skills') {
        const result = await catalogService.listSkills({ page, pageSize: PAGE_SIZE, query, signal: controller.signal });
        if (requestId !== requestIdRef.current) return;
        setSkills(result.items);
        setPageInfo(result.pageInfo);
      } else {
        const result = await catalogService.listConnectors({ page, pageSize: PAGE_SIZE, query, signal: controller.signal });
        if (requestId !== requestIdRef.current) return;
        setConnectors(result.items);
        setPageInfo(result.pageInfo);
      }
      setState('ready');
    } catch (caughtError) {
      if (requestId !== requestIdRef.current || (caughtError instanceof DOMException && caughtError.name === 'AbortError')) return;
      setError(caughtError);
      setState(isPermissionError(caughtError) ? 'permission' : 'error');
    }
  }, [activeTab, catalogService, isVisible, page, query, scope]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => void load(), query.trim() ? 220 : 0);
    return () => {
      window.clearTimeout(timeoutId);
      requestControllerRef.current?.abort();
    };
  }, [load]);

  const visibleItems = activeTab === 'experts' ? agents : activeTab === 'skills' ? skills : connectors;
  const hasMore = pageInfo.hasMore ?? (pageInfo.totalPages ? page < pageInfo.totalPages : false);
  const labels = {
    noDescription: t('intelligence.workResources.noDescription'),
    featured: t('intelligence.workResources.featured'),
    featuredScenes: t('intelligence.workResources.featuredScenes'),
    active: t('intelligence.workResources.active'),
    expertsCount: (count: number) => t('intelligence.workResources.expertsCount', { count }),
    viewMore: t('intelligence.workResources.viewMore'),
    transport: t('intelligence.workResources.transport'),
    status: t('intelligence.workResources.status'),
  };

  return (
    <main className="flex h-full min-h-0 flex-1 flex-col overflow-hidden bg-[#111214] text-gray-100">
      <header className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-white/[0.06] px-5 py-3">
        <div className="flex min-w-0 items-center gap-1" role="tablist" aria-label={t('intelligence.workResources.title')}>
          <TabButton active={activeTab === 'experts'} icon={<Bot size={14} />} label={t('intelligence.workResources.experts')} onClick={() => { setActiveTab('experts'); setPage(1); }} />
          <TabButton active={activeTab === 'skills'} icon={<Wrench size={14} />} label={t('intelligence.workResources.skills')} onClick={() => { setActiveTab('skills'); setPage(1); }} />
          <TabButton active={activeTab === 'connectors'} icon={<Link2 size={14} />} label={t('intelligence.workResources.connectors')} onClick={() => { setActiveTab('connectors'); setPage(1); }} />
        </div>
        <div className="flex min-w-0 items-center gap-2">
          <label className="relative block min-w-[210px] max-w-[320px] flex-1">
            <span className="sr-only">{t('intelligence.workResources.search')}</span>
            <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-600" aria-hidden="true" />
            <input
              value={query}
              onChange={(event) => { setQuery(event.target.value); setPage(1); }}
              placeholder={activeTab === 'experts' ? t('intelligence.workResources.searchExperts') : t('intelligence.workResources.search')}
              className="h-8 w-full rounded-md border border-white/[0.08] bg-white/[0.06] pl-9 pr-3 text-[11px] text-gray-200 outline-none placeholder:text-gray-600 focus:border-white/[0.2]"
            />
          </label>
          {activeTab === 'experts' ? (
            <button
              type="button"
              aria-pressed={scope === 'mine'}
              className={`inline-flex h-8 shrink-0 items-center gap-2 rounded-md border px-3 text-[11px] font-medium transition-colors ${scope === 'mine' ? 'border-white/[0.18] bg-white/[0.12] text-white' : 'border-white/[0.08] bg-white/[0.04] text-gray-400 hover:bg-white/[0.08] hover:text-gray-200'}`}
              onClick={() => { setScope((value) => value === 'mine' ? 'market' : 'mine'); setPage(1); }}
            >
              <Bot size={13} />
              {scope === 'mine' ? t('intelligence.workResources.marketplace') : t('intelligence.workResources.mine')}
            </button>
          ) : null}
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-6 [scrollbar-width:thin]">
        <div className="mx-auto max-w-[2200px]">
          <div className="mb-6 flex items-end justify-between gap-4">
            <div>
              <h1 className="text-xl font-semibold tracking-tight text-white">{t('intelligence.workResources.title')}</h1>
              <div className="mt-2 flex items-center gap-2 text-[11px] text-gray-600"><Wifi size={12} /> {activeTab === 'experts' ? t('intelligence.workResources.allExperts') : activeTab === 'skills' ? t('intelligence.workResources.skills') : t('intelligence.workResources.connectors')}</div>
            </div>
            {state === 'ready' ? <span className="text-[11px] tabular-nums text-gray-600">{visibleItems.length} / {PAGE_SIZE}</span> : null}
          </div>

          {activeTab === 'experts' && state === 'ready' ? <FeaturedScenes agents={agents} labels={labels} onCategorySelect={(category) => { setQuery(category); setPage(1); }} /> : null}

          {state === 'loading' ? (
            <div className="flex min-h-[360px] items-center justify-center text-gray-500"><Loader2 size={22} className="animate-spin" /></div>
          ) : state === 'permission' ? (
            <StatusPanel icon={<ShieldAlert size={24} />} title={t('intelligence.workResources.permissionDenied')} />
          ) : state === 'error' ? (
            <StatusPanel icon={<CircleAlert size={24} />} title={error instanceof Error ? error.message : t('intelligence.workResources.loadFailed')} action={t('intelligence.workResources.retry')} onAction={() => void load()} />
          ) : visibleItems.length === 0 ? (
            <StatusPanel title={t('intelligence.workResources.noResults')} subtitle={t('intelligence.workResources.noResultsHint')} />
          ) : (
            <section aria-labelledby="work-resources-grid-title">
              <h2 id="work-resources-grid-title" className="sr-only">{t('intelligence.workResources.title')}</h2>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-6">
                {activeTab === 'experts' ? agents.map((agent) => <AgentCard key={agent.agentId} agent={agent} activeLabel={labels.active} noDescription={labels.noDescription} />) : null}
                {activeTab === 'skills' ? skills.map((skill) => <SkillCard key={skill.skillKey} skill={skill} featuredLabel={labels.featured} installCount={t('intelligence.workResources.installCount', { count: displayNumber(skill.installCount) })} noDescription={labels.noDescription} />) : null}
                {activeTab === 'connectors' ? connectors.map((connector) => <ConnectorCard key={connector.server_key} connector={connector} labels={labels} />) : null}
              </div>
            </section>
          )}

          {state === 'ready' && visibleItems.length > 0 ? (
            <nav className="mt-6 flex items-center justify-center gap-2" aria-label={t('intelligence.workResources.title')}>
              <button type="button" aria-label={t('intelligence.workResources.previous')} disabled={page <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))} className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-white/[0.08] text-gray-500 transition-colors hover:bg-white/[0.07] hover:text-gray-200 disabled:cursor-not-allowed disabled:opacity-30"><ChevronLeft size={15} /></button>
              <span className="min-w-20 text-center text-[11px] text-gray-500">{t('intelligence.workResources.page', { page })}</span>
              <button type="button" aria-label={t('intelligence.workResources.next')} disabled={!hasMore} onClick={() => setPage((value) => value + 1)} className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-white/[0.08] text-gray-500 transition-colors hover:bg-white/[0.07] hover:text-gray-200 disabled:cursor-not-allowed disabled:opacity-30"><ChevronRight size={15} /></button>
            </nav>
          ) : null}
        </div>
      </div>
    </main>
  );
}

function StatusPanel({
  action,
  icon,
  onAction,
  subtitle,
  title,
}: {
  action?: string;
  icon?: React.ReactNode;
  onAction?: () => void;
  subtitle?: string;
  title: string;
}) {
  return (
    <div className="flex min-h-[360px] flex-col items-center justify-center text-center">
      <div className="mb-3 text-gray-600">{icon}</div>
      <p className="text-sm font-medium text-gray-300">{title}</p>
      {subtitle ? <p className="mt-2 max-w-sm text-[11px] text-gray-600">{subtitle}</p> : null}
      {action && onAction ? <button type="button" className="mt-4 rounded-md border border-white/[0.1] px-3 py-1.5 text-[11px] text-gray-400 hover:bg-white/[0.07] hover:text-gray-200" onClick={onAction}>{action}</button> : null}
    </div>
  );
}
