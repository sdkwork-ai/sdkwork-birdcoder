import { memo } from 'react';
import {
  resolveProviderVisualIdentity,
  resolveProviderVisualToneClassName,
  type ProviderVisualIdentityInput,
} from '@sdkwork/birdcoder-pc-ui-shell';

export interface SessionProviderPresentation {
  abbreviation: string;
  id: string;
  label: string;
}

export type SessionProviderIdentity = ProviderVisualIdentityInput;
export type SessionProviderBadgeProps = SessionProviderIdentity;

const SESSION_PROVIDER_BADGE_BASE_CLASS_NAME =
  'inline-flex h-4 min-w-4 flex-none items-center justify-center rounded px-1 text-[8px] font-semibold uppercase leading-none tracking-normal ring-1 ring-inset';

export function resolveSessionProviderPresentation(
  identityOrProviderId?: SessionProviderIdentity | string | null,
): SessionProviderPresentation {
  const visualIdentity = resolveProviderVisualIdentity(identityOrProviderId);
  return {
    abbreviation: visualIdentity.abbreviation,
    id: visualIdentity.id,
    label: visualIdentity.label,
  };
}

export const SessionProviderBadge = memo(function SessionProviderBadge({
  agentId,
  engineId,
  providerId,
}: SessionProviderBadgeProps) {
  const visualIdentity = resolveProviderVisualIdentity({ agentId, engineId, providerId });

  return (
    <span
      aria-label={visualIdentity.label}
      className={`${SESSION_PROVIDER_BADGE_BASE_CLASS_NAME} ${resolveProviderVisualToneClassName(visualIdentity.tone)}`}
      data-provider-identity-icon="true"
      data-session-provider-abbreviation={visualIdentity.abbreviation}
      data-session-provider-badge="leading"
      data-session-provider-id={visualIdentity.id}
      data-session-provider-tone={visualIdentity.tone}
      title={visualIdentity.label}
    >
      {visualIdentity.abbreviation}
    </span>
  );
});

SessionProviderBadge.displayName = 'SessionProviderBadge';
