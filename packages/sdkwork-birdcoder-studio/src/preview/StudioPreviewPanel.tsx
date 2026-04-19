import { memo, type ComponentProps } from 'react';
import { DevicePreview } from '@sdkwork/birdcoder-ui';

interface StudioPreviewPanelProps {
  devicePreviewProps: ComponentProps<typeof DevicePreview>;
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
}: StudioPreviewPanelProps) {
  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <DevicePreview {...devicePreviewProps} />
    </div>
  );
}, (left, right) => arePreviewPropsEqual(left.devicePreviewProps, right.devicePreviewProps));

StudioPreviewPanel.displayName = 'StudioPreviewPanel';
