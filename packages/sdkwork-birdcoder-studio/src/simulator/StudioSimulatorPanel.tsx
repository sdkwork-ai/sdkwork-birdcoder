import { memo, type ComponentProps } from 'react';
import { DevicePreview } from '@sdkwork/birdcoder-ui-shell';

interface StudioSimulatorPanelProps {
  devicePreviewProps: ComponentProps<typeof DevicePreview>;
}

function areSimulatorPropsEqual(
  left: StudioSimulatorPanelProps['devicePreviewProps'],
  right: StudioSimulatorPanelProps['devicePreviewProps'],
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

export const StudioSimulatorPanel = memo(function StudioSimulatorPanel({
  devicePreviewProps,
}: StudioSimulatorPanelProps) {
  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <DevicePreview {...devicePreviewProps} />
    </div>
  );
}, (left, right) => areSimulatorPropsEqual(left.devicePreviewProps, right.devicePreviewProps));

StudioSimulatorPanel.displayName = 'StudioSimulatorPanel';
