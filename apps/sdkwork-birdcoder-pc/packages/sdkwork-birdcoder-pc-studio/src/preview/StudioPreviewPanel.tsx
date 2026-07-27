import { memo, useMemo, type ComponentProps } from 'react';
import {
  BrowserPreviewSurface,
  type BrowserPreviewLabels,
} from '@sdkwork/birdcoder-pc-ui';
import { DevicePreview } from '@sdkwork/birdcoder-pc-ui-shell';
import { useTranslation } from 'react-i18next';

interface StudioPreviewPanelProps {
  devicePreviewProps: ComponentProps<typeof DevicePreview>;
  onNavigate: (url: string) => void;
}

function arePreviewPropsEqual(
  left: StudioPreviewPanelProps['devicePreviewProps'],
  right: StudioPreviewPanelProps['devicePreviewProps'],
): boolean {
  return (
    left.url === right.url &&
    left.platform === right.platform &&
    left.webDevice === right.webDevice &&
    left.mpPlatform === right.mpPlatform &&
    left.appPlatform === right.appPlatform &&
    left.deviceModel === right.deviceModel &&
    left.isLandscape === right.isLandscape &&
    left.refreshKey === right.refreshKey
  );
}

export const StudioPreviewPanel = memo(function StudioPreviewPanel({
  devicePreviewProps,
  onNavigate,
}: StudioPreviewPanelProps) {
  const { t } = useTranslation();
  const browserLabels = useMemo<BrowserPreviewLabels>(() => ({
    address: t('studio.browserAddress'),
    back: t('studio.browserBack'),
    forward: t('studio.browserForward'),
    navigate: t('studio.browserNavigate'),
    openExternal: t('studio.openInNewTab'),
    refresh: t('studio.refresh'),
    title: t('studio.browserPreviewTitle'),
  }), [t]);
  const isDesktopBrowser =
    devicePreviewProps.platform === 'web'
    && devicePreviewProps.webDevice === 'desktop';

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {isDesktopBrowser ? (
        <BrowserPreviewSurface
          labels={browserLabels}
          refreshKey={devicePreviewProps.refreshKey}
          url={devicePreviewProps.url ?? 'about:blank'}
          onNavigate={onNavigate}
        />
      ) : (
        <DevicePreview {...devicePreviewProps} />
      )}
    </div>
  );
}, (left, right) => (
  left.onNavigate === right.onNavigate
  && arePreviewPropsEqual(left.devicePreviewProps, right.devicePreviewProps)
));

StudioPreviewPanel.displayName = 'StudioPreviewPanel';

