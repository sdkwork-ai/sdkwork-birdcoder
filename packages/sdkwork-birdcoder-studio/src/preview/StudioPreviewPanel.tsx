import type { ComponentProps } from 'react';
import { DevicePreview } from '@sdkwork/birdcoder-ui';

interface StudioPreviewPanelProps {
  devicePreviewProps: ComponentProps<typeof DevicePreview>;
}

export function StudioPreviewPanel({
  devicePreviewProps,
}: StudioPreviewPanelProps) {
  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <DevicePreview {...devicePreviewProps} />
    </div>
  );
}
