import {
  registerBirdCoderHostAdapters,
  type HostAdapters,
} from '@sdkwork/birdcoder-h5-capacitor';

export { registerBirdCoderHostAdapters, type HostAdapters };

export function createHostAdapters(): HostAdapters {
  return registerBirdCoderHostAdapters();
}
