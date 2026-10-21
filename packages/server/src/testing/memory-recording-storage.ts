import type { RecordingStorage } from '../ports.js';

export interface MemoryRecordingStorage extends RecordingStorage {
  /** What the phone's upload would do: store an object of this size at the path. */
  put(path: string, bytes: number): void;
  paths(): string[];
}

export function memoryRecordingStorage(): MemoryRecordingStorage {
  const objects = new Map<string, number>();
  return {
    put: (path, bytes) => void objects.set(path, bytes),
    paths: () => [...objects.keys()].sort(),
    signUpload: (path) =>
      Promise.resolve({ url: `memory://upload/${path}?n=${Math.random()}`, token: 'token' }),
    size: (path) => Promise.resolve(objects.get(path) ?? null),
    read: (path) => {
      const size = objects.get(path);
      return Promise.resolve(size === undefined ? null : new Uint8Array(size));
    },
    signDownload: (path, seconds) => Promise.resolve(`memory://read/${path}?ttl=${seconds}`),
    remove: (paths) => {
      for (const path of paths) objects.delete(path);
      return Promise.resolve();
    },
  };
}
