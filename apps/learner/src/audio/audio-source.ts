import type { BundleStorage } from '@shiksha/learner-core';

const MIME_TYPES: Record<string, string> = {
  mp3: 'audio/mpeg',
  m4a: 'audio/mp4',
  ogg: 'audio/ogg',
  opus: 'audio/ogg',
  webm: 'audio/webm',
};

/** A playable URL for stored audio, or null when the file is not on the phone. */
export async function audioObjectUrl(
  storage: BundleStorage,
  path: string,
): Promise<{ url: string; revoke(): void } | null> {
  const bytes = await storage.getAudio(path);
  if (!bytes) return null;
  const type = MIME_TYPES[path.split('.').pop() ?? ''] ?? 'application/octet-stream';
  const url = URL.createObjectURL(new Blob([new Uint8Array(bytes)], { type }));
  return { url, revoke: () => URL.revokeObjectURL(url) };
}
