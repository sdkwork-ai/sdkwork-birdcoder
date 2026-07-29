import { useCallback, useEffect, useState } from 'react';

export type VoiceMicrophonePermission =
  | 'denied'
  | 'granted'
  | 'prompt'
  | 'unsupported';

export interface VoiceMicrophoneState {
  deviceCount: number;
  isChecking: boolean;
  permission: VoiceMicrophonePermission;
  requestAccess: () => Promise<void>;
}

function hasMediaDeviceSupport(): boolean {
  return typeof navigator !== 'undefined' && Boolean(navigator.mediaDevices?.getUserMedia);
}

export function useVoiceMicrophoneState(): VoiceMicrophoneState {
  const [permission, setPermission] = useState<VoiceMicrophonePermission>(
    hasMediaDeviceSupport() ? 'prompt' : 'unsupported',
  );
  const [deviceCount, setDeviceCount] = useState(0);
  const [isChecking, setIsChecking] = useState(false);

  const refreshDevices = useCallback(async () => {
    if (!hasMediaDeviceSupport()) {
      setPermission('unsupported');
      setDeviceCount(0);
      return;
    }

    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      setDeviceCount(devices.filter((device) => device.kind === 'audioinput').length);
    } catch {
      setDeviceCount(0);
    }
  }, []);

  useEffect(() => {
    if (!hasMediaDeviceSupport()) {
      return undefined;
    }

    void refreshDevices();
    const handleDeviceChange = () => void refreshDevices();
    navigator.mediaDevices.addEventListener?.('devicechange', handleDeviceChange);

    let permissionStatus: PermissionStatus | null = null;
    if (navigator.permissions?.query) {
      void navigator.permissions
        .query({ name: 'microphone' as PermissionName })
        .then((status) => {
          permissionStatus = status;
          setPermission(status.state);
          status.onchange = () => {
            setPermission(status.state);
            void refreshDevices();
          };
        })
        .catch(() => undefined);
    }

    return () => {
      navigator.mediaDevices.removeEventListener?.('devicechange', handleDeviceChange);
      if (permissionStatus) {
        permissionStatus.onchange = null;
      }
    };
  }, [refreshDevices]);

  const requestAccess = useCallback(async () => {
    if (!hasMediaDeviceSupport()) {
      setPermission('unsupported');
      return;
    }

    setIsChecking(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((track) => track.stop());
      setPermission('granted');
      await refreshDevices();
    } catch {
      setPermission('denied');
    } finally {
      setIsChecking(false);
    }
  }, [refreshDevices]);

  return {
    deviceCount,
    isChecking,
    permission,
    requestAccess,
  };
}
