/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export function SurfaceLoader({ fullScreen = false }: { fullScreen?: boolean }) {
  void fullScreen;
  return (
    <div className="flex h-full w-full bg-[#0e0e11] text-white items-center justify-center">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white" />
    </div>
  );
}
