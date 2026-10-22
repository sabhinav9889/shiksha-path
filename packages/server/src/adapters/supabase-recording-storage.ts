import { createClient } from '@supabase/supabase-js';
import type { RecordingStorage } from '../ports.js';

const BUCKET = 'recordings';

type Bucket = ReturnType<ReturnType<typeof createClient>['storage']['from']>;
const LIST_LIMIT = 1000;

/** Every object under `<prefix>/` (one learner's folder holds far fewer than the limit). */
async function removeFolder(bucket: Bucket, prefix: string): Promise<number> {
  const { data, error } = await bucket.list(prefix, { limit: LIST_LIMIT });
  if (error) throw new Error('could not read the bucket');
  const paths = data.map((o) => `${prefix}/${o.name}`);
  if (paths.length === 0) return 0;
  const removed = await bucket.remove(paths);
  if (removed.error) throw new Error('could not remove recordings');
  return paths.length;
}

/** The private `recordings` bucket in Supabase Storage, reached with the service role. */
export function createSupabaseRecordingStorage(
  url: string,
  serviceRoleKey: string,
  publicUrl: string = url,
): RecordingStorage {
  /** Inside a local stack the function sees an internal host; phones need the public one. */
  const forPhone = (signed: string): string =>
    url === publicUrl
      ? signed
      : publicUrl.replace(/\/$/, '') + signed.slice(new URL(signed).origin.length);
  const bucket = createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  }).storage.from(BUCKET);
  return {
    async signUpload(path) {
      const { data, error } = await bucket.createSignedUploadUrl(path, { upsert: true });
      if (error) throw new Error('could not sign an upload');
      return { url: forPhone(data.signedUrl), token: data.token };
    },
    async size(path) {
      const at = path.lastIndexOf('/');
      const { data, error } = await bucket.list(path.slice(0, at), {
        search: path.slice(at + 1),
        limit: 1,
      });
      if (error) throw new Error('could not read the bucket');
      const found = data.find((o) => o.name === path.slice(at + 1));
      const bytes = (found?.metadata as { size?: number } | null | undefined)?.size;
      return typeof bytes === 'number' ? bytes : null;
    },
    async signDownload(path, seconds) {
      const { data, error } = await bucket.createSignedUrl(path, seconds);
      if (error) throw new Error('could not sign a download');
      return forPhone(data.signedUrl);
    },
    removePrefix: (prefix) => removeFolder(bucket, prefix),
    async read(path) {
      const { data, error } = await bucket.download(path);
      return error ? null : new Uint8Array(await data.arrayBuffer());
    },
    async remove(paths) {
      if (paths.length === 0) return;
      const { error } = await bucket.remove(paths);
      if (error) throw new Error('could not remove recordings');
    },
  };
}
