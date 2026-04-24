import { useState, type ReactNode } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { cn } from '@sdkwork/birdcoder-ui-shell';

export interface ContentStructuredDataPreviewProps {
  className?: string;
  defaultExpandedDepth?: number;
  format?: 'json' | 'jsonc' | 'toml' | 'yaml';
  rootLabel?: string;
  stringPreviewLimit?: number;
  value: unknown;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function formatCompositeSummary(value: unknown): string {
  if (Array.isArray(value)) {
    return `${value.length} ${value.length === 1 ? 'item' : 'items'}`;
  }

  if (isRecord(value)) {
    const size = Object.keys(value).length;
    return `${size} ${size === 1 ? 'field' : 'fields'}`;
  }

  return '';
}

function formatPrimitiveValue(value: unknown, stringPreviewLimit: number): ReactNode {
  if (value === null) {
    return <span className="text-fuchsia-300">null</span>;
  }

  if (typeof value === 'string') {
    const normalizedValue =
      value.length > stringPreviewLimit
        ? `${value.slice(0, stringPreviewLimit)}...`
        : value;
    return (
      <span className="text-emerald-300" title={value}>
        "{normalizedValue}"
      </span>
    );
  }

  if (typeof value === 'number') {
    return <span className="text-sky-300">{String(value)}</span>;
  }

  if (typeof value === 'boolean') {
    return <span className="text-amber-300">{String(value)}</span>;
  }

  return <span className="text-gray-300">{String(value)}</span>;
}

interface StructuredPreviewNodeProps {
  defaultExpandedDepth: number;
  depth: number;
  label: string;
  stringPreviewLimit: number;
  value: unknown;
}

function StructuredPreviewNode({
  defaultExpandedDepth,
  depth,
  label,
  stringPreviewLimit,
  value,
}: StructuredPreviewNodeProps) {
  const isExpandable = Array.isArray(value) || isRecord(value);
  const [expanded, setExpanded] = useState(depth < defaultExpandedDepth);

  if (!isExpandable) {
    return (
      <div className="flex min-w-0 items-start gap-3 py-1.5">
        <span className="min-w-[96px] shrink-0 font-medium text-gray-400">{label}</span>
        <span className="min-w-0 break-words font-mono text-[13px] leading-6">
          {formatPrimitiveValue(value, stringPreviewLimit)}
        </span>
      </div>
    );
  }

  const entries = Array.isArray(value)
    ? value.map((entry, index) => [String(index), entry] as const)
    : Object.entries(value);
  const summary = formatCompositeSummary(value);

  return (
    <div className="min-w-0">
      <button
        className="flex w-full min-w-0 items-center gap-2 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-white/5"
        onClick={() => setExpanded((previous) => !previous)}
        type="button"
      >
        {expanded ? (
          <ChevronDown className="h-4 w-4 shrink-0 text-gray-500" />
        ) : (
          <ChevronRight className="h-4 w-4 shrink-0 text-gray-500" />
        )}
        <span className="truncate font-medium text-gray-200">{label}</span>
        <span className="shrink-0 text-xs uppercase tracking-[0.14em] text-gray-500">
          {Array.isArray(value) ? 'array' : 'object'}
        </span>
        <span className="truncate text-xs text-gray-500">{summary}</span>
      </button>

      {expanded ? (
        <div className="ml-3 border-l border-white/10 pl-4">
          {entries.length > 0 ? (
            entries.map(([entryLabel, entryValue]) => (
              <StructuredPreviewNode
                key={entryLabel}
                defaultExpandedDepth={defaultExpandedDepth}
                depth={depth + 1}
                label={entryLabel}
                stringPreviewLimit={stringPreviewLimit}
                value={entryValue}
              />
            ))
          ) : (
            <div className="py-1.5 text-sm text-gray-500">Empty</div>
          )}
        </div>
      ) : null}
    </div>
  );
}

export function ContentStructuredDataPreview({
  className,
  defaultExpandedDepth = 2,
  format,
  rootLabel = 'data',
  stringPreviewLimit = 240,
  value,
}: ContentStructuredDataPreviewProps) {
  const summary = formatCompositeSummary(value);
  const formatLabel = format ? format.toUpperCase() : null;

  return (
    <div className={cn('h-full overflow-auto bg-[#0b0d12] custom-scrollbar', className)}>
      <div className="sticky top-0 z-10 border-b border-white/10 bg-[#0b0d12]/95 px-5 py-3 backdrop-blur">
        <div className="flex items-center gap-2">
          <div className="text-sm font-medium text-gray-100">Structured Data Preview</div>
          {formatLabel ? (
            <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.14em] text-gray-400">
              {formatLabel}
            </span>
          ) : null}
        </div>
        <div className="text-xs text-gray-500">{summary || 'Primitive value'}</div>
      </div>
      <div className="px-5 py-4 font-mono text-[13px] leading-6">
        <StructuredPreviewNode
          defaultExpandedDepth={defaultExpandedDepth}
          depth={0}
          label={rootLabel}
          stringPreviewLimit={stringPreviewLimit}
          value={value}
        />
      </div>
    </div>
  );
}
