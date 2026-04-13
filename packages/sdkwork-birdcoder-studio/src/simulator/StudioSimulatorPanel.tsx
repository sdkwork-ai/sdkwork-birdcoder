import type { ComponentProps } from 'react';
import { DevicePreview } from '@sdkwork/birdcoder-ui';

interface StudioSimulatorPanelProps {
  devicePreviewProps: ComponentProps<typeof DevicePreview>;
}

export function StudioSimulatorPanel({
  devicePreviewProps,
}: StudioSimulatorPanelProps) {
  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <DevicePreview {...devicePreviewProps} />
    </div>
  );
}
